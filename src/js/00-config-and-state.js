  const STORAGE_KEY = 'cajero_virtual_savings_v15_clean';
  const LEGACY_STORAGE_KEY = 'cajero_virtual_savings_v1';
  const MAX_WITHDRAWAL_AMOUNT = 3000000;
  const MAX_DEPOSIT_AMOUNT = 3000000;
  const MAX_ACCOUNT_BALANCE = 100000000;
  const MAX_CARD_FUNDS = 100000000;
  const ADVANCE_FEE = 15000;
  const OPERATION_FEE = 10000;
  const MAX_ACCOUNT_CREDIT = 100000000;
  const MAX_CARD_LIMIT = 500000000;
  const CARD_LIMIT_STEPS = [110000000, 125000000, 150000000, 175000000, 200000000, 250000000, 300000000, 400000000, 500000000];
  const ANALYST_TOTAL_CAPITAL = 500000000;
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
    { id: 1, name: 'Edwin Ocampo', accountNumber: '7184 3059 6247', cardNumber: '5412 8043 1000 1045', accountType: 'Cuenta de ahorros', pin: '5837', balance: 0, withdrawnToday: 0, withdrawalDate: '', history: [] },
    { id: 2, name: 'Pedro Ocampo', accountNumber: '4927 8613 5704', cardNumber: '5412 8043 1000 5704', accountType: 'Cuenta de ahorros', pin: '9146', balance: 0, withdrawnToday: 0, withdrawalDate: '', history: [] },
    { id: 3, name: 'Reinel Ocampo', accountNumber: '8361 4925 7083', cardNumber: '5412 8043 1000 7083', accountType: 'Cuenta de ahorros', pin: '7269', balance: 0, withdrawnToday: 0, withdrawalDate: '', history: [] }
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
  const reviewerLimitRequestsList = $('#reviewerLimitRequestsList');
  const loginForm = $('#loginForm');
  const accountSelect = $('#accountSelect');
  const pinInput = $('#pinInput');
  const loginError = $('#loginError');
  const togglePin = $('#togglePin');
  const modalOverlay = $('#modalOverlay');
  const appDialogOverlay = $('#appDialogOverlay');
  const appDialogCard = $('#appDialogCard');
  let appDialogResolver = null;
  let appDialogType = 'confirm';
  let appDialogPreviousFocus = null;
  const operationForm = $('#operationForm');
  const operationError = $('#operationError');
  const amountInput = $('#amountInput');
  const destinationSelect = $('#destinationSelect');
  const destinationField = $('#destinationField');
  const historyFilter = $('#historyFilter');
  const creditForm = $('#creditForm');
  const cardLimitRequestForm = $('#cardLimitRequestForm');
  const creditAmountInput = $('#creditAmountInput');
  const creditTermSelect = $('#creditTermSelect');
  const advanceTermSelect = $('#advanceTermSelect');
  const creditIncomeInput = $('#creditIncomeInput');
  const creditPurposeSelect = $('#creditPurposeSelect');
  const creditEmploymentSelect = $('#creditEmploymentSelect');
  const creditError = $('#creditError');
  const sidebar = $('#sidebar');
  // La base se inicializa al final, cuando todos los módulos de lógica ya están cargados.
  // No se elimina ningún dato al abrir la aplicación; el borrado exige confirmación expresa.
  let db = null;
  let activeAccountId = null;
  let reviewerSession = false;
  let currentModalAction = null;
  let currentView = 'overview';
  let toastTimer = null;
  let previousFocusedElement = null;

