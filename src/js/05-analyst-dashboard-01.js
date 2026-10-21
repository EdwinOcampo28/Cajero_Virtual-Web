  function enterReviewerLogin() {
    loginView.hidden = true;
    reviewerLoginView.hidden = false;
    reviewerView.hidden = true;
    reviewerLoginError.hidden = true;
    reviewerPinInput.value = '';
    reviewerPinInput.focus();
  }

  function returnToClientLogin() {
    reviewerSession = false;
    reviewerView.hidden = true;
    reviewerLoginView.hidden = true;
    loginView.hidden = false;
    reviewerPinInput.value = '';
    reviewerLoginError.hidden = true;
    accountSelect.focus();
  }

  function loginReviewer(event) {
    event.preventDefault();
    const suppliedPin = reviewerPinInput.value.trim();
    if (!/^\d{6}$/.test(suppliedPin) || suppliedPin !== REVIEWER_PIN) {
      reviewerLoginError.textContent = 'Clave incorrecta. Verifica los seis dígitos e inténtalo de nuevo.';
      reviewerLoginError.hidden = false;
      reviewerPinInput.setAttribute('aria-invalid', 'true');
      reviewerPinInput.focus();
      return;
    }
    reviewerSession = true;
    persistTabSession('analyst', null);
    reviewerLoginView.hidden = true;
    loginView.hidden = true;
    appView.hidden = true;
    reviewerView.hidden = false;
    reviewerPinInput.value = '';
    reviewerLoginError.hidden = true;
    $('#reviewerFooterYear').textContent = String(new Date().getFullYear());
    renderReviewerDashboard();
  }

  function logoutReviewer() {
    clearTabSession();
    reviewerSession = false;
    reviewerView.hidden = true;
    reviewerLoginView.hidden = true;
    loginView.hidden = false;
    reviewerPinInput.value = '';
    reviewerLoginError.hidden = true;
    accountSelect.focus();
  }

  function renderReviewerDashboard() {
    if (!reviewerSession) return;
    const applications = Array.isArray(db.creditApplications) ? db.creditApplications : [];
    const pending = applications.filter((item) => (item.status || 'En revisión') === 'En revisión').length;
    const approved = applications.filter((item) => ['Aprobado', 'Desembolsado', 'Pagado'].includes(item.status)).length;
    const rejected = applications.filter((item) => item.status === 'Rechazado').length;
    $('#reviewerCountAll').textContent = String(applications.length);
    $('#reviewerCountPending').textContent = String(pending);
    $('#reviewerCountApproved').textContent = String(approved);
    $('#reviewerCountRejected').textContent = String(rejected);
    $('#reviewerFundTotal').textContent = money(totalAnalystBalance());
    $('#reviewerFundCommitted').textContent = money(outstandingLoanPrincipalAcrossSystem());
    $('#reviewerFundAvailable').textContent = money(availableAnalystCapital());
    $('#reviewerFundInterest').textContent = money(totalInterestEarned());
    const feesMetric = $('#reviewerFundFees');
    if (feesMetric) feesMetric.textContent = money(totalAdvanceFeesEarned());
    const operationFeesMetric = $('#reviewerFundOperationFees');
    if (operationFeesMetric) operationFeesMetric.textContent = money(totalOperationFeesEarned());
    renderReviewerApplications();
    renderReviewerLimitIncreaseRequests();
  }
