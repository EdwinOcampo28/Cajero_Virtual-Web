  function addOriginalDisbursementToUnifiedDebt(application) {
    const amount = roundMoney(application.amount);
    let loan = (db.loans || []).find((item) => item.accountId === application.accountId && item.status === 'Activo' && Number(item.outstandingPrincipal) > 0);
    if (!loan) {
      loan = createLoanFromApplication(application);
      db.loans.unshift(loan);
      return loan;
    }
    const priorRemainingMonths = Math.max(1, estimateRemainingInstallments(loan));
    loan.outstandingPrincipal = roundMoney(loan.outstandingPrincipal + amount);
    loan.originalDisbursedTotal = roundMoney((Number.isFinite(loan.originalDisbursedTotal)
      ? loan.originalDisbursedTotal
      : (loan.source === 'Avance de capital recuperado' ? 0 : Number(loan.principalOriginal) || 0)) + amount);
    loan.principalOriginal = loan.originalDisbursedTotal;
    loan.reborrowedCapitalTotal = Math.max(0, roundMoney(Number(loan.reborrowedCapitalTotal) || 0));
    loan.applicationIds = Array.from(new Set([...(Array.isArray(loan.applicationIds) ? loan.applicationIds : []), ...(loan.applicationId ? [loan.applicationId] : []), application.id].filter(Boolean)));
    loan.applicationId = loan.applicationId || application.id;
    loan.source = 'Crédito unificado';
    recalculateUnifiedLoanSchedule(loan, Math.max(priorRemainingMonths, Number(application.termMonths) || 60));
    return loan;
  }

  function outstandingLoanPrincipalForAccount(accountId) {
    return roundMoney((db.loans || []).reduce((sum, loan) => {
      if (loan.accountId !== accountId) return sum;
      return sum + Math.max(0, Number(loan.outstandingPrincipal) || 0);
    }, 0));
  }

  function outstandingLoanPrincipalAcrossSystem() {
    return roundMoney((db.loans || []).reduce((sum, loan) => sum + Math.max(0, Number(loan.outstandingPrincipal) || 0), 0));
  }

  function outstandingCreditExposureForAccount(accountId) {
    const legacyCardDebt = Math.max(0, Number(db.accounts[accountId]?.card?.debt) || 0);
    return roundMoney(outstandingLoanPrincipalForAccount(accountId) + legacyCardDebt);
  }

  function cardCreditLimitForAccount(accountId) {
    const value = Number(db.accounts[accountId]?.card?.limit);
    return Number.isFinite(value) ? Math.min(MAX_CARD_LIMIT, Math.max(MAX_CARD_FUNDS, roundMoney(value))) : MAX_CARD_FUNDS;
  }

  function availablePersonalCreditForAccount(accountId) {
    return Math.max(0, roundMoney(cardCreditLimitForAccount(accountId) - outstandingCreditExposureForAccount(accountId)));
  }

  // Only interest actually received through completed payments counts as earnings.
  function totalInterestEarned() {
    return roundMoney((db.loans || []).reduce((loanSum, loan) => {
      const paidInterest = (Array.isArray(loan.payments) ? loan.payments : []).reduce((sum, payment) => {
        return sum + Math.max(0, Number(payment.interest) || 0);
      }, 0);
      return loanSum + paidInterest;
    }, 0));
  }

  function totalAdvanceFeesEarned() {
    return Math.max(0, roundMoney(Number(db.advanceFeesCollected) || 0));
  }

  function totalOperationFeesEarned() {
    return Math.max(0, roundMoney(Number(db.operationFeesCollected) || 0));
  }
