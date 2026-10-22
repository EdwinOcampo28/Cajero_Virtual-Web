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

  function renderTreasuryView(persistCatchup = false) {
    if (!treasurySession || !db?.withdrawalTreasury) return;
    const treasury = db.withdrawalTreasury;
    const caughtUp = accrueWithdrawalTreasury(db);
    $('#treasuryBalance').textContent = money(treasury.balance);
    $('#treasuryElapsed').textContent = formatTreasuryElapsed(treasury.elapsedSeconds);
    $('#treasuryTimerTotal').textContent = money(treasury.timerIncomeTotal ?? treasury.elapsedSeconds);
    $('#treasuryTransferHint').textContent = `Saldo actual de tesorería: ${money(treasury.balance)}. Transferencia sin comisión, limitada por tu saldo y el máximo de ahorros de la cuenta destino.`;
    const destination = $('#treasuryDestination');
    if (destination) {
      const selected = destination.value;
      destination.replaceChildren();
      for (let id = 1; id <= MAX_ACCOUNT_ID; id += 1) {
        const option = document.createElement('option');
        option.value = String(id);
        option.textContent = `${db.accounts[id].name} · •••• ${db.accounts[id].accountNumber.slice(-4)}`;
        destination.append(option);
      }
      if ([...destination.options].some((option) => option.value === selected)) destination.value = selected;
    }
    if (persistCatchup && (caughtUp || JSON.stringify(db) !== lastPersistedRaw)) {
      if (readCurrentStorageRaw() === lastPersistedRaw) saveDatabase();
    }
  }

  function startTreasuryTimer() {
    if (treasuryTimerId !== null) return;
    treasuryLastSavedAt = Date.now();
    treasuryTimerId = window.setInterval(() => {
      if (!treasurySession || treasuryView.hidden) return;
      accrueWithdrawalTreasury(db);
      const now = Date.now();
      if (now - treasuryLastSavedAt >= 15000) {
        if (saveDatabase()) treasuryLastSavedAt = now;
        else { renderTreasuryView(true); return; }
      }
      renderTreasuryView();
    }, 1000);
  }

  function stopTreasuryTimer() {
    if (treasuryTimerId !== null) window.clearInterval(treasuryTimerId);
    treasuryTimerId = null;
  }

  function treasuryTransferProblem(message) {
    const error = $('#treasuryTransferError');
    error.textContent = message;
    error.hidden = false;
    $('#treasuryAmount').setAttribute('aria-invalid', 'true');
    $('#treasuryAmount').focus();
  }

  function submitTreasuryTransfer(event) {
    event.preventDefault();
    if (!treasurySession || !db?.withdrawalTreasury) return;
    const transactionRevision = captureDatabaseRevision();
    if (!isDatabaseRevisionCurrent(transactionRevision)) {
      abortStaleFinancialOperation();
      return;
    }
    const amount = Number($('#treasuryAmount').value);
    const destinationId = Number($('#treasuryDestination').value);
    const error = $('#treasuryTransferError');
    error.hidden = true;
    $('#treasuryAmount').setAttribute('aria-invalid', 'false');
    if (!Number.isSafeInteger(amount) || amount <= 0) return treasuryTransferProblem('Ingresa un monto entero mayor que cero.');
    if (!Number.isInteger(destinationId) || destinationId < 1 || destinationId > MAX_ACCOUNT_ID || !db.accounts[destinationId]) return treasuryTransferProblem('Selecciona una de las tres cuentas de ahorro.');
    accrueWithdrawalTreasury(db);
    const treasury = db.withdrawalTreasury;
    if (amount > treasury.balance) return treasuryTransferProblem(`Saldo insuficiente. Tesorería dispone de ${money(treasury.balance)}.`);
    const destination = db.accounts[destinationId];
    if (destination.balance + amount > MAX_ACCOUNT_BALANCE) return treasuryTransferProblem(`La cuenta de ${destination.name} solo puede recibir ${money(MAX_ACCOUNT_BALANCE - destination.balance)} más por su límite de ahorro.`);
    treasury.balance -= amount;
    destination.balance = roundMoney(destination.balance + amount);
    recordTreasuryMovement('treasury_transfer', amount, `Transferencia enviada a ${destination.name}`, 'out');
    recordMovement(destinationId, 'transfer', amount, `Transferencia recibida de ${TREASURY_NAME}`, 'in');
    if (!saveDatabase()) return;
    $('#treasuryAmount').value = '';
    renderTreasuryView();
    showToast(`${money(amount)} transferidos a ${destination.name}.`);
  }

  treasuryAccessButton.addEventListener('click', enterTreasuryLogin);
  $('#backFromTreasuryLogin').addEventListener('click', returnFromTreasuryLogin);
  treasuryLoginForm.addEventListener('submit', loginTreasury);
  treasuryPinInput.addEventListener('input', () => {
    treasuryPinInput.value = treasuryPinInput.value.replace(/\D/g, '').slice(0, 4);
    treasuryLoginError.hidden = true;
    treasuryPinInput.setAttribute('aria-invalid', 'false');
  });
  $('#treasuryTransferForm').addEventListener('submit', submitTreasuryTransfer);
  $('#treasuryAmount').addEventListener('input', () => {
    $('#treasuryTransferError').hidden = true;
    $('#treasuryAmount').setAttribute('aria-invalid', 'false');
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
    $('#treasuryAmount').value = '';
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
