  let treasuryTimerId = null;
  let treasuryLastSavedAt = 0;

  function enterTreasuryLogin() {
    loginView.hidden = true;
    reviewerLoginView.hidden = true;
    reviewerView.hidden = true;
    if (appView) appView.hidden = true;
    treasuryView.hidden = true;
    treasuryLoginView.hidden = false;
    treasuryLoginError.hidden = true;
    treasuryPinInput.value = '';
    treasuryPinInput.focus();
  }

  function returnFromTreasuryLogin() {
    treasuryLoginView.hidden = true;
    treasuryView.hidden = true;
    treasuryLoginError.hidden = true;
    treasuryPinInput.value = '';
    loginView.hidden = false;
    accountSelect.focus();
  }

  function loginTreasury(event) {
    event.preventDefault();
    const suppliedPin = treasuryPinInput.value.trim();
    if (!/^\d{4}$/.test(suppliedPin) || suppliedPin !== TREASURY_PIN) {
      treasuryLoginError.textContent = 'PIN incorrecto. Verifica los cuatro dígitos e inténtalo de nuevo.';
      treasuryLoginError.hidden = false;
      treasuryPinInput.setAttribute('aria-invalid', 'true');
      treasuryPinInput.focus();
      return;
    }
    activeAccountId = null;
    reviewerSession = false;
    treasurySession = true;
    persistTabSession('treasury', null);
    loginView.hidden = true;
    reviewerLoginView.hidden = true;
    reviewerView.hidden = true;
    appView.hidden = true;
    treasuryLoginView.hidden = true;
    treasuryView.hidden = false;
    treasuryPinInput.value = '';
    treasuryLoginError.hidden = true;
    renderTreasuryView(true);
    startTreasuryTimer();
  }

  function formatTreasuryElapsed(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
  }

  function renderTreasuryView(refreshHistory = false) {
    if (!treasurySession || !db?.withdrawalTreasury) return;
    const treasury = db.withdrawalTreasury;
    $('#treasuryBalance').textContent = money(treasury.balance);
    $('#treasuryElapsed').textContent = formatTreasuryElapsed(treasury.elapsedSeconds);
    $('#treasuryTimerTotal').textContent = money(treasury.timerIncomeTotal ?? treasury.elapsedSeconds);
    const settings = simulationSettingsFor(db);
    $('#treasuryTimerRateText').textContent = `${money(settings.treasuryTimerRate)} por segundo`;

    $('#treasuryTimerUnlimitedHint').textContent = 'Acumulación sin tope';

    if (refreshHistory) renderTreasuryHistory(treasury.history);
  }

  function renderTreasuryHistory(history) {
    const container = $('#treasuryHistory');
    const emptyState = $('#treasuryHistoryEmpty');
    const visibleMovements = (Array.isArray(history) ? history : []).filter((item) => item && ['deposit_funded', 'withdrawal_received', 'equal_distribution'].includes(item.type));
    const rows = document.createDocumentFragment();
    visibleMovements.forEach((item) => rows.append(createMovementRow(item)));
    container.replaceChildren(rows);
    emptyState.hidden = visibleMovements.length > 0;
  }

  function startTreasuryTimer() {
    if (treasuryTimerId !== null) return;
    treasuryTimerId = window.setInterval(() => {
      if (!treasurySession || treasuryView.hidden) return;
      renderTreasuryView();
    }, 1000);
  }

  function stopTreasuryTimer() {
    if (treasuryTimerId !== null) window.clearInterval(treasuryTimerId);
    treasuryTimerId = null;
  }

  treasuryAccessButton.addEventListener('click', enterTreasuryLogin);
  $('#backFromTreasuryLogin').addEventListener('click', returnFromTreasuryLogin);
  treasuryLoginForm.addEventListener('submit', loginTreasury);
  treasuryPinInput.addEventListener('input', () => {
    treasuryPinInput.value = treasuryPinInput.value.replace(/\D/g, '').slice(0, 4);
    treasuryLoginError.hidden = true;
    treasuryPinInput.setAttribute('aria-invalid', 'false');
  });
  $('#treasuryLogoutButton').addEventListener('click', logoutTreasury);

  function logoutTreasury() {
    stopTreasuryTimer();
    clearTabSession();
    treasurySession = false;
    activeAccountId = null;
    treasuryView.hidden = true;
    treasuryLoginView.hidden = true;
    loginView.hidden = false;
    treasuryPinInput.value = '';
    treasuryLoginError.hidden = true;
    accountSelect.focus();
  }

  try {
    const rawTabSession = sessionStorage.getItem(TAB_SESSION_KEY);
    const tabSession = rawTabSession ? JSON.parse(rawTabSession) : null;
    if (tabSession?.role === 'treasury') {
      activeAccountId = null;
      reviewerSession = false;
      treasurySession = true;
      loginView.hidden = true;
      reviewerLoginView.hidden = true;
      reviewerView.hidden = true;
      appView.hidden = true;
      treasuryLoginView.hidden = true;
      treasuryView.hidden = false;
      renderTreasuryView(true);
      startTreasuryTimer();
    }
  } catch (error) {
    // Si sessionStorage no está disponible, el acceso sigue funcionando desde el botón de entrada.
  }
