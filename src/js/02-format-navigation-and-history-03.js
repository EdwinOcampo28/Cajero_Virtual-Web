  function renderApp() {
    const current = account();
    if (!current) return;
    resetDailyWithdrawalIfNeeded(current);
    $('#profileInitials').textContent = initials(current.name);
    $('#profileName').textContent = current.name;
    $('#profileAccount').textContent = `Ahorros · ${current.accountNumber.slice(-4)}`;
    $('#welcomeTitle').innerHTML = `Hola, ${escapeHTML(current.name.split(' ')[0])} <span class="wave-emoji">✦</span>`;
    $('#balanceAccountNumber').textContent = `N.º ${current.accountNumber}`;
    $('#balanceAccountHolder').textContent = current.name;
    $('#balanceAmount').textContent = money(current.balance);
    $('#balanceUpdated').textContent = `Actualizado a las ${new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date())}`;
    $('#withdrawnAmount').textContent = money(current.withdrawnToday);
    $('#withdrawLimitText').textContent = `Máx. ${moneyShort(MAX_WITHDRAWAL_AMOUNT)} por retiro`;
    $('#withdrawnCaption').textContent = 'Acumulado de hoy';
    $('#movementCount').textContent = String(current.history.length);
    $('#currentDate').textContent = capitalize(fullDate());
    $('#footerYear').textContent = String(new Date().getFullYear());
    $('#historyFooterYear').textContent = String(new Date().getFullYear());
    $('#financeFooterYear').textContent = String(new Date().getFullYear());
    $('#financialHistoryFooterYear').textContent = String(new Date().getFullYear());
    renderRecentMovements();
    if (currentView === 'history') renderHistory();
    if (currentView === 'finance') { renderLoans(); renderCardView(); }
    if (currentView === 'financial-history') { renderFinancialHistories(); renderCreditApplications(); }
  }

  function renderRecentMovements() {
    const current = account();
    const container = $('#recentMovements');
    container.replaceChildren();
    const items = current.history.slice(0, 4);
    if (items.length === 0) {
      container.append(createEmptyRecent());
      return;
    }
    items.forEach((item) => container.append(createMovementRow(item)));
  }

  function createEmptyRecent() {
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    wrap.innerHTML = '<span class="empty-icon">↻</span><strong>Aún no tienes movimientos</strong><p>Realiza un depósito, retiro o transferencia para ver tu actividad aquí.</p>';
    return wrap;
  }

  function renderHistory() {
    const current = account();
    if (!current) return;
    resetDailyWithdrawalIfNeeded(current);
    $('#historyTotal').textContent = String(current.history.length);
    $('#historyBalance').textContent = money(current.balance);
    $('#historyWithdrawals').textContent = money(current.withdrawnToday);
    const container = $('#allMovements');
    container.replaceChildren();
    const filter = historyFilter.value;
    const filtered = current.history.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'fees') return item.type === 'operation_fee';
      if (filter === 'credit') return ['credit_disbursement', 'loan_payment', 'loan_abono', 'card_disbursement', 'card_funds_transfer', 'card_funds_sent', 'card_advance', 'card_advance_sent', 'card_advance_received', 'card_advance_fee', 'card_payment', 'card_interest'].includes(item.type);
      return item.type === filter;
    });
    $('#emptyHistory').hidden = filtered.length !== 0;
    container.hidden = filtered.length === 0;
    filtered.forEach((item) => container.append(createMovementRow(item)));
  }
