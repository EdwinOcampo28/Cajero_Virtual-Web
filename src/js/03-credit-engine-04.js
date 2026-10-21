  function totalAnalystBalance() {
    return roundMoney(ANALYST_TOTAL_CAPITAL + totalInterestEarned() + totalAdvanceFeesEarned() + totalOperationFeesEarned());
  }

  function availableAnalystCapital() {
    return Math.max(0, roundMoney(totalAnalystBalance() - outstandingLoanPrincipalAcrossSystem()));
  }

  function cardLimitForRecord(card) {
    const value = Number(card?.limit);
    return Number.isFinite(value) ? Math.min(MAX_CARD_LIMIT, Math.max(MAX_CARD_FUNDS, roundMoney(value))) : MAX_CARD_FUNDS;
  }

  function availableAdvancesForCard(card) {
    return Math.max(0, Math.min(cardLimitForRecord(card), roundMoney((Number(card?.funds) || 0) + (Number(card?.recoveredFunds) || 0))));
  }

  function restoreCardAdvanceBalance(accountRecord, principalPaid) {
    if (!accountRecord || !accountRecord.card || principalPaid <= 0) return 0;
    const card = accountRecord.card;
    const available = availableAdvancesForCard(card);
    const restored = Math.max(0, Math.min(roundMoney(principalPaid), cardLimitForRecord(card) - available));
    card.recoveredFunds = roundMoney((Number(card.recoveredFunds) || 0) + restored);
    return restored;
  }

  function createLoanFromCardAdvance(accountId, principal, termMonths = 60) {
    const amount = roundMoney(principal);
    if (amount <= 0) return null;
    const term = VALID_CREDIT_TERMS.includes(Number(termMonths)) ? Number(termMonths) : 60;
    const estimate = calculateCreditEstimate(amount, term);
    const disbursedAt = new Date().toISOString();
    return {
      id: createId(),
      applicationId: null,
      applicationIds: [],
      accountId,
      principalOriginal: 0,
      originalDisbursedTotal: 0,
      reborrowedCapitalTotal: amount,
      outstandingPrincipal: amount,
      monthlyRate: ILLUSTRATIVE_MONTHLY_RATE,
      termMonths: term,
      monthlyPayment: roundMoney(estimate.monthlyPayment),
      installmentsPaid: 0,
      nextDueDate: addMonthsToDate(disbursedAt, 1),
      disbursedAt,
      status: 'Activo',
      source: 'Avance de capital recuperado',
      payments: []
    };
  }
