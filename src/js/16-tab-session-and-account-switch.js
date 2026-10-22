  // Sesión aislada por pestaña: al duplicar una pestaña del navegador se copia la cuenta activa;
  // cambiarla en una pestaña no cambia el titular seleccionado en las demás.
  const TAB_SESSION_KEY = 'cajero_virtual_tab_session_v1';

  function persistTabSession(role, accountId = null) {
    try {
      sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify({ role, accountId, savedAt: Date.now() }));
    } catch (error) {
      // La aplicación sigue funcionando si el navegador bloquea sessionStorage.
    }
  }

  function clearTabSession() {
    try { sessionStorage.removeItem(TAB_SESSION_KEY); } catch (error) { /* almacenamiento opcional */ }
  }

  function syncQuickAccountSelector() {
    const selector = $('#quickAccountSelect');
    if (selector && activeAccountId !== null) selector.value = String(activeAccountId);
  }

  function switchAccountInCurrentTab(accountId) {
    const numericId = Number(accountId);
    if (!Number.isInteger(numericId) || numericId < 1 || numericId > MAX_ACCOUNT_ID || !db.accounts[numericId]) {
      syncQuickAccountSelector();
      return;
    }
    if (reviewerSession || (typeof treasurySession !== 'undefined' && treasurySession)) return;
    activeAccountId = numericId;
    persistTabSession('client', numericId);
    loginView.hidden = true;
    reviewerLoginView.hidden = true;
    reviewerView.hidden = true;
    appView.hidden = false;
    const selectedAccount = account();
    resetDailyWithdrawalIfNeeded(selectedAccount);
    renderApp();
    syncQuickAccountSelector();
    showView(currentView);
    showToast(`Cuenta cambiada a ${selectedAccount.name}.`);
  }

  const quickAccountSelect = $('#quickAccountSelect');
  if (quickAccountSelect) {
    quickAccountSelect.addEventListener('change', () => switchAccountInCurrentTab(quickAccountSelect.value));
  }

  // Cuando otra pestaña realiza una operación, actualiza esta vista sin alterar su cuenta activa.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    // El módulo de tiempo real centraliza la recarga para evitar dobles renderizados
    // cuando BroadcastChannel y storage anuncian la misma escritura. El fallback
    // conserva el comportamiento anterior si el módulo no está disponible.
    if (typeof handleRealtimeExternalChange === 'function') {
      handleRealtimeExternalChange('storage', event);
      return;
    }
    dbRevision += 1;
    db = loadDatabase();
    if (reviewerSession && !reviewerView.hidden) {
      renderReviewerDashboard();
      return;
    }
    if (activeAccountId !== null && !appView.hidden) {
      renderApp();
      syncQuickAccountSelector();
    }
  });

  // Restauración de la sesión solo en esta pestaña. sessionStorage se copia al duplicar
  // una pestaña en navegadores comunes y luego diverge de forma independiente.
  try {
    const rawTabSession = sessionStorage.getItem(TAB_SESSION_KEY);
    const tabSession = rawTabSession ? JSON.parse(rawTabSession) : null;
    if (tabSession?.role === 'client' && Number.isInteger(Number(tabSession.accountId)) && Number(tabSession.accountId) >= 1 && Number(tabSession.accountId) <= MAX_ACCOUNT_ID && db.accounts[Number(tabSession.accountId)]) {
      activeAccountId = Number(tabSession.accountId);
      reviewerSession = false;
      loginView.hidden = true;
      reviewerLoginView.hidden = true;
      reviewerView.hidden = true;
      appView.hidden = false;
      resetDailyWithdrawalIfNeeded(account());
      renderApp();
      syncQuickAccountSelector();
      showView('overview');
    } else if (tabSession?.role === 'analyst') {
      activeAccountId = null;
      reviewerSession = true;
      loginView.hidden = true;
      reviewerLoginView.hidden = true;
      appView.hidden = true;
      reviewerView.hidden = false;
      $('#reviewerFooterYear').textContent = String(new Date().getFullYear());
      renderReviewerDashboard();
    }
  } catch (error) {
    clearTabSession();
  }
