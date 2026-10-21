  function freshDatabase() {
    return {
      accounts: ACCOUNT_SEED.map((seed) => seed ? {
        ...seed,
        withdrawalDate: localDateKey(),
        history: [],
        card: { number: seed.cardNumber, limit: MAX_CARD_FUNDS, funds: 0, recoveredFunds: 0, debt: 0, nextInterestDate: null, history: [] }
      } : null),
      creditApplications: [],
      loans: [],
      advanceFeesCollected: 0,
      operationFeesCollected: 0,
      limitIncreaseRequests: []
    };
  }

  function migrateLegacyCardDebts(database) {
    if (!database || !Array.isArray(database.loans)) return;
    for (let accountId = 1; accountId <= 3; accountId += 1) {
      const card = database.accounts?.[accountId]?.card;
      if (!card) continue;
      const legacyDebt = Math.max(0, Math.round(Number(card.debt) || 0));
      if (legacyDebt <= 0) {
        card.debt = 0;
        card.nextInterestDate = null;
        continue;
      }
      const active = database.loans.find((loan) => loan.accountId === accountId && loan.status === 'Activo' && Number(loan.outstandingPrincipal) > 0);
      if (active) {
        active.outstandingPrincipal = roundMoney(active.outstandingPrincipal + legacyDebt);
        active.reborrowedCapitalTotal = roundMoney((Number(active.reborrowedCapitalTotal) || 0) + legacyDebt);
        active.originalDisbursedTotal = Math.max(0, roundMoney(Number.isFinite(active.originalDisbursedTotal) ? active.originalDisbursedTotal : (active.source === 'Avance de capital recuperado' ? 0 : Number(active.principalOriginal) || 0)));
        active.principalOriginal = active.originalDisbursedTotal;
        active.source = active.originalDisbursedTotal > 0 ? 'Crédito unificado' : 'Avance de capital recuperado';
        const paid = Math.max(0, Number(active.installmentsPaid) || 0);
        active.monthlyRate = ILLUSTRATIVE_MONTHLY_RATE;
        active.termMonths = paid + 60;
        active.monthlyPayment = calculateCreditEstimate(active.outstandingPrincipal, 60).monthlyPayment;
        active.nextDueDate = addMonthsToDate(localDateKey(), 1);
      } else {
        const migratedLoan = createLoanFromCardAdvance(accountId, legacyDebt);
        if (migratedLoan) database.loans.push(migratedLoan);
      }
      card.debt = 0;
      card.nextInterestDate = null;
      if (!Array.isArray(card.history)) card.history = [];
      card.history.unshift({ id: createId(), type: 'card_debt_unified', amount: legacyDebt, description: 'Saldo heredado integrado en la deuda única de crédito', direction: 'out', date: new Date().toISOString() });
    }
  }
