  function applyCardInterestThroughToday(current) {
    if (!current || !current.card) return true;
    const card = current.card;
    if (card.debt <= 0) {
      card.debt = 0;
      card.nextInterestDate = null;
      return true;
    }
    if (!card.nextInterestDate) {
      card.nextInterestDate = addMonthsToDate(localDateKey(), 1);
      return saveDatabase();
    }
    const today = localDateKey();
    let guard = 0;
    let changed = false;
    while (card.nextInterestDate <= today && card.debt > 0 && guard < 600) {
      const interest = Math.max(0, Math.round(card.debt * currentMonthlyInterestRate()));
      if (interest > 0) {
        card.debt = roundMoney(card.debt + interest);
        recordCardMovement(current.id, 'card_interest', interest, `Interés mensual ilustrativo de tarjeta (${formatMonthlyInterestRate()})`, 'out');
        recordMovement(current.id, 'card_interest', interest, 'Interés mensual ilustrativo generado por tarjeta', null);
        changed = true;
      }
      card.nextInterestDate = addMonthsToDate(card.nextInterestDate, 1);
      guard += 1;
    }
    if (changed || guard > 0) return saveDatabase();
    return true;
  }

  function renderCardView() {
    let current = account();
    if (!current) return;
    current.card = current.card || { number: current.cardNumber, limit: MAX_CARD_FUNDS, funds: 0, recoveredFunds: 0, debt: 0, nextInterestDate: null, history: [] };
    if (!Number.isFinite(current.card.recoveredFunds)) current.card.recoveredFunds = 0;
    if (!applyCardInterestThroughToday(current)) return; // Stop rendering stale values if a parallel tab changed the database.
    current = account();
    if (!current) return;
    const card = current.card;
    const totalDisbursements = totalDisbursedForAccount(current.id);
    const availableAdvances = availableAdvancesForCard(card);
    $('#cardNumberText').textContent = `•••• •••• •••• ${String(card.number || current.cardNumber).replace(/\D/g, '').slice(-4)}`;
    $('#cardHolderText').textContent = current.name.toLocaleUpperCase('es-CO');
    $('#cardTotalDisbursementsMetric').textContent = money(totalDisbursements);
    $('#cardAvailableAdvancesMetric').textContent = money(availableAdvances);
    const maxAdvanceBySavings = Math.max(0, roundMoney(maxSavingsBalanceForAccount(current.id) - current.balance + ADVANCE_FEE));
    $('#cardFundsAmount').max = String(Math.min(availableAdvances, maxAdvanceBySavings));
    $('#cardFundsHint').textContent = `Disponible de tarjeta: ${money(availableAdvances)}. La cuenta de ahorros no tiene tope de saldo.`;
    $('#cardPaymentHint').textContent = `Ahorros disponibles: ${money(current.balance)} · Saldo antiguo de avances pendiente: ${money(card.debt)}.`;
    $('#cardPaymentAmount').max = String(Math.min(card.debt, current.balance));
    $('#legacyCardPaymentPanel').hidden = !(card.debt > 0);
    $('#legacyCardPaymentSection').hidden = !(card.debt > 0);
    renderCardLimitRequestSection(current);
  }
