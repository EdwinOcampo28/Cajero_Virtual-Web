  async function submitCardPayment(event) {
    event.preventDefault();
    const current = account();
    if (!current) return;
    const rawAmount = Number($('#cardPaymentAmount').value);
    const amount = roundMoney(rawAmount);
    clearCardFormError('cardPayment');
    if (!validIntegerAmount(rawAmount)) return cardFormProblem('cardPayment', 'Ingresa un importe entero mayor que cero, sin decimales.');
    if (amount > current.balance) return cardFormProblem('cardPayment', `Ahorros insuficientes. Saldo disponible: ${money(current.balance)}.`);
    if (amount > current.card.debt) return cardFormProblem('cardPayment', `El pago no puede superar la deuda actual de la tarjeta: ${money(current.card.debt)}.`);
    const confirmed = await showAppDialog({
      type: 'confirm', title: 'Pagar tarjeta desde ahorros',
      message: `Se descontarán ${money(amount)} de tus ahorros para reducir la deuda de tarjeta. Ahorros después del pago: ${money(current.balance - amount)}.`,
      eyebrow: 'PAGO DE TARJETA', icon: '✓', confirmText: 'Confirmar pago'
    });
    if (!confirmed) return;
    current.balance = roundMoney(current.balance - amount);
    current.card.debt = Math.max(0, roundMoney(current.card.debt - amount));
    if (current.card.debt === 0) current.card.nextInterestDate = null;
    recordMovement(activeAccountId, 'card_payment', amount, 'Pago de tarjeta desde cuenta de ahorros', 'out');
    recordCardMovement(activeAccountId, 'card_payment', amount, 'Pago de tarjeta recibido desde ahorros', 'in');
    saveDatabase();
    $('#cardPaymentForm').reset();
    renderApp();
    showToast(`Saldo antiguo de tarjeta pagado por ${money(amount)}.`);
  }

  function submitCardLimitIncreaseRequest(event) {
    event.preventDefault();
    const current = account();
    if (!current) return;
    const error = $('#cardLimitRequestError');
    error.hidden = true;
    const currentLimit = cardCreditLimitForAccount(current.id);
    const requestedLimit = Number($('#cardLimitRequestedValue').value);
    if (!Number.isInteger(requestedLimit) || requestedLimit <= currentLimit || requestedLimit > MAX_CARD_LIMIT) {
      error.textContent = `El nuevo cupo debe ser mayor que ${money(currentLimit)} y no puede superar ${money(MAX_CARD_LIMIT)}.`;
      error.hidden = false;
      $('#cardLimitRequestedValue').focus();
      return;
    }
    const existingPending = (db.limitIncreaseRequests || []).some((request) => request.accountId === current.id && (request.status || 'En revisión') === 'En revisión');
    if (existingPending) {
      error.textContent = 'Ya tienes una solicitud de aumento de cupo pendiente de revisión.';
      error.hidden = false;
      return;
    }
    if (currentLimit >= MAX_CARD_LIMIT) {
      error.textContent = `Tu tarjeta ya alcanzó el cupo máximo permitido de ${money(MAX_CARD_LIMIT)} en esta demostración.`;
      error.hidden = false;
      return;
    }
    const request = {
      id: createId(), accountId: current.id, applicantName: current.name, accountNumber: current.accountNumber,
      previousLimit: currentLimit, requestedLimit: roundMoney(requestedLimit), status: 'En revisión', date: new Date().toISOString()
    };
    if (!Array.isArray(db.limitIncreaseRequests)) db.limitIncreaseRequests = [];
    db.limitIncreaseRequests.unshift(request);
    saveDatabase();
    renderCardLimitRequestSection(current);
    if (reviewerSession) renderReviewerDashboard();
    showToast(`Solicitud de aumento de cupo a ${money(request.requestedLimit)} enviada al analista.`);
  }
