'use strict';

(() => {
  const STORAGE_KEY = 'cajero_virtual_savings_v1';
  const MAX_WITHDRAWAL_AMOUNT = 3000000;
  const MAX_DEPOSIT_AMOUNT = 3000000;
  const MAX_ACCOUNT_BALANCE = 100000000;
  const MIN_CREDIT_AMOUNT = 100000;
  const MAX_CREDIT_AMOUNT = 100000000;
  const ILLUSTRATIVE_MONTHLY_RATE = 0.0213;
  const REVIEWER_PIN = '482917';
  const REVIEWER_NAME = 'Analista de créditos';
  const VALID_CREDIT_TERMS = [6, 12, 18, 24, 36, 48, 60];
  const QUICK_WITHDRAW_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 1500000, 2000000, 3000000];
  const QUICK_DEPOSIT_AMOUNTS = [100000, 250000, 500000, 1000000, 1500000, 2000000, 2500000, 3000000];
  const ACCOUNT_SEED = [
    null,
    { id: 1, name: 'Edwin Ocampo', accountNumber: '7184 3059 6247', accountType: 'Cuenta de ahorros', pin: '5837', balance: 0, withdrawnToday: 0, withdrawalDate: localDateKey(), history: [] },
    { id: 2, name: 'Pedro Ocampo', accountNumber: '4927 8613 5704', accountType: 'Cuenta de ahorros', pin: '9146', balance: 0, withdrawnToday: 0, withdrawalDate: localDateKey(), history: [] },
    { id: 3, name: 'Reinel Ocampo', accountNumber: '8361 4925 7083', accountType: 'Cuenta de ahorros', pin: '7269', balance: 0, withdrawnToday: 0, withdrawalDate: localDateKey(), history: [] }
  ];

  const $ = (selector) => document.querySelector(selector);
  const loginView = $('#loginView');
  const appView = $('#appView');
  const reviewerLoginView = $('#reviewerLoginView');
  const reviewerView = $('#reviewerView');
  const reviewerAccessButton = $('#reviewerAccessButton');
  const reviewerLoginForm = $('#reviewerLoginForm');
  const reviewerPinInput = $('#reviewerPinInput');
  const reviewerLoginError = $('#reviewerLoginError');
  const reviewerFilter = $('#reviewerFilter');
  const reviewerApplicationsList = $('#reviewerApplicationsList');
  const loginForm = $('#loginForm');
  const accountSelect = $('#accountSelect');
  const pinInput = $('#pinInput');
  const loginError = $('#loginError');
  const togglePin = $('#togglePin');
  const modalOverlay = $('#modalOverlay');
  const operationForm = $('#operationForm');
  const operationError = $('#operationError');
  const amountInput = $('#amountInput');
  const destinationSelect = $('#destinationSelect');
  const destinationField = $('#destinationField');
  const historyFilter = $('#historyFilter');
  const creditForm = $('#creditForm');
  const creditAmountInput = $('#creditAmountInput');
  const creditTermSelect = $('#creditTermSelect');
  const creditIncomeInput = $('#creditIncomeInput');
  const creditPurposeSelect = $('#creditPurposeSelect');
  const creditEmploymentSelect = $('#creditEmploymentSelect');
  const creditError = $('#creditError');
  const sidebar = $('#sidebar');
  let db = loadDatabase();
  let activeAccountId = null;
  let reviewerSession = false;
  let currentModalAction = null;
  let currentView = 'overview';
  let toastTimer = null;
  let previousFocusedElement = null;

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function loadDatabase() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return freshDatabase();
      const parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.accounts) || parsed.accounts.length !== 4 || !parsed.accounts[1]) {
        return freshDatabase();
      }
      parsed.creditApplications = Array.isArray(parsed.creditApplications)
        ? parsed.creditApplications
            .filter((item) => item && Number.isInteger(item.accountId) && item.accountId >= 1 && item.accountId <= 3 && typeof item.amount === 'number' && Number.isFinite(item.amount) && typeof item.date === 'string')
            .slice(0, 500)
            .map((item) => ({ ...item, status: item.status || 'En revisión', monthlyRate: Number.isFinite(item.monthlyRate) ? item.monthlyRate : 0.015 }))
        : [];
      parsed.loans = Array.isArray(parsed.loans)
        ? parsed.loans.filter((loan) => loan && typeof loan.id === 'string' && Number.isInteger(loan.accountId) && loan.accountId >= 1 && loan.accountId <= 3 && Number.isFinite(loan.outstandingPrincipal))
        : [];
      for (let i = 1; i <= 3; i += 1) {
        const saved = parsed.accounts[i];
        const seed = ACCOUNT_SEED[i];
        if (!saved || saved.id !== i || typeof saved.balance !== 'number' || !Array.isArray(saved.history)) {
          return freshDatabase();
        }
        saved.name = seed.name;
        saved.accountNumber = seed.accountNumber;
        saved.accountType = seed.accountType;
        saved.pin = seed.pin;
        saved.balance = Math.round(saved.balance);
        saved.withdrawnToday = Number.isFinite(saved.withdrawnToday) ? Math.round(saved.withdrawnToday) : 0;
        saved.history = saved.history.map((item) => ({ ...item, amount: Math.round(Number(item.amount) || 0) }));
        saved.withdrawalDate = saved.withdrawalDate || localDateKey();
      }
      return parsed;
    } catch (error) {
      return freshDatabase();
    }
  }

  function freshDatabase() {
    return { accounts: ACCOUNT_SEED.map((account) => account ? { ...account, history: [] } : null), creditApplications: [], loans: [] };
  }

  function saveDatabase() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (error) {
      showToast('No se pudo guardar en este navegador. Comprueba el almacenamiento disponible.', 'error');
    }
  }

  function resetDailyWithdrawalIfNeeded(account) {
    const today = localDateKey();
    if (account.withdrawalDate !== today) {
      account.withdrawnToday = 0;
      account.withdrawalDate = today;
    }
  }

  function money(value, includeCurrency = true) {
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(Number(value) || 0));
    return includeCurrency ? `$ ${formatted}` : formatted;
  }

  function moneyShort(value) {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
  }

  function account() {
    return activeAccountId === null ? null : db.accounts[activeAccountId];
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  }

  function fullDate(date = new Date()) {
    return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  function shortDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
  }

  function recordMovement(accountId, type, amount, description, direction = null) {
    const item = {
      id: createId(),
      type,
      amount: roundMoney(amount),
      description,
      direction,
      date: new Date().toISOString()
    };
    db.accounts[accountId].history.unshift(item);
    return item;
  }

  function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function roundMoney(value) {
    return Math.round(Number(value) || 0);
  }

  function showView(viewName) {
    currentView = ['history', 'credits'].includes(viewName) ? viewName : 'overview';
    $('#overviewView').hidden = currentView !== 'overview';
    $('#historyView').hidden = currentView !== 'history';
    $('#creditsView').hidden = currentView !== 'credits';
    $('#breadcrumbCurrent').textContent = currentView === 'history' ? 'Movimientos' : currentView === 'credits' ? 'Créditos' : 'Resumen';
    document.querySelectorAll('.nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === currentView);
      if (button.dataset.view === currentView) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    sidebar.classList.remove('open');
    if (currentView === 'history') renderHistory();
    if (currentView === 'credits') {
      updateCreditSimulation();
      renderCreditApplications();
      renderLoans();
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
    $('#creditsFooterYear').textContent = String(new Date().getFullYear());
    renderRecentMovements();
    if (currentView === 'history') renderHistory();
    if (currentView === 'credits') { renderCreditApplications(); renderLoans(); }
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
      if (filter === 'credit') return ['credit_disbursement', 'loan_payment', 'loan_abono'].includes(item.type);
      return item.type === filter;
    });
    $('#emptyHistory').hidden = filtered.length !== 0;
    container.hidden = filtered.length === 0;
    filtered.forEach((item) => container.append(createMovementRow(item)));
  }

  function createMovementRow(item) {
    const row = document.createElement('article');
    row.className = 'movement-row';
    const type = item.type;
    let icon = '＋';
    if (type === 'withdraw') icon = '↗';
    if (type === 'transfer') icon = '⇄';
    if (type === 'credit_disbursement') icon = '↙';
    if (type === 'loan_payment') icon = '↘';
    if (type === 'loan_abono') icon = '↓';
    const leading = document.createElement('div');
    leading.className = 'movement-leading';
    const iconEl = document.createElement('span');
    iconEl.className = `movement-icon ${type}`;
    iconEl.textContent = icon;
    iconEl.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'movement-copy';
    const title = document.createElement('div');
    title.className = 'movement-title';
    title.textContent = item.description;
    const meta = document.createElement('div');
    meta.className = 'movement-meta';
    meta.textContent = shortDateTime(item.date);
    copy.append(title, meta);
    leading.append(iconEl, copy);
    const trailing = document.createElement('div');
    trailing.className = 'movement-trailing';
    const amount = document.createElement('div');
    amount.className = 'movement-amount';
    if (item.direction === 'in') {
      amount.textContent = `+ ${money(item.amount)}`;
      amount.classList.add('positive');
    } else if (item.direction === 'out') {
      amount.textContent = `− ${money(item.amount)}`;
      amount.classList.add('negative');
    } else if (type === 'deposit') {
      amount.textContent = `+ ${money(item.amount)}`;
      amount.classList.add('positive');
    } else if (type === 'withdraw') {
      amount.textContent = `− ${money(item.amount)}`;
      amount.classList.add('negative');
    } else {
      amount.textContent = money(item.amount);
    }
    const status = document.createElement('div');
    status.className = 'movement-status';
    status.textContent = 'Registrado';
    trailing.append(amount, status);
    row.append(leading, trailing);
    return row;
  }

  function calculateCreditEstimate(principal, months) {
    const amount = Math.round(Number(principal) || 0);
    const term = Math.max(1, Math.round(Number(months) || 1));
    if (amount <= 0) return { monthlyPayment: 0, totalPayable: 0, totalInterest: 0 };
    const rate = ILLUSTRATIVE_MONTHLY_RATE;
    const monthlyPayment = Math.round(amount * rate / (1 - Math.pow(1 + rate, -term)));
    let balance = amount;
    let totalPayable = 0;
    let totalInterest = 0;
    let count = 0;
    while (balance > 0 && count < term + 5) {
      const interest = Math.round(balance * rate);
      const payment = Math.min(monthlyPayment, balance + interest);
      const principalPaid = Math.min(balance, Math.max(0, payment - interest));
      if (principalPaid <= 0) break;
      balance = Math.max(0, balance - principalPaid);
      totalPayable += payment;
      totalInterest += interest;
      count += 1;
    }
    return { monthlyPayment, totalPayable, totalInterest, actualMonths: count };
  }

  function addMonthsToDate(dateLike, months) {
    const source = typeof dateLike === 'string' ? dateLike.slice(0, 10) : localDateKey(dateLike);
    const [year, month, day] = source.split('-').map(Number);
    const base = new Date(year, month - 1, 1);
    base.setMonth(base.getMonth() + months);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(day, lastDay));
    return localDateKey(base);
  }

  function createLoanFromApplication(application) {
    const estimate = calculateCreditEstimate(application.amount, application.termMonths);
    const disbursedAt = new Date().toISOString();
    return {
      id: createId(),
      applicationId: application.id,
      accountId: application.accountId,
      principalOriginal: roundMoney(application.amount),
      outstandingPrincipal: roundMoney(application.amount),
      monthlyRate: Number.isFinite(application.monthlyRate) ? application.monthlyRate : ILLUSTRATIVE_MONTHLY_RATE,
      termMonths: Number(application.termMonths) || 60,
      monthlyPayment: roundMoney(estimate.monthlyPayment),
      installmentsPaid: 0,
      nextDueDate: addMonthsToDate(disbursedAt, 1),
      disbursedAt,
      status: 'Activo',
      payments: []
    };
  }

  function nextInstallmentFor(loan) {
    const balance = Math.max(0, roundMoney(loan.outstandingPrincipal));
    if (balance <= 0) return { paymentAmount: 0, interest: 0, principal: 0, dueDate: loan.nextDueDate, installmentNumber: loan.installmentsPaid + 1 };
    const interest = Math.round(balance * loan.monthlyRate);
    const paymentAmount = Math.min(roundMoney(loan.monthlyPayment), balance + interest);
    const principal = Math.min(balance, Math.max(0, paymentAmount - interest));
    return { paymentAmount, interest, principal, dueDate: loan.nextDueDate, installmentNumber: loan.installmentsPaid + 1 };
  }

  function estimateRemainingInstallments(loan) {
    let balance = roundMoney(loan.outstandingPrincipal);
    let count = 0;
    const monthlyPayment = roundMoney(loan.monthlyPayment);
    while (balance > 0 && count < 1200) {
      const interest = Math.round(balance * loan.monthlyRate);
      const payment = Math.min(monthlyPayment, balance + interest);
      const principal = Math.min(balance, Math.max(0, payment - interest));
      if (principal <= 0) break;
      balance = Math.max(0, balance - principal);
      count += 1;
    }
    return count;
  }

  function findLoanForApplication(applicationId) {
    return (db.loans || []).find((loan) => loan.applicationId === applicationId);
  }

  function updateCreditSimulation() {
    if (!creditAmountInput || !creditTermSelect) return;
    const amount = Math.max(0, Math.round(Number(creditAmountInput.value) || 0));
    const months = Number(creditTermSelect.value) || 60;
    const estimate = calculateCreditEstimate(amount, months);
    $('#creditMonthlyPayment').textContent = money(estimate.monthlyPayment);
    $('#creditSelectedTerm').textContent = String(months);
    $('#creditSimAmount').textContent = money(amount);
    $('#creditTotalPayable').textContent = money(estimate.totalPayable);
    $('#creditTotalInterest').textContent = money(estimate.totalInterest);
  }

  function renderCreditApplications() {
    const current = account();
    if (!current) return;
    const container = $('#creditApplicationsList');
    container.replaceChildren();
    const applications = (db.creditApplications || []).filter((item) => item.accountId === activeAccountId);
    $('#emptyCreditApplications').hidden = applications.length > 0;
    container.hidden = applications.length === 0;
    applications.forEach((item) => {
      const loan = findLoanForApplication(item.id);
      const card = document.createElement('article');
      card.className = 'credit-application-item';
      const main = document.createElement('div');
      main.className = 'credit-application-main';
      const title = document.createElement('strong');
      title.textContent = money(item.amount);
      const meta = document.createElement('span');
      meta.textContent = `${item.purpose} · ${item.termMonths} meses · Cuota original ${money(item.monthlyPayment)}`;
      const date = document.createElement('small');
      date.textContent = `Solicitada el ${shortDateTime(item.date)}`;
      main.append(title, meta, date);
      const status = document.createElement('span');
      status.className = `credit-status ${statusClass(loan && loan.status === 'Pagado' ? 'Pagado' : (item.status || 'En revisión'))}`;
      status.textContent = loan ? (loan.status === 'Pagado' ? 'Crédito pagado' : 'Desembolsado') : (item.status || 'En revisión');
      const copy = document.createElement('div');
      copy.className = 'credit-application-status';
      copy.append(status);
      if (item.reviewedAt || item.disbursedAt) {
        const reviewDate = document.createElement('small');
        reviewDate.className = 'credit-review-date';
        reviewDate.textContent = item.disbursedAt ? `Desembolsado el ${shortDateTime(item.disbursedAt)}` : `Revisada el ${shortDateTime(item.reviewedAt)}`;
        copy.append(reviewDate);
      }
      card.append(main, copy);
      if (loan) {
        const loanSummary = document.createElement('p');
        loanSummary.className = 'credit-review-note';
        loanSummary.textContent = loan.status === 'Pagado'
          ? `Crédito pagado. Total registrado en abonos y cuotas: ${money((loan.payments || []).reduce((sum, item) => sum + item.amount, 0))}.`
          : `Saldo de capital pendiente: ${money(loan.outstandingPrincipal)} · Próxima cuota: ${money(nextInstallmentFor(loan).paymentAmount)} · Vencimiento: ${loan.nextDueDate}.`;
        card.append(loanSummary);
      }
      if (item.reviewerNote) {
        const note = document.createElement('p');
        note.className = 'credit-review-note';
        note.textContent = `Nota del analista: ${item.reviewerNote}`;
        card.append(note);
      }
      container.append(card);
    });
  }

  function renderLoans() {
    const current = account();
    const container = $('#loansList');
    if (!current || !container) return;
    container.replaceChildren();
    const loans = (db.loans || []).filter((loan) => loan.accountId === activeAccountId).sort((a, b) => new Date(b.disbursedAt) - new Date(a.disbursedAt));
    $('#emptyLoans').hidden = loans.length > 0;
    container.hidden = loans.length === 0;

    loans.forEach((loan) => {
      const card = document.createElement('article');
      card.className = `loan-card${loan.status === 'Pagado' ? ' loan-paid' : ''}`;
      const header = document.createElement('div');
      header.className = 'loan-card-header';
      const titleWrap = document.createElement('div');
      const eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = `CRÉDITO · ${String(loan.id).slice(-7).toUpperCase()}`;
      const title = document.createElement('h3');
      title.textContent = loan.status === 'Pagado' ? 'Crédito finalizado' : 'Crédito activo';
      titleWrap.append(eyebrow, title);
      const status = document.createElement('span');
      status.className = `credit-status ${statusClass(loan.status === 'Pagado' ? 'Pagado' : 'Desembolsado')}`;
      status.textContent = loan.status;
      header.append(titleWrap, status);
      card.append(header);

      const stats = document.createElement('div');
      stats.className = 'loan-stats-grid';
      const next = nextInstallmentFor(loan);
      const remainingMonths = loan.status === 'Pagado' ? 0 : estimateRemainingInstallments(loan);
      const statItems = [
        ['Monto desembolsado', money(loan.principalOriginal)],
        ['Capital pendiente', money(loan.outstandingPrincipal)],
        ['Cuota siguiente', loan.status === 'Pagado' ? '—' : money(next.paymentAmount)],
        ['Interés de la cuota', loan.status === 'Pagado' ? '—' : money(next.interest)],
        ['Tasa mensual', `${(loan.monthlyRate * 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`],
        ['Cuotas pagadas', `${loan.installmentsPaid} de ${loan.termMonths}`],
        ['Plazo restante estimado', `${remainingMonths} meses`],
        [loan.status === 'Pagado' ? 'Fecha de cierre' : 'Próximo vencimiento', loan.status === 'Pagado' ? shortDateTime(loan.closedAt || new Date().toISOString()) : loan.nextDueDate]
      ];
      statItems.forEach(([label, value]) => {
        const cell = document.createElement('div');
        cell.className = 'loan-stat-cell';
        const caption = document.createElement('span');
        caption.textContent = label;
        const content = document.createElement('strong');
        content.textContent = value;
        cell.append(caption, content);
        stats.append(cell);
      });
      card.append(stats);

      if (loan.status === 'Activo') {
        const breakdown = document.createElement('p');
        breakdown.className = 'loan-breakdown-note';
        breakdown.textContent = `La próxima cuota de ${money(next.paymentAmount)} se distribuye en ${money(next.interest)} de interés y ${money(next.principal)} de capital. El pago se descuenta del saldo disponible de tu cuenta de ahorros.`;
        card.append(breakdown);
        const actions = document.createElement('div');
        actions.className = 'loan-actions';
        const payButton = document.createElement('button');
        payButton.type = 'button';
        payButton.className = 'button button-primary';
        payButton.dataset.loanPay = loan.id;
        payButton.textContent = `Pagar cuota · ${money(next.paymentAmount)}`;
        actions.append(payButton);

        const extraForm = document.createElement('form');
        extraForm.className = 'loan-extra-form';
        extraForm.dataset.loanAbonoForm = loan.id;
        const label = document.createElement('label');
        label.htmlFor = `abono-${loan.id}`;
        label.textContent = 'Abono extraordinario a capital';
        const inputWrap = document.createElement('div');
        inputWrap.className = 'loan-extra-input-wrap';
        const input = document.createElement('input');
        input.id = `abono-${loan.id}`;
        input.name = 'abonoAmount';
        input.type = 'number';
        input.inputMode = 'numeric';
        input.min = '1';
        input.max = String(Math.min(loan.outstandingPrincipal, current.balance));
        input.step = '1';
        input.placeholder = 'Monto del abono';
        input.required = true;
        const abonoButton = document.createElement('button');
        abonoButton.className = 'button button-secondary';
        abonoButton.type = 'submit';
        abonoButton.textContent = 'Abonar';
        inputWrap.append(input, abonoButton);
        const hint = document.createElement('small');
        hint.textContent = `Máximo por fondos disponibles: ${money(current.balance)}. Los abonos reducen capital y acortan el plazo estimado, manteniendo la cuota pactada.`;
        extraForm.append(label, inputWrap, hint);
        actions.append(extraForm);
        card.append(actions);
      }

      const historyDetails = document.createElement('details');
      historyDetails.className = 'loan-payment-history';
      const summary = document.createElement('summary');
      summary.textContent = `Historial de pagos (${(loan.payments || []).length})`;
      historyDetails.append(summary);
      const historyList = document.createElement('div');
      historyList.className = 'loan-payment-list';
      if (!(loan.payments || []).length) {
        const empty = document.createElement('p');
        empty.className = 'loan-payment-empty';
        empty.textContent = 'Todavía no hay cuotas ni abonos registrados.';
        historyList.append(empty);
      } else {
        loan.payments.slice().reverse().forEach((payment) => {
          const row = document.createElement('div');
          row.className = 'loan-payment-row';
          const detail = document.createElement('div');
          const detailTitle = document.createElement('strong');
          detailTitle.textContent = payment.type === 'Cuota'
            ? `Cuota ${payment.installmentNumber}`
            : payment.type === 'Liquidación' ? 'Liquidación anticipada' : 'Abono a capital';
          const meta = document.createElement('small');
          meta.textContent = `${shortDateTime(payment.date)} · Capital: ${money(payment.principal)} · Interés: ${money(payment.interest)}`;
          detail.append(detailTitle, meta);
          const amount = document.createElement('strong');
          amount.className = 'loan-payment-amount';
          amount.textContent = money(payment.amount);
          row.append(detail, amount);
          historyList.append(row);
        });
      }
      historyDetails.append(historyList);
      card.append(historyDetails);
      container.append(card);
    });
  }

  function processInstallmentPayment(loanId) {
    const loan = (db.loans || []).find((item) => item.id === loanId && item.accountId === activeAccountId);
    const current = account();
    if (!loan || !current || loan.status !== 'Activo') return;
    const installment = nextInstallmentFor(loan);
    if (installment.paymentAmount <= 0) return showToast('Este crédito ya no tiene saldo pendiente.', 'error');
    if (current.balance < installment.paymentAmount) {
      return showToast(`Saldo insuficiente. Necesitas ${money(installment.paymentAmount)} y tienes ${money(current.balance)}.`, 'error');
    }
    if (!window.confirm(`¿Pagar la cuota ${installment.installmentNumber} por ${money(installment.paymentAmount)}?\n\nCapital: ${money(installment.principal)}\nInterés: ${money(installment.interest)}\nEl dinero se descontará de tu cuenta de ahorros.`)) return;
    current.balance = roundMoney(current.balance - installment.paymentAmount);
    loan.outstandingPrincipal = Math.max(0, roundMoney(loan.outstandingPrincipal - installment.principal));
    loan.installmentsPaid += 1;
    loan.payments = Array.isArray(loan.payments) ? loan.payments : [];
    loan.payments.push({ id: createId(), type: 'Cuota', installmentNumber: installment.installmentNumber, amount: installment.paymentAmount, interest: installment.interest, principal: installment.principal, date: new Date().toISOString(), dueDate: installment.dueDate, remainingPrincipal: loan.outstandingPrincipal });
    recordMovement(activeAccountId, 'loan_payment', installment.paymentAmount, `Pago cuota ${installment.installmentNumber} de crédito ${String(loan.id).slice(-7)}`, 'out');
    if (loan.outstandingPrincipal <= 0) {
      loan.outstandingPrincipal = 0;
      loan.status = 'Pagado';
      loan.closedAt = new Date().toISOString();
      const application = (db.creditApplications || []).find((item) => item.id === loan.applicationId);
      if (application) application.status = 'Pagado';
    } else {
      loan.nextDueDate = addMonthsToDate(loan.nextDueDate, 1);
    }
    saveDatabase();
    renderApp();
    renderLoans();
    renderCreditApplications();
    showToast(`Cuota ${installment.installmentNumber} pagada: ${money(installment.paymentAmount)}.`);
  }

  function processCapitalAbono(loanId, rawAmount) {
    const loan = (db.loans || []).find((item) => item.id === loanId && item.accountId === activeAccountId);
    const current = account();
    const amount = Number(rawAmount);
    if (!loan || !current || loan.status !== 'Activo') return;
    if (!Number.isInteger(amount) || amount <= 0) return showToast('Ingresa un abono entero mayor que cero.', 'error');
    if (amount > current.balance) return showToast(`No tienes saldo suficiente. Tu saldo disponible es ${money(current.balance)}.`, 'error');
    if (amount > loan.outstandingPrincipal) return showToast(`El abono no puede superar el capital pendiente de ${money(loan.outstandingPrincipal)}.`, 'error');
    const willClose = amount === loan.outstandingPrincipal;
    if (!window.confirm(`¿Confirmas el abono a capital por ${money(amount)}?\n\nEste abono se descuenta de tus ahorros y ${willClose ? 'liquidará el capital pendiente del crédito.' : 'reducirá el capital y el plazo estimado, manteniendo la cuota pactada.'}`)) return;
    current.balance = roundMoney(current.balance - amount);
    loan.outstandingPrincipal = Math.max(0, roundMoney(loan.outstandingPrincipal - amount));
    loan.payments = Array.isArray(loan.payments) ? loan.payments : [];
    loan.payments.push({ id: createId(), type: willClose ? 'Liquidación' : 'Abono a capital', amount, interest: 0, principal: amount, date: new Date().toISOString(), dueDate: loan.nextDueDate, remainingPrincipal: loan.outstandingPrincipal });
    recordMovement(activeAccountId, 'loan_abono', amount, `${willClose ? 'Liquidación' : 'Abono a capital'} de crédito ${String(loan.id).slice(-7)}`, 'out');
    if (loan.outstandingPrincipal <= 0) {
      loan.outstandingPrincipal = 0;
      loan.status = 'Pagado';
      loan.closedAt = new Date().toISOString();
      const application = (db.creditApplications || []).find((item) => item.id === loan.applicationId);
      if (application) application.status = 'Pagado';
    }
    saveDatabase();
    renderApp();
    renderLoans();
    renderCreditApplications();
    showToast(willClose ? 'Crédito liquidado por anticipado.' : `Abono a capital de ${money(amount)} registrado.`);
  }

  function statusClass(status) {
    if (['Aprobado', 'Desembolsado', 'Pagado'].includes(status)) return 'status-approved';
    if (status === 'Rechazado') return 'status-rejected';
    return 'status-pending';
  }

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
    renderReviewerApplications();
  }

  function renderReviewerApplications() {
    if (!reviewerSession || !reviewerApplicationsList) return;
    const allApplications = Array.isArray(db.creditApplications) ? db.creditApplications : [];
    const filter = reviewerFilter.value;
    const applications = allApplications.filter((item) => {
      const status = item.status || 'En revisión';
      if (filter === 'pending') return status === 'En revisión';
      if (filter === 'approved') return ['Aprobado', 'Desembolsado', 'Pagado'].includes(status);
      if (filter === 'rejected') return status === 'Rechazado';
      return true;
    });
    reviewerApplicationsList.replaceChildren();
    $('#reviewerEmptyState').hidden = applications.length > 0;
    reviewerApplicationsList.hidden = applications.length === 0;

    applications.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'reviewer-application-card';
      const heading = document.createElement('div');
      heading.className = 'reviewer-card-heading';
      const applicant = document.createElement('div');
      applicant.className = 'reviewer-applicant';
      const name = document.createElement('h3');
      name.textContent = item.applicantName || db.accounts[item.accountId]?.name || 'Cliente';
      const accountLine = document.createElement('p');
      accountLine.textContent = `Cuenta •••• ${(item.accountNumber || db.accounts[item.accountId]?.accountNumber || '').replace(/\s/g, '').slice(-4)} · Solicitud ${String(item.id).slice(-7)}`;
      const requested = document.createElement('strong');
      requested.className = 'reviewer-requested-amount';
      requested.textContent = money(item.amount);
      applicant.append(name, accountLine);
      const status = document.createElement('span');
      status.className = `credit-status ${statusClass(item.status || 'En revisión')}`;
      status.textContent = item.status || 'En revisión';
      heading.append(applicant, requested, status);

      const details = document.createElement('div');
      details.className = 'reviewer-detail-grid';
      const relatedLoan = findLoanForApplication(item.id);
      const detailRows = [
        ['Ingresos mensuales declarados', money(item.monthlyIncome || 0)],
        ['Cuota estimada', money(item.monthlyPayment || 0)],
        ['Plazo', `${item.termMonths || 0} meses`],
        ['Tasa mensual de la solicitud', `${((Number(item.monthlyRate) || ILLUSTRATIVE_MONTHLY_RATE) * 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`],
        ['Situación laboral', item.employment || 'No indicada'],
        ['Destino', item.purpose || 'No indicado'],
        ['Total estimado', money(item.totalPayable || 0)],
        ['Fecha de solicitud', shortDateTime(item.date)],
        ...(relatedLoan ? [['Capital pendiente', money(relatedLoan.outstandingPrincipal)], ['Estado del crédito', relatedLoan.status], ['Cuotas pagadas', `${relatedLoan.installmentsPaid} de ${relatedLoan.termMonths}`]] : [])
      ];
      detailRows.forEach(([label, value]) => {
        const cell = document.createElement('div');
        cell.className = 'reviewer-detail-cell';
        const caption = document.createElement('span');
        caption.textContent = label;
        const content = document.createElement('strong');
        content.textContent = value;
        cell.append(caption, content);
        details.append(cell);
      });

      card.append(heading, details);
      if (item.reviewedAt) {
        const reviewed = document.createElement('p');
        reviewed.className = 'reviewer-decision-meta';
        reviewed.textContent = `Decisión registrada el ${shortDateTime(item.reviewedAt)} por ${item.reviewerName || REVIEWER_NAME}.`;
        card.append(reviewed);
      }
      if (item.reviewerNote) {
        const note = document.createElement('p');
        note.className = 'reviewer-existing-note';
        note.textContent = `Nota del analista: ${item.reviewerNote}`;
        card.append(note);
      }
      const normalizedStatus = item.status || 'En revisión';
      if (normalizedStatus === 'En revisión' || (normalizedStatus === 'Aprobado' && !relatedLoan)) {
        const actions = document.createElement('div');
        actions.className = 'reviewer-card-actions';
        const approve = document.createElement('button');
        approve.type = 'button';
        approve.className = 'button button-primary reviewer-approve-button';
        approve.dataset.reviewId = item.id;
        approve.dataset.reviewDecision = normalizedStatus === 'Aprobado' ? 'Desembolsar' : 'Aprobado';
        approve.textContent = normalizedStatus === 'Aprobado' ? 'Desembolsar crédito' : 'Aprobar y desembolsar';
        actions.append(approve);
        if (normalizedStatus === 'En revisión') {
          const reject = document.createElement('button');
          reject.type = 'button';
          reject.className = 'button button-secondary reviewer-reject-button';
          reject.dataset.reviewId = item.id;
          reject.dataset.reviewDecision = 'Rechazado';
          reject.textContent = 'Rechazar solicitud';
          actions.append(reject);
        }
        card.append(actions);
      }
      reviewerApplicationsList.append(card);
    });
  }

  function registerCreditDecision(applicationId, decision) {
    if (!reviewerSession || !['Aprobado', 'Rechazado', 'Desembolsar'].includes(decision)) return;
    const application = (db.creditApplications || []).find((item) => item.id === applicationId);
    if (!application) return;
    const oldApprovedWithoutLoan = application.status === 'Aprobado' && !findLoanForApplication(application.id);
    const isLegacyDisbursement = decision === 'Desembolsar' && oldApprovedWithoutLoan;
    if (decision === 'Desembolsar' && !isLegacyDisbursement) return;
    if (decision !== 'Desembolsar' && (application.status || 'En revisión') !== 'En revisión') {
      showToast('Esta solicitud ya tiene una decisión registrada.', 'error');
      return;
    }
    const targetAccount = db.accounts[application.accountId];
    if (decision === 'Aprobado' || decision === 'Desembolsar') {
      if (targetAccount.balance + application.amount > MAX_ACCOUNT_BALANCE) {
        window.alert(`No se puede desembolsar este crédito todavía. El saldo actual más el préstamo superaría el máximo de ${money(MAX_ACCOUNT_BALANCE)} de esta cuenta. El titular debe liberar saldo primero.`);
        return;
      }
    }
    const confirmText = decision === 'Rechazado'
      ? '¿Confirmas rechazar esta solicitud de crédito? No se realizará ningún desembolso.'
      : `¿Confirmas aprobar y desembolsar ${money(application.amount)} a la cuenta de ${application.applicantName || targetAccount.name}? El monto se abonará a sus ahorros y comenzará el plan de cuotas.`;
    if (!window.confirm(confirmText)) return;
    const note = window.prompt('Añade una nota breve para justificar la decisión (opcional):', application.reviewerNote || '');
    if (note === null) return;

    application.reviewerName = REVIEWER_NAME;
    application.reviewerNote = note.trim().slice(0, 500);
    application.reviewedAt = application.reviewedAt || new Date().toISOString();
    if (decision === 'Rechazado') {
      application.status = 'Rechazado';
      application.reviewerDecision = 'Rechazado';
    } else {
      const loan = createLoanFromApplication(application);
      targetAccount.balance = roundMoney(targetAccount.balance + application.amount);
      application.status = 'Desembolsado';
      application.reviewerDecision = 'Aprobado';
      application.disbursedAt = loan.disbursedAt;
      application.loanId = loan.id;
      application.monthlyPayment = loan.monthlyPayment;
      application.totalPayable = calculateCreditEstimate(loan.principalOriginal, loan.termMonths).totalPayable;
      application.totalInterest = calculateCreditEstimate(loan.principalOriginal, loan.termMonths).totalInterest;
      if (!Array.isArray(db.loans)) db.loans = [];
      db.loans.unshift(loan);
      recordMovement(application.accountId, 'credit_disbursement', application.amount, `Desembolso de crédito ${String(loan.id).slice(-7)}`, 'in');
    }
    saveDatabase();
    renderReviewerDashboard();
    showToast(decision === 'Rechazado' ? 'Solicitud rechazada. No se desembolsó dinero.' : `Crédito desembolsado: ${money(application.amount)} abonados a la cuenta.`);
  }

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
    showToast('Solicitud registrada. El analista debe aprobarla para que se realice el desembolso.');
    $('#creditApplicationsList').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function openModal(action) {
    if (action === 'balance') {
      renderApp();
      showToast(`Saldo disponible: ${money(account().balance)}.`);
      return;
    }
    const config = {
      deposit: { icon: '＋', eyebrow: 'AUMENTAR SALDO', title: 'Depositar dinero', description: 'Selecciona una cifra rápida o escribe el importe que deseas ingresar.', label: 'Monto a depositar', hint: `Máximo por depósito: ${money(MAX_DEPOSIT_AMOUNT)}. El saldo de la cuenta no puede superar ${money(MAX_ACCOUNT_BALANCE)}.` },
      withdraw: { icon: '↗', eyebrow: 'RETIRO DE EFECTIVO', title: 'Retirar dinero', description: 'Elige una cifra rápida o introduce cuánto deseas retirar.', label: 'Monto a retirar', hint: `Saldo disponible: ${money(account().balance)}. Máximo por retiro: ${money(MAX_WITHDRAWAL_AMOUNT)}.` },
      transfer: { icon: '⇄', eyebrow: 'ENVÍO ENTRE CUENTAS', title: 'Transferir dinero', description: 'Selecciona una cuenta de destino e indica el monto.', label: 'Monto a transferir', hint: `Saldo disponible: ${money(account().balance)}. No se permiten transferencias a la misma cuenta.` }
    };
    const selected = config[action];
    if (!selected) return;
    currentModalAction = action;
    previousFocusedElement = document.activeElement;
    $('#modalIcon').textContent = selected.icon;
    $('#modalEyebrow').textContent = selected.eyebrow;
    $('#modalTitle').textContent = selected.title;
    $('#modalDescription').textContent = selected.description;
    $('#amountLabel').textContent = selected.label;
    $('#operationHint').lastElementChild.textContent = selected.hint;
    $('#confirmOperationButton').innerHTML = `${action === 'deposit' ? 'Confirmar depósito' : action === 'withdraw' ? 'Confirmar retiro' : 'Confirmar transferencia'} <span aria-hidden="true">→</span>`;
    destinationField.hidden = action !== 'transfer';
    if (action === 'transfer') populateDestinations();
    const quickAmounts = $('#quickAmounts');
    quickAmounts.replaceChildren();
    const presets = action === 'deposit' ? QUICK_DEPOSIT_AMOUNTS : action === 'withdraw' ? QUICK_WITHDRAW_AMOUNTS : [];
    quickAmounts.hidden = presets.length === 0;
    presets.forEach((amount) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-amount';
      button.dataset.amount = String(amount);
      button.setAttribute('aria-pressed', 'false');
      button.textContent = money(amount);
      quickAmounts.append(button);
    });
    amountInput.step = '1';
    amountInput.min = '1';
    amountInput.removeAttribute('max');
    operationError.hidden = true;
    amountInput.value = '';
    amountInput.placeholder = '0';
    amountInput.setAttribute('aria-invalid', 'false');
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => (action === 'transfer' ? destinationSelect : amountInput).focus(), 20);
  }

  function populateDestinations() {
    destinationSelect.replaceChildren();
    for (let id = 1; id <= 3; id += 1) {
      if (id === activeAccountId) continue;
      const option = document.createElement('option');
      option.value = String(id);
      option.textContent = `Ahorros · •••• ${db.accounts[id].accountNumber.slice(-4)} · ${db.accounts[id].name}`;
      destinationSelect.append(option);
    }
  }

  function closeModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
    currentModalAction = null;
    if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') previousFocusedElement.focus();
  }

  function submitOperation(event) {
    event.preventDefault();
    if (!currentModalAction || !account()) return;
    operationError.hidden = true;
    const rawAmount = Number(amountInput.value);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || !Number.isInteger(rawAmount)) {
      return operationProblem('Ingresa un monto entero mayor que cero, sin decimales.');
    }
    const amount = roundMoney(rawAmount);
    if (currentModalAction === 'deposit' && amount > MAX_DEPOSIT_AMOUNT) {
      return operationProblem(`El depósito máximo por operación es de ${money(MAX_DEPOSIT_AMOUNT)}.`);
    }
    if (currentModalAction === 'withdraw' && amount > MAX_WITHDRAWAL_AMOUNT) {
      return operationProblem(`El retiro máximo por operación es de ${money(MAX_WITHDRAWAL_AMOUNT)}.`);
    }
    const current = account();
    resetDailyWithdrawalIfNeeded(current);

    if (currentModalAction === 'deposit') {
      if (current.balance + amount > MAX_ACCOUNT_BALANCE) {
        return operationProblem(`Este depósito superaría el saldo máximo permitido de ${money(MAX_ACCOUNT_BALANCE)}. Puedes ingresar hasta ${money(MAX_ACCOUNT_BALANCE - current.balance)} más en esta cuenta.`);
      }
      current.balance = roundMoney(current.balance + amount);
      recordMovement(activeAccountId, 'deposit', amount, 'Depósito realizado', 'in');
      finalizeOperation(`Depósito de ${money(amount)} realizado correctamente.`);
      return;
    }

    if (currentModalAction === 'withdraw') {
      if (amount > current.balance) return operationProblem('Saldo insuficiente. Reduce el monto del retiro.');
      current.balance = roundMoney(current.balance - amount);
      current.withdrawnToday = roundMoney(current.withdrawnToday + amount);
      recordMovement(activeAccountId, 'withdraw', amount, 'Retiro de efectivo', 'out');
      finalizeOperation(`Retiro de ${money(amount)} realizado correctamente.`);
      return;
    }

    if (currentModalAction === 'transfer') {
      const destinationId = Number(destinationSelect.value);
      if (!Number.isInteger(destinationId) || destinationId < 1 || destinationId > 3) return operationProblem('Selecciona una cuenta destino válida.');
      if (destinationId === activeAccountId) return operationProblem('No puedes transferir dinero a tu misma cuenta.');
      if (amount > current.balance) return operationProblem('Saldo insuficiente para realizar esta transferencia.');
      const destination = db.accounts[destinationId];
      if (destination.balance + amount > MAX_ACCOUNT_BALANCE) {
        return operationProblem(`La cuenta de destino no puede superar ${money(MAX_ACCOUNT_BALANCE)}. Solo puede recibir ${money(MAX_ACCOUNT_BALANCE - destination.balance)} más.`);
      }
      current.balance = roundMoney(current.balance - amount);
      destination.balance = roundMoney(destination.balance + amount);
      recordMovement(activeAccountId, 'transfer', amount, `Transferencia enviada a ${destination.name}`, 'out');
      recordMovement(destinationId, 'transfer', amount, `Transferencia recibida de ${current.name}`, 'in');
      finalizeOperation(`Transferencia de ${money(amount)} enviada a ${destination.name}.`);
    }
  }

  function operationProblem(message) {
    operationError.textContent = message;
    operationError.hidden = false;
    amountInput.setAttribute('aria-invalid', 'true');
    amountInput.focus();
  }

  function finalizeOperation(message) {
    saveDatabase();
    closeModal();
    renderApp();
    if (currentView === 'history') renderHistory();
    showToast(message);
  }

  function showToast(message, kind = 'success') {
    const toast = $('#toast');
    $('#toastMessage').textContent = message;
    $('#toastIcon').textContent = kind === 'error' ? '!' : '✓';
    toast.classList.toggle('error', kind === 'error');
    toast.hidden = false;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3800);
  }

  function capitalize(text) {
    return text.charAt(0).toLocaleUpperCase('es-CO') + text.slice(1);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function resetDemoData() {
    const confirmed = window.confirm('¿Limpiar todos los saldos, movimientos, solicitudes, créditos y pagos? Las tres cuentas quedarán en $ 0 y se borrarán todos los registros guardados.');
    if (!confirmed) return;
    db = freshDatabase();
    saveDatabase();
    activeAccountId = null;
    closeModal();
    appView.hidden = true;
    loginView.hidden = false;
    loginError.hidden = true;
    pinInput.value = '';
    showToast('Saldos, movimientos, solicitudes, créditos y pagos eliminados. Todas las cuentas están en $ 0.');
    accountSelect.focus();
  }

  reviewerAccessButton.addEventListener('click', enterReviewerLogin);
  $('#backToClientLogin').addEventListener('click', returnToClientLogin);
  reviewerLoginForm.addEventListener('submit', loginReviewer);
  reviewerPinInput.addEventListener('input', () => {
    reviewerPinInput.value = reviewerPinInput.value.replace(/\D/g, '').slice(0, 6);
    reviewerLoginError.hidden = true;
    reviewerPinInput.setAttribute('aria-invalid', 'false');
  });
  $('#reviewerLogoutButton').addEventListener('click', logoutReviewer);
  reviewerFilter.addEventListener('change', renderReviewerApplications);
  reviewerApplicationsList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-review-id][data-review-decision]');
    if (!button) return;
    registerCreditDecision(button.dataset.reviewId, button.dataset.reviewDecision);
  });

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    login(Number(accountSelect.value), pinInput.value.trim());
  });

  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
    pinInput.setAttribute('aria-invalid', 'false');
    loginError.hidden = true;
  });

  togglePin.addEventListener('click', () => {
    const revealing = pinInput.type === 'password';
    pinInput.type = revealing ? 'text' : 'password';
    togglePin.textContent = revealing ? 'Ocultar' : 'Ver';
    togglePin.setAttribute('aria-label', revealing ? 'Ocultar PIN' : 'Mostrar PIN');
    pinInput.focus();
  });

  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  document.querySelectorAll('[data-go-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.goView)));
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.action)));
  $('#profileButton').addEventListener('click', () => {
    if (window.confirm('¿Deseas cerrar la sesión actual?')) logout();
  });
  $('#mobileMenuButton').addEventListener('click', () => sidebar.classList.toggle('open'));
  $('#resetDataButton').addEventListener('click', resetDemoData);
  $('#closeModalButton').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (event) => { if (event.target === modalOverlay) closeModal(); });
  operationForm.addEventListener('submit', submitOperation);
  $('#quickAmounts').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-amount]');
    if (!button) return;
    amountInput.value = button.dataset.amount;
    operationError.hidden = true;
    amountInput.setAttribute('aria-invalid', 'false');
    $('#quickAmounts').querySelectorAll('.quick-amount').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    amountInput.focus();
  });
  amountInput.addEventListener('input', () => {
    $('#quickAmounts').querySelectorAll('.quick-amount').forEach((button) => {
      const selected = button.dataset.amount === amountInput.value;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    amountInput.setAttribute('aria-invalid', 'false');
    operationError.hidden = true;
  });
  historyFilter.addEventListener('change', renderHistory);
  creditForm.addEventListener('submit', submitCreditApplication);
  $('#loansList').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-loan-pay]');
    if (button) processInstallmentPayment(button.dataset.loanPay);
  });
  $('#loansList').addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-loan-abono-form]');
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector('input[name="abonoAmount"]');
    processCapitalAbono(form.dataset.loanAbonoForm, Number(input.value));
    input.value = '';
  });
  creditAmountInput.addEventListener('input', updateCreditSimulation);
  creditTermSelect.addEventListener('change', updateCreditSimulation);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!modalOverlay.hidden) closeModal();
      sidebar.classList.remove('open');
    }
  });

  // Keep each account's daily withdrawal counter aligned with the local calendar.
  for (let id = 1; id <= 3; id += 1) resetDailyWithdrawalIfNeeded(db.accounts[id]);
  saveDatabase();
})();
