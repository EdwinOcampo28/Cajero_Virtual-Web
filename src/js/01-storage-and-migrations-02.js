  function loadDatabase() {
    let stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
      lastPersistedRaw = stored;
      databaseLoadIssue = false;
      if (!stored) return freshDatabase();
      const parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.accounts) || ![MAX_ACCOUNT_ID + 1, MAX_ACCOUNT_ID + 2].includes(parsed.accounts.length) || parsed.accounts[0] !== null || !parsed.accounts[1]) {
        databaseLoadIssue = true;
        return freshDatabase();
      }
      if (!normalizeWithdrawalTreasury(parsed)) { databaseLoadIssue = true; return freshDatabase(); }
      if (!normalizeSimulationSettings(parsed)) { databaseLoadIssue = true; return freshDatabase(); }
      const expectedArrays = ['creditApplications', 'loans', 'limitIncreaseRequests', 'auditLog'];
      if (expectedArrays.some((key) => parsed[key] !== undefined && !Array.isArray(parsed[key]))) {
        databaseLoadIssue = true;
        return freshDatabase();
      }
      for (const key of ['creditApplications', 'loans', 'limitIncreaseRequests']) {
        if (Array.isArray(parsed[key])) parsed[key] = parsed[key].filter((item) => !(Number.isInteger(item?.accountId) && item.accountId === MAX_ACCOUNT_ID + 1));
      }
      if (parsed.creditApplications?.some((item) => !item || typeof item !== 'object' || !Number.isInteger(item.accountId) || item.accountId < 1 || item.accountId > MAX_ACCOUNT_ID || !Number.isFinite(item.amount) || item.amount < 0 || typeof item.date !== 'string')
        || parsed.creditApplications?.some((item) => ['activatedAmount', 'cardFundsRemaining'].some((key) => item[key] !== undefined && (!Number.isSafeInteger(item[key]) || item[key] < 0)))
        || parsed.loans?.some((loan) => !loan || typeof loan.id !== 'string' || !Number.isInteger(loan.accountId) || loan.accountId < 1 || loan.accountId > MAX_ACCOUNT_ID || !Number.isFinite(loan.outstandingPrincipal) || loan.outstandingPrincipal < 0 || (loan.payments !== undefined && !Array.isArray(loan.payments)))
        || parsed.limitIncreaseRequests?.some((request) => !request || typeof request.id !== 'string' || !Number.isInteger(request.accountId) || request.accountId < 1 || request.accountId > MAX_ACCOUNT_ID || !Number.isFinite(request.requestedLimit) || request.requestedLimit < 0)
        || parsed.auditLog?.some((event) => !event || typeof event !== 'object' || typeof event.action !== 'string' || typeof event.date !== 'string')) {
        databaseLoadIssue = true;
        return freshDatabase();
      }
      for (let id = 1; id <= MAX_ACCOUNT_ID; id += 1) {
        const saved = parsed.accounts[id];
        if (!saved || saved.id !== id || typeof saved.balance !== 'number' || !Number.isFinite(saved.balance) || saved.balance < 0 || saved.balance > maxSavingsBalanceForAccount(saved.id) || !Array.isArray(saved.history)
          || saved.history.some((move) => !move || typeof move !== 'object' || (move.amount !== undefined && (!Number.isFinite(move.amount) || move.amount < 0)))
          || (saved.card?.history !== undefined && (!Array.isArray(saved.card.history) || saved.card.history.some((move) => !move || typeof move !== 'object' || (move.amount !== undefined && (!Number.isFinite(move.amount) || move.amount < 0)))))
          || (saved.card?.pendingDisbursements !== undefined && (!Array.isArray(saved.card.pendingDisbursements) || saved.card.pendingDisbursements.some((item) => !item || typeof item.applicationId !== 'string' || !Number.isSafeInteger(item.remainingAmount) || item.remainingAmount <= 0)))) {
          databaseLoadIssue = true;
          return freshDatabase();
        }
      }
      parsed.creditApplications = Array.isArray(parsed.creditApplications)
        ? parsed.creditApplications
            .filter((item) => item && Number.isInteger(item.accountId) && item.accountId >= 1 && item.accountId <= MAX_ACCOUNT_ID && typeof item.amount === 'number' && Number.isFinite(item.amount) && typeof item.date === 'string')
            .map((item) => ({ ...item, status: item.status || 'En revisión', monthlyRate: Number.isFinite(item.monthlyRate) ? item.monthlyRate : currentMonthlyInterestRate(parsed) }))
        : [];
      parsed.loans = Array.isArray(parsed.loans)
        ? parsed.loans
            .filter((loan) => loan && typeof loan.id === 'string' && Number.isInteger(loan.accountId) && loan.accountId >= 1 && loan.accountId <= MAX_ACCOUNT_ID && Number.isFinite(loan.outstandingPrincipal))
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
      parsed.auditLog = Array.isArray(parsed.auditLog)
        ? parsed.auditLog.filter((event) => event && typeof event === 'object' && typeof event.date === 'string' && typeof event.action === 'string')
            .slice(-MAX_AUDIT_EVENTS).map((event) => ({
              id: typeof event.id === 'string' ? event.id : createId(),
              date: event.date,
              action: String(event.action).slice(0, 120),
              category: String(event.category || 'sistema').slice(0, 40),
              accountId: Number.isInteger(event.accountId) && event.accountId >= 1 && event.accountId <= MAX_ACCOUNT_ID ? event.accountId : null,
              accountName: typeof event.accountName === 'string' ? event.accountName.slice(0, 100) : null,
              source: String(event.source || 'Sistema').slice(0, 40),
              amount: Number.isFinite(event.amount) ? Math.max(0, Math.round(event.amount)) : null,
              direction: ['in', 'out'].includes(event.direction) ? event.direction : null,
              description: String(event.description || '').slice(0, 400),
              referenceId: typeof event.referenceId === 'string' ? event.referenceId.slice(0, 100) : null,
              details: event.details && typeof event.details === 'object' && !Array.isArray(event.details) ? event.details : {}
            }))
        : [];
      parsed.limitIncreaseRequests = Array.isArray(parsed.limitIncreaseRequests)
        ? parsed.limitIncreaseRequests.filter((request) => request && typeof request.id === 'string' && Number.isInteger(request.accountId) && request.accountId >= 1 && request.accountId <= MAX_ACCOUNT_ID && Number.isFinite(request.requestedLimit)).map((request) => ({ ...request, requestedLimit: Math.min(MAX_CARD_LIMIT, Math.max(MAX_CARD_FUNDS, Math.round(request.requestedLimit))), status: request.status || 'En revisión' }))
        : [];
      for (let i = 1; i <= MAX_ACCOUNT_ID; i += 1) {
        const saved = parsed.accounts[i];
        const seed = ACCOUNT_SEED[i];
        if (!saved || saved.id !== i || typeof saved.balance !== 'number' || !Number.isFinite(saved.balance) || saved.balance < 0 || saved.balance > maxSavingsBalanceForAccount(saved.id) || !Array.isArray(saved.history)) {
          databaseLoadIssue = true;
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
          history: Array.isArray(oldCard.history) ? oldCard.history.filter((item) => item && typeof item === 'object').map((item) => ({ ...item, amount: Math.max(0, Math.round(Number(item.amount) || 0)) })) : [],
          pendingDisbursements: Array.isArray(oldCard.pendingDisbursements) ? oldCard.pendingDisbursements.map((item) => ({ ...item, remainingAmount: Math.round(item.remainingAmount) })) : []
        };
        const pendingTotal = saved.card.pendingDisbursements.reduce((sum, item) => sum + item.remainingAmount, 0);
        const pendingRecordsValid = saved.card.pendingDisbursements.every((item) => {
          const application = parsed.creditApplications.find((candidate) => candidate.id === item.applicationId && candidate.accountId === i);
          const recordedTotal = saved.card.pendingDisbursements.filter((candidate) => candidate.applicationId === item.applicationId).reduce((sum, candidate) => sum + candidate.remainingAmount, 0);
          return application && Number(application.cardFundsRemaining) === recordedTotal;
        });
        const pendingApplicationsValid = parsed.creditApplications.filter((application) => application.accountId === i && Number(application.cardFundsRemaining) > 0)
          .every((application) => saved.card.pendingDisbursements.some((item) => item.applicationId === application.id));
        if (pendingTotal > saved.card.funds || !pendingRecordsValid || !pendingApplicationsValid) {
          databaseLoadIssue = true;
          return freshDatabase();
        }
        const totalAvailableOnCard = saved.card.funds + saved.card.recoveredFunds;
        if (totalAvailableOnCard > saved.card.limit) saved.card.recoveredFunds = Math.max(0, saved.card.limit - saved.card.funds);
        saved.withdrawalDate = saved.withdrawalDate || localDateKey();
      }
      migrateLegacyCardDebts(parsed);
      consolidateActiveLoans(parsed);
      if (!normalizeSimulationAutomation(parsed)) { databaseLoadIssue = true; return freshDatabase(); }

      if (typeof compactDatabaseForStorage === 'function') compactDatabaseForStorage(parsed);
      return parsed;
    } catch (error) {
      lastPersistedRaw = stored;
      databaseLoadIssue = Boolean(stored);
      return freshDatabase();
    }
  }
