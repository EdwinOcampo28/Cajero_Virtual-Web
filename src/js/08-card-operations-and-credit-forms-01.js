  async function submitCardAdvance(event) {
    event.preventDefault();
    const current = account();
    if (!current) return;
    const rawAmount = Number($('#cardFundsAmount').value);
    const amount = roundMoney(rawAmount);
    const selectedTerm = Number(advanceTermSelect?.value || 60);
    clearCardFormError('cardFunds');
    if (!validIntegerAmount(rawAmount)) return cardFormProblem('cardFunds', 'Ingresa un importe entero mayor que cero, sin decimales.');
    if (!VALID_CREDIT_TERMS.includes(selectedTerm)) return cardFormProblem('cardFunds', 'Selecciona un plazo válido para la deuda unificada.');
    const card = current.card;
    const totalAvailable = availableAdvancesForCard(card);
    if (amount > totalAvailable) return cardFormProblem('cardFunds', `No hay suficientes fondos disponibles para avanzar. Disponible: ${money(totalAvailable)}.`);
    const fromOriginalFunds = Math.min(amount, Math.max(0, Number(card.funds) || 0));
    const recycledPrincipalDraw = roundMoney(amount - fromOriginalFunds);
    if (current.balance + amount < ADVANCE_FEE) return cardFormProblem('cardFunds', `El costo del avance es ${money(ADVANCE_FEE)}. Necesitas contar con ese importe entre tus ahorros y el dinero que vas a avanzar.`);
    const resultingBalance = roundMoney(current.balance + amount - ADVANCE_FEE);
    if (resultingBalance > MAX_ACCOUNT_BALANCE) return cardFormProblem('cardFunds', `Después de cobrar el costo de ${money(ADVANCE_FEE)}, tus ahorros solo pueden recibir hasta ${money(MAX_ACCOUNT_BALANCE - current.balance + ADVANCE_FEE)} más.`);
    if (recycledPrincipalDraw > 0) {
      if (recycledPrincipalDraw > availableAnalystCapital()) return cardFormProblem('cardFunds', `El fondo de crédito no tiene suficiente capital para añadir este avance a la deuda. Disponible del analista: ${money(availableAnalystCapital())}.`);
      if (recycledPrincipalDraw > availablePersonalCreditForAccount(activeAccountId)) return cardFormProblem('cardFunds', `Este avance supera el máximo de capital pendiente de tu cuenta. Disponible: ${money(availablePersonalCreditForAccount(activeAccountId))}.`);
    }
    const confirmMessage = `¿Confirmas realizar un avance de ${money(amount)} a tus ahorros? El dinero proviene del saldo disponible asociado a desembolsos ya realizados:

Costo por realizar el avance: ${money(ADVANCE_FEE)}. Este costo se descontará de tus ahorros.${recycledPrincipalDraw > 0 ? `
Plazo elegido para la deuda unificada: ${selectedTerm} cuotas al 2,13 % mensual.` : ''}`;
    const confirmed = await showAppDialog({
      type: 'confirm', title: 'Realizar avance a tus ahorros',
      message: confirmMessage,
      eyebrow: 'AVANCE A CUENTA PROPIA', icon: '↗', confirmText: 'Confirmar avance'
    });
    if (!confirmed) return;
    card.funds = roundMoney(Math.max(0, (Number(card.funds) || 0) - fromOriginalFunds));
    card.recoveredFunds = roundMoney(Math.max(0, (Number(card.recoveredFunds) || 0) - recycledPrincipalDraw));
    current.balance = resultingBalance;
    if (recycledPrincipalDraw > 0) {
      const unifiedLoan = addRecoveredCapitalToUnifiedDebt(activeAccountId, recycledPrincipalDraw, selectedTerm);
      if (unifiedLoan) {
        recordCardMovement(activeAccountId, 'card_reborrow', recycledPrincipalDraw, `Capital recuperado añadido a la deuda única · Cuota mensual actual ${money(unifiedLoan.monthlyPayment)}`, 'out');
        recordMovement(activeAccountId, 'card_reborrow', recycledPrincipalDraw, `Capital recuperado añadido a la deuda única · Nueva cuota mensual ${money(unifiedLoan.monthlyPayment)}`, null);
      }
    }
    db.advanceFeesCollected = roundMoney((Number(db.advanceFeesCollected) || 0) + ADVANCE_FEE);
    recordCardMovement(activeAccountId, 'card_advance', amount, 'Avance de tarjeta recibido en mis ahorros', 'out');
    recordMovement(activeAccountId, 'card_advance', amount, 'Avance de tarjeta recibido en mis ahorros', 'in');
    recordCardMovement(activeAccountId, 'card_advance_fee', ADVANCE_FEE, 'Costo de realizar avance', 'out');
    recordMovement(activeAccountId, 'card_advance_fee', ADVANCE_FEE, 'Costo por realizar avance', 'out');
    saveDatabase();
    $('#cardFundsForm').reset();
    renderApp();
    renderLoans();
    renderCreditApplications();
    if (reviewerSession) renderReviewerDashboard();
    const netAdded = roundMoney(amount - ADVANCE_FEE);
    const activeUnifiedDebt = (db.loans || []).find((loan) => loan.accountId === activeAccountId && loan.status === 'Activo' && loan.outstandingPrincipal > 0);
    showToast(`Avance realizado. ${money(netAdded)} netos llegaron a tus ahorros tras cobrar ${money(ADVANCE_FEE)}. ${recycledPrincipalDraw > 0 && activeUnifiedDebt ? `La deuda quedó unificada a ${selectedTerm} cuotas y la nueva cuota mensual es ${money(activeUnifiedDebt.monthlyPayment)}.` : 'El avance solo trasladó fondos de un desembolso ya registrado.'}`);
  }
