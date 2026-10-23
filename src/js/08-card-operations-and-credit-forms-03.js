  function pendingCreditApplicationForAccount(accountId) {
    return (db.creditApplications || []).find((item) => item.accountId === accountId && (item.status || 'En revisión') === 'En revisión') || null;
  }

  function renderCreditApplicationFormState(current = account()) {
    const button = $('#creditSubmitButton');
    const status = $('#creditRequestStatus');
    if (!button || !status) return;
    if (!current) { button.disabled = true; status.hidden = true; return; }
    const pending = pendingCreditApplicationForAccount(current.id);
    const available = Math.max(0, roundMoney(availablePersonalCreditForAccount(current.id)));
    const exhausted = available < MIN_CREDIT_AMOUNT;
    button.disabled = Boolean(pending) || exhausted;
    status.hidden = false;
    status.classList.toggle('error-message', Boolean(pending) || exhausted);
    status.classList.toggle('credit-request-status', true);
    if (pending) {
      status.textContent = `Ya tienes una solicitud en revisión por ${money(pending.amount)}. El botón se habilitará cuando el analista registre su decisión.`;
    } else if (exhausted) {
      status.textContent = 'Ya alcanzaste el cupo máximo disponible para créditos. El botón se habilitará cuando recuperes capacidad de crédito.';
    } else {
      status.textContent = `Puedes solicitar hasta ${money(Math.min(MAX_CREDIT_AMOUNT, available))}. Si envías una solicitud, el botón se deshabilitará mientras esté en revisión.`;
      status.hidden = false;
    }
  }

  function submitCreditApplication(event) {
    event.preventDefault();
    if (typeof catchUpAutomaticEventsBeforeOperation === 'function' && !catchUpAutomaticEventsBeforeOperation()) return;
    const current = account();
    if (!current) return;
    creditError.hidden = true;
    const pendingRequest = pendingCreditApplicationForAccount(current.id);
    if (pendingRequest) {
      creditError.textContent = `Ya existe una solicitud en revisión por ${money(pendingRequest.amount)}. Espera la decisión del analista antes de enviar otra.`;
      creditError.hidden = false;
      renderCreditApplicationFormState(current);
      return;
    }
    const amount = Number(creditAmountInput.value);
    const monthlyIncome = Number(creditIncomeInput.value);
    const termMonths = Number(creditTermSelect.value);
    if (!Number.isInteger(amount) || amount < MIN_CREDIT_AMOUNT || amount > MAX_CREDIT_AMOUNT) {
      creditError.textContent = `Ingresa un monto entero entre ${money(MIN_CREDIT_AMOUNT)} y ${money(MAX_CREDIT_AMOUNT)}.`;
      creditError.hidden = false;
      creditAmountInput.focus();
      return;
    }
    if (amount > availablePersonalCreditForAccount(current.id)) {
      creditError.textContent = `El cupo autorizado de tu tarjeta es ${money(cardCreditLimitForAccount(current.id))}. En este momento puedes solicitar como máximo ${money(availablePersonalCreditForAccount(current.id))}.`;
      creditError.hidden = false;
      creditAmountInput.focus();
      return;
    }
    if (amount > availableAnalystCapital()) {
      creditError.textContent = `El fondo disponible del analista es ${money(availableAnalystCapital())}; el fondo total es ${money(simulationSettingsFor(db).analystCapital)}.`;
      creditError.hidden = false;
      creditAmountInput.focus();
      return;
    }
    if (!Number.isInteger(monthlyIncome) || monthlyIncome <= 0) {
      creditError.textContent = 'Ingresa tus ingresos mensuales como un número entero mayor que cero.';
      creditError.hidden = false;
      creditIncomeInput.focus();
      return;
    }
    if (!VALID_CREDIT_TERMS.includes(termMonths)) {
      creditError.textContent = 'Selecciona un plazo válido para la simulación.';
      creditError.hidden = false;
      creditTermSelect.focus();
      return;
    }
    const monthlyRate = currentMonthlyInterestRate();
    const estimate = calculateCreditEstimate(amount, termMonths, monthlyRate);
    const application = {
      id: createId(),
      accountId: activeAccountId,
      applicantName: current.name,
      accountNumber: current.accountNumber,
      amount,
      monthlyIncome,
      termMonths,
      monthlyRate,
      employment: creditEmploymentSelect.value,
      purpose: creditPurposeSelect.value,
      monthlyPayment: estimate.monthlyPayment,
      totalPayable: estimate.totalPayable,
      totalInterest: estimate.totalInterest,
      status: 'En revisión',
      date: new Date().toISOString()
    };
    if (!Array.isArray(db.creditApplications)) db.creditApplications = [];
    db.creditApplications.unshift(application);
    recordAuditEvent('Solicitud de crédito enviada', { category: 'creditos', accountId: current.id, amount, source: 'Cliente', referenceId: application.id, description: application.purpose, details: { termMonths, monthlyRate } });
    if (!saveDatabase()) { renderApp(); return; }
    renderCreditApplications();
    if (reviewerSession) renderReviewerDashboard();
    creditError.hidden = true;
    creditForm.reset();
    creditAmountInput.value = '5000000';
    creditTermSelect.value = '6';
    updateCreditSimulation();
    renderCreditApplications();
    renderCreditApplicationFormState(current);
    showView('credits');
    showToast('Solicitud registrada. El botón permanecerá deshabilitado hasta que el analista registre una decisión.');
    $('#creditApplicationsList').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
