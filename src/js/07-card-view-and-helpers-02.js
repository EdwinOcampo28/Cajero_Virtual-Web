  function renderCardLimitRequestSection(current) {
    const limit = cardCreditLimitForAccount(current.id);
    const currentLabel = $('#cardLimitCurrentValue');
    if (currentLabel) currentLabel.textContent = money(limit);
    const requestedInput = $('#cardLimitRequestedValue');
    const rateLabel = $('#limitIncreaseRateText');
    if (rateLabel) rateLabel.textContent = formatMonthlyInterestRate();
    const requestField = $('#cardLimitRequestField');
    const requestIntro = $('#cardLimitRequestIntro');
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
        const increase = Number(request.increaseAmount) > 0 ? Number(request.increaseAmount) : Math.max(0, Number(request.requestedLimit) - Number(request.previousLimit));
        title.textContent = `Aumento solicitado: ${money(increase)} · Nuevo cupo: ${money(request.requestedLimit)}`;
        const meta = document.createElement('small');
        meta.textContent = `${shortDateTime(request.date)} · Cupo anterior: ${money(request.previousLimit)} · crédito a 12 meses al ${formatMonthlyInterestRate()} mensual cuando avances`;
        main.append(title, meta);
        const status = document.createElement('span');
        status.className = `credit-status ${statusClass(request.status || 'En revisión')}`;
        status.textContent = request.status || 'En revisión';
        row.append(main, status);
        if (Number(request.disbursedAmount) > 0) { const disbursement=document.createElement('small'); disbursement.className='limit-request-disbursement'; disbursement.textContent=`Desembolso a tarjeta: ${money(request.disbursedAmount)}. Se convierte en crédito a 12 cuotas únicamente al realizar avances.`; row.append(disbursement); }
        if (request.reviewerNote) { const note=document.createElement('small'); note.textContent=`Nota: ${request.reviewerNote}`; row.append(note); }
        history.append(row);
      });
    }
    if (empty) empty.hidden = requests.length > 0;
    const increaseAmounts = [50000000];
    const enabledAmounts = increaseAmounts.filter((amount) => limit + amount <= MAX_CARD_LIMIT);
    const noMoreOptions = enabledAmounts.length === 0;
    const maximumReached = limit >= MAX_CARD_LIMIT;
    if (requestField) requestField.hidden = noMoreOptions;
    if (requestIntro) requestIntro.textContent = noMoreOptions
      ? (maximumReached
        ? `La tarjeta llegó al límite de precisión numérica del simulador y no admite otro aumento.`
        : `No se puede registrar otro incremento dentro del rango numérico seguro del simulador.`)
      : 'El aumento disponible es de $ 50.000.000. Si se aprueba, esos fondos se cargan a tu tarjeta y solo generan crédito cuando haces avances.';
    if (requestedInput) {
      const pendingAmount = pending
        ? (Number(pending.increaseAmount) > 0 ? Number(pending.increaseAmount) : Math.max(0, Number(pending.requestedLimit) - Number(pending.previousLimit)))
        : Number(requestedInput.value);
      Array.from(requestedInput.options).forEach((option) => {
        const amount = Number(option.value);
        const canChoose = limit + amount <= MAX_CARD_LIMIT;
        option.disabled = !canChoose;
        option.textContent = noMoreOptions
          ? (maximumReached ? 'Límite de precisión numérica alcanzado' : 'Aumento no disponible')
          : `Aumentar ${money(amount)} · nuevo cupo ${money(limit + amount)} · crédito a 12 meses al avanzar`;
      });
      const desired = pendingAmount && increaseAmounts.includes(pendingAmount) ? pendingAmount : (enabledAmounts.includes(Number(requestedInput.value)) ? Number(requestedInput.value) : (enabledAmounts[0] || 50000000));
      requestedInput.value = String(desired);
      requestedInput.disabled = Boolean(pending) || noMoreOptions;
    }
    if (submitButton) {
      submitButton.disabled = Boolean(pending) || noMoreOptions;
      submitButton.hidden = noMoreOptions;
    }
    const statusText = $('#cardLimitRequestStatus');
    if (statusText) {
      statusText.textContent = pending
        ? `Tienes una solicitud pendiente de aumento de ${money(Number(pending.increaseAmount) || (pending.requestedLimit - pending.previousLimit))}, a ${money(pending.requestedLimit) } de cupo. Si se aprueba, los fondos se cargarán a tu tarjeta y el crédito se activará a 12 cuotas solo al avanzar.`
        : noMoreOptions
          ? (maximumReached
            ? `El simulador no puede registrar más aumentos por su límite de precisión numérica.`
            : `No se puede registrar otro incremento dentro del rango numérico seguro del simulador.`)
          : 'El aumento disponible es de $50.000.000. Si se aprueba, se cargará a tu tarjeta y el crédito se activará a 12 cuotas solo al realizar avances.';
    }
    if (error && !pending && !noMoreOptions) error.hidden = true;
  }

  function totalDisbursedForAccount(accountId) {
    // Cuenta los fondos desembolsados a tarjeta, incluidos los que aún no se han avanzado.
    const loanOriginals = (db.loans || []).reduce((sum, loan) => {
      if (loan.accountId !== accountId) return sum;
      const original = Number.isFinite(loan.originalDisbursedTotal)
        ? loan.originalDisbursedTotal
        : (loan.source === 'Avance de capital recuperado' ? 0 : Number(loan.principalOriginal) || 0);
      return sum + Math.max(0, original);
    }, 0);
    const pendingOriginals = (db.creditApplications || []).filter((application) => application.accountId === accountId && application.disbursedAt)
      .reduce((sum, application) => {
        const linkedLoan = findLoanForApplication(application.id);
        const alreadyActivated = linkedLoan
          ? (Number.isFinite(application.activatedAmount) ? Math.max(0, Number(application.activatedAmount)) : Number(application.amount))
          : 0;
        return sum + Math.max(0, Number(application.amount) - alreadyActivated);
      }, 0);
    return roundMoney(loanOriginals + pendingOriginals);
  }
