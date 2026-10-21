  function loadDatabase() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return freshDatabase();
      const parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.accounts) || parsed.accounts.length !== 4 || !parsed.accounts[1]) {
        return freshDatabase();
      }
      parsed.creditApplications = Array.isArray(parsed.creditApplications)
        ? parsed.creditApplications
            .filter((item) => item && Number.isInteger(item.accountId) && item.accountId >= 1 && item.accountId <= 3 && typeof item.amount === 'number' && Number.isFinite(item.amount) && typeof item.date === 'string')
            .slice(0, 500)
            .map((item) => ({ ...item, status: item.status || 'En revisión', monthlyRate: Number.isFinite(item.monthlyRate) ? item.monthlyRate : ILLUSTRATIVE_MONTHLY_RATE }))
        : [];
      parsed.loans = Array.isArray(parsed.loans)
        ? parsed.loans
            .filter((loan) => loan && typeof loan.id === 'string' && Number.isInteger(loan.accountId) && loan.accountId >= 1 && loan.accountId <= 3 && Number.isFinite(loan.outstandingPrincipal))
            .map((loan) => {
              const legacyAdvance = loan.source === 'Avance de capital recuperado';
              const originalDisbursedTotal = Number.isFinite(loan.originalDisbursedTotal)
                ? Math.max(0, Math.round(loan.originalDisbursedTotal))
                : (legacyAdvance ? 0 : Math.max(0, Math.round(Number(loan.principalOriginal) || 0)));
              const reborrowedCapitalTotal = Number.isFinite(loan.reborrowedCapitalTotal)
                ? Math.max(0, Math.round(loan.reborrowedCapitalTotal))
                : (legacyAdvance ? Math.max(0, Math.round(Number(loan.principalOriginal) || 0)) : 0);
              const applicationIds = Array.from(new Set([
                ...(Array.isArray(loan.applicationIds) ? loan.applicationIds : []),
                ...(loan.applicationId ? [loan.applicationId] : [])
              ].filter((id) => typeof id === 'string' && id)));
              return { ...loan, originalDisbursedTotal, reborrowedCapitalTotal, applicationIds };
            })
        : [];
      parsed.advanceFeesCollected = Number.isFinite(parsed.advanceFeesCollected)
        ? Math.max(0, Math.round(parsed.advanceFeesCollected))
        : 0;
      parsed.operationFeesCollected = Number.isFinite(parsed.operationFeesCollected)
        ? Math.max(0, Math.round(parsed.operationFeesCollected))
        : 0;
      parsed.limitIncreaseRequests = Array.isArray(parsed.limitIncreaseRequests)
        ? parsed.limitIncreaseRequests.filter((request) => request && typeof request.id === 'string' && Number.isInteger(request.accountId) && request.accountId >= 1 && request.accountId <= 3 && Number.isFinite(request.requestedLimit)).map((request) => ({ ...request, requestedLimit: Math.min(MAX_CARD_LIMIT, Math.max(MAX_CARD_FUNDS, Math.round(request.requestedLimit))), status: request.status || 'En revisión' }))
        : [];
      for (let i = 1; i <= 3; i += 1) {
        const saved = parsed.accounts[i];
        const seed = ACCOUNT_SEED[i];
        if (!saved || saved.id !== i || typeof saved.balance !== 'number' || !Array.isArray(saved.history)) {
          return freshDatabase();
        }
        saved.name = seed.name;
        saved.accountNumber = seed.accountNumber;
        saved.accountType = seed.accountType;
        saved.pin = seed.pin;
        saved.cardNumber = seed.cardNumber;
        saved.balance = Math.round(saved.balance);
        saved.withdrawnToday = Number.isFinite(saved.withdrawnToday) ? Math.round(saved.withdrawnToday) : 0;
        saved.history = saved.history.map((item) => ({ ...item, amount: Math.round(Number(item.amount) || 0) }));
        const oldCard = saved.card && typeof saved.card === 'object' ? saved.card : {};
        const cardLimit = Number.isFinite(oldCard.limit) ? Math.min(MAX_CARD_LIMIT, Math.max(MAX_CARD_FUNDS, Math.round(oldCard.limit))) : MAX_CARD_FUNDS;
        const priorCardFunds = Number.isFinite(oldCard.funds) ? Math.max(0, Math.min(cardLimit, Math.round(oldCard.funds))) : 0;
        // Reconstruct the principal returned by earlier payments when upgrading from a version that did not store it separately.
        const historicalPrincipalRecovered = (parsed.loans || []).filter((loan) => loan.accountId === i).reduce((loanTotal, loan) => {
          return loanTotal + (Array.isArray(loan.payments) ? loan.payments.reduce((paymentTotal, payment) => paymentTotal + Math.max(0, Number(payment.principal) || 0), 0) : 0);
        }, 0);
        const priorRecoveredFunds = Number.isFinite(oldCard.recoveredFunds)
          ? Math.max(0, Math.min(cardLimit, Math.round(oldCard.recoveredFunds)))
          : Math.max(0, Math.min(cardLimit - priorCardFunds, Math.round(historicalPrincipalRecovered)));
        saved.card = {
          number: seed.cardNumber,
          limit: cardLimit,
          funds: priorCardFunds,
          recoveredFunds: priorRecoveredFunds,
          // recoveredFunds contains principal repaid by the customer and available to draw again, not a separate external credit line.
          debt: Number.isFinite(oldCard.debt) ? Math.max(0, Math.round(oldCard.debt)) : 0,
          nextInterestDate: typeof oldCard.nextInterestDate === 'string' ? oldCard.nextInterestDate : null,
          history: Array.isArray(oldCard.history) ? oldCard.history.filter((item) => item && typeof item === 'object').map((item) => ({ ...item, amount: Math.max(0, Math.round(Number(item.amount) || 0)) })) : []
        };
        const totalAvailableOnCard = saved.card.funds + saved.card.recoveredFunds;
        if (totalAvailableOnCard > saved.card.limit) saved.card.recoveredFunds = Math.max(0, saved.card.limit - saved.card.funds);
        saved.withdrawalDate = saved.withdrawalDate || localDateKey();
      }
      migrateLegacyCardDebts(parsed);
      consolidateActiveLoans(parsed);
      return parsed;
    } catch (error) {
      return freshDatabase();
    }
  }
