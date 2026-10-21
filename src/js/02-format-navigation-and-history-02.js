  function showView(viewName) {
    if (viewName === 'history') currentView = 'history';
    else if (viewName === 'financial-history') currentView = 'financial-history';
    else if (['finance', 'credits', 'card'].includes(viewName)) currentView = 'finance';
    else currentView = 'overview';
    $('#overviewView').hidden = currentView !== 'overview';
    $('#historyView').hidden = currentView !== 'history';
    $('#financeView').hidden = currentView !== 'finance';
    $('#financialHistoryView').hidden = currentView !== 'financial-history';
    $('#breadcrumbCurrent').textContent = currentView === 'history' ? 'Movimientos' : currentView === 'financial-history' ? 'Historiales' : currentView === 'finance' ? 'Tarjeta y créditos' : 'Resumen';
    document.querySelectorAll('.nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === currentView);
      if (button.dataset.view === currentView) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    sidebar.classList.remove('open');
    if (currentView === 'history') renderHistory();
    if (currentView === 'finance') {
      updateCreditSimulation();
      renderLoans();
      renderCardView();
    }
    if (currentView === 'financial-history') {
      renderFinancialHistories();
      renderCreditApplications();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function login(accountId, pin) {
    const selected = db.accounts[accountId];
    if (!selected || selected.pin !== pin) {
      loginError.textContent = 'PIN incorrecto. Verifica la cuenta y vuelve a intentarlo.';
      loginError.hidden = false;
      pinInput.setAttribute('aria-invalid', 'true');
      pinInput.focus();
      return;
    }
    activeAccountId = accountId;
    resetDailyWithdrawalIfNeeded(selected);
    saveDatabase();
    loginError.hidden = true;
    pinInput.removeAttribute('aria-invalid');
    pinInput.value = '';
    loginView.hidden = true;
    reviewerLoginView.hidden = true;
    reviewerView.hidden = true;
    reviewerSession = false;
    appView.hidden = false;
    renderApp();
    showView('overview');
    showToast(`Bienvenido, ${selected.name.split(' ')[0]}.`);
  }

  function logout() {
    closeModal();
    activeAccountId = null;
    loginView.hidden = false;
    reviewerLoginView.hidden = true;
    reviewerView.hidden = true;
    reviewerSession = false;
    appView.hidden = true;
    pinInput.value = '';
    loginError.hidden = true;
    pinInput.removeAttribute('aria-invalid');
    accountSelect.focus();
    showToast('Sesión cerrada correctamente.');
  }
