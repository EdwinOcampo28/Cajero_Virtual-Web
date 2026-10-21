  function submitCreditApplication(event) {
    event.preventDefault();
    const current = account();
    if (!current) return;
    creditError.hidden = true;
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
      creditError.textContent = `El fondo disponible del analista es ${money(availableAnalystCapital())}; el fondo total es ${money(ANALYST_TOTAL_CAPITAL)}.`;
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
    const estimate = calculateCreditEstimate(amount, termMonths);
    const application = {
      id: createId(),
      accountId: activeAccountId,
      applicantName: current.name,
      accountNumber: current.accountNumber,
      amount,
      monthlyIncome,
      termMonths,
      monthlyRate: ILLUSTRATIVE_MONTHLY_RATE,
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
    saveDatabase();
    renderCreditApplications();
    if (reviewerSession) renderReviewerDashboard();
    creditError.hidden = true;
    creditForm.reset();
    creditAmountInput.value = '5000000';
    creditTermSelect.value = '60';
    updateCreditSimulation();
    showView('financial-history');
    showToast('Solicitud registrada. El analista debe aprobarla para que se realice el desembolso.');
    $('#creditApplicationsList').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
