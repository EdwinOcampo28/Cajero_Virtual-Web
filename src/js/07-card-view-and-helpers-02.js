  function renderCardLimitRequestSection(current) {
    const limit = cardCreditLimitForAccount(current.id);
    const currentLabel = $('#cardLimitCurrentValue');
    if (currentLabel) currentLabel.textContent = money(limit);
    const requestedInput = $('#cardLimitRequestedValue');
    const error = $('#cardLimitRequestError');
    const submitButton = $('#cardLimitRequestSubmit');
    const requests = Array.isArray(db.limitIncreaseRequests) ? db.limitIncreaseRequests.filter((request) => request.accountId === current.id).sort((a,b) => new Date(b.date) - new Date(a.date)) : [];
    const pending = requests.find((request) => (request.status || 'En revisión') === 'En revisión');
    const history = $('#cardLimitRequestHistory');
    const empty = $('#cardLimitRequestEmpty');
    if (history) {
      history.replaceChildren();
      requests.slice(0, 4).forEach((request) => {
        const row = document.createElement('article');
        row.className = 'credit-application-item';
        const main = document.createElement('div');
        main.className = 'credit-application-main';
        const title = document.createElement('strong');
        title.textContent = `Cupo solicitado: ${money(request.requestedLimit)}`;
        const meta = document.createElement('small');
        meta.textContent = `${shortDateTime(request.date)} · Cupo anterior: ${money(request.previousLimit)}`;
        main.append(title, meta);
        const status = document.createElement('span');
        status.className = `credit-status ${statusClass(request.status || 'En revisión')}`;
        status.textContent = request.status || 'En revisión';
        row.append(main, status);
        if (Number(request.disbursedAmount) > 0) { const disbursement=document.createElement('small'); disbursement.className='limit-request-disbursement'; disbursement.textContent=`Desembolso automático realizado: ${money(request.disbursedAmount)}; integrado a tu deuda unificada.`; row.append(disbursement); }
        if (request.reviewerNote) { const note=document.createElement('small'); note.textContent=`Nota: ${request.reviewerNote}`; row.append(note); }
        history.append(row);
      });
    }
    if (empty) empty.hidden = requests.length > 0;
    const maxed = limit >= MAX_CARD_LIMIT;
    if (requestedInput) {
      if (requestedInput.dataset.accountId !== String(current.id)) {
        requestedInput.dataset.accountId = String(current.id);
        delete requestedInput.dataset.userEdited;
      }
      requestedInput.min = String(limit + 1000000);
      requestedInput.max = String(MAX_CARD_LIMIT);
      const suggested = Math.min(MAX_CARD_LIMIT, limit + 25000000);
      if (!requestedInput.dataset.userEdited) requestedInput.value = String(suggested);
      requestedInput.disabled = Boolean(pending) || maxed;
    }
    if (submitButton) submitButton.disabled = Boolean(pending) || maxed;
    const statusText = $('#cardLimitRequestStatus');
    if (statusText) {
      statusText.textContent = pending ? `Tienes una solicitud pendiente para aumentar el cupo a ${money(pending.requestedLimit)}.` : maxed ? 'Tu tarjeta ya tiene el cupo máximo de demostración autorizado.' : 'Puedes solicitar un cupo mayor; el analista revisará la solicitud.';
    }
    if (error && !pending && !maxed) error.hidden = true;
  }

  function totalDisbursedForAccount(accountId) {
    // Cuenta solo los desembolsos originales; las reutilizaciones de capital nunca se suman a esta cifra.
    return roundMoney((db.loans || []).reduce((sum, loan) => {
      if (loan.accountId !== accountId) return sum;
      const original = Number.isFinite(loan.originalDisbursedTotal)
        ? loan.originalDisbursedTotal
        : (loan.source === 'Avance de capital recuperado' ? 0 : Number(loan.principalOriginal) || 0);
      return sum + Math.max(0, original);
    }, 0));
  }
