#!/usr/bin/env node
// Regression checks for the independent treasury, legacy migration, timer, withdrawals, and transfers.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const seed = [null,
  { id: 1, name: 'Edwin Ocampo', accountNumber: '7184 3059 6247', cardNumber: '5412 8043 1000 1045', accountType: 'Cuenta de ahorros', pin: '5837' },
  { id: 2, name: 'Pedro Ocampo', accountNumber: '4927 8613 5704', cardNumber: '5412 8043 1000 5704', accountType: 'Cuenta de ahorros', pin: '9146' },
  { id: 3, name: 'Reinel Ocampo', accountNumber: '8361 4925 7083', cardNumber: '5412 8043 1000 7083', accountType: 'Cuenta de ahorros', pin: '7269' }
];
let nextId = 0;
function createId() { nextId += 1; return `test-${nextId}`; }
function makeClient(id, balance) {
  return { ...seed[id], balance, withdrawnToday: 0, withdrawalDate: '2026-10-22', history: [], card: { number: seed[id].cardNumber, limit: 100000000, funds: 0, recoveredFunds: 0, debt: 0, nextInterestDate: null, history: [], pendingDisbursements: [] } };
}
function makeStorageContext(stored) {
  const context = {
    ACCOUNT_SEED: seed,
    MAX_ACCOUNT_ID: 3,
    MAX_ACCOUNT_BALANCE: 200000000,
    MAX_CARD_FUNDS: 100000000,
    MAX_CARD_LIMIT: 500000000,
    MAX_AUDIT_EVENTS: 5000,
    ILLUSTRATIVE_MONTHLY_RATE: 0.0213,
    TREASURY_NAME: 'Tesorería de retiros',
    TREASURY_ACCOUNT_NUMBER: '6024 1937 0004',
    TREASURY_PIN: '3456',
    TREASURY_TIMER_RATE: 5,
    STORAGE_KEY: 'test',
    localStorage: { getItem: () => stored },
    lastPersistedRaw: null,
    databaseLoadIssue: false,
    localDateKey: () => '2026-10-22',
    createId,
    roundMoney: (value) => Math.round(Number(value) || 0),
    maxSavingsBalanceForAccount: () => 200000000,
    migrateLegacyCardDebts() {},
    consolidateActiveLoans() {}
  };
  vm.createContext(context);
  for (const file of ['01-storage-and-migrations-02.js', '01-storage-and-migrations-03.js', '01-storage-and-migrations-04.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src/js', file), 'utf8'), context, { filename: file });
  }
  return context;
}

const clientsOnlyDatabase = {
  accounts: [null, makeClient(1, 100000), makeClient(2, 200000), makeClient(3, 300000)],
  creditApplications: [], loans: [], limitIncreaseRequests: [], auditLog: [], operationFeesCollected: 0, advanceFeesCollected: 0
};
const clientsOnlyContext = makeStorageContext(JSON.stringify(clientsOnlyDatabase));
const migratedClients = clientsOnlyContext.loadDatabase();
assert(!clientsOnlyContext.databaseLoadIssue, 'Una base antigua de tres clientes debe seguir siendo válida.');
assert(migratedClients.accounts.length === 4 && migratedClients.accounts[3].id === 3, 'La base debe contener solo las tres cuentas de ahorro.');
assert(migratedClients.accounts[1].balance === 100000 && migratedClients.accounts[3].balance === 300000, 'La migración debe conservar los saldos de clientes.');
assert(migratedClients.withdrawalTreasury.balance === 0 && !('card' in migratedClients.withdrawalTreasury), 'La Tesorería debe iniciar vacía y sin tarjeta.');

const legacyReceiver = { id: 4, name: 'Cuenta receptora de retiros', accountNumber: '6024 1937 0004', cardNumber: '5412 8043 1000 0004', accountType: 'Cuenta receptora', pin: '3456', balance: 321000, withdrawnToday: 0, withdrawalDate: '', history: [{ id: 'legacy-in', type: 'withdrawal_received', amount: 321000, description: 'Retiro recibido', direction: 'in', date: '2026-10-22T12:00:00.000Z' }], card: { limit: 100000000, funds: 50000, recoveredFunds: 0, debt: 0, history: [] } };
const legacyDatabase = {
  ...clientsOnlyDatabase,
  accounts: [...clientsOnlyDatabase.accounts, legacyReceiver],
  creditApplications: [{ id: 'legacy-credit', accountId: 4, amount: 100000, date: '2026-10-22' }],
  loans: [{ id: 'legacy-loan', accountId: 4, outstandingPrincipal: 50000, payments: [] }],
  limitIncreaseRequests: [{ id: 'legacy-limit', accountId: 4, requestedLimit: 150000000 }]
};
const storedLegacy = JSON.stringify(legacyDatabase);
const legacyContext = makeStorageContext(storedLegacy);
const migratedLegacy = legacyContext.loadDatabase();
assert(!legacyContext.databaseLoadIssue, 'La versión con cuarta cuenta receptora debe migrarse sin marcarse como dañada.');
assert(migratedLegacy.accounts.length === 4 && migratedLegacy.withdrawalTreasury.balance === 321000, 'El saldo anterior de la receptora debe conservarse en Tesorería.');
assert(migratedLegacy.withdrawalTreasury.timerIncomeTotal === 0, 'La migración de la receptora anterior no debe inventar ingresos de cronómetro.');
assert(migratedLegacy.withdrawalTreasury.history[0].id === 'legacy-in', 'El historial de retiros debe migrarse a Tesorería.');
assert(!('card' in migratedLegacy.withdrawalTreasury) && migratedLegacy.creditApplications.length === 0 && migratedLegacy.loans.length === 0 && migratedLegacy.limitIncreaseRequests.length === 0, 'La Tesorería no debe conservar tarjeta, créditos ni solicitudes activas.');

const v38TreasuryDatabase = {
  ...clientsOnlyDatabase,
  withdrawalTreasury: { name: 'Tesorería de retiros', accountNumber: '6024 1937 0004', pin: '3456', balance: 123456, history: [{ id: 'old-timer', type: 'timer_income', amount: 15, direction: 'in', description: 'Temporizador antiguo a $1 por segundo' }], elapsedSeconds: 15, lastAccruedAt: new Date(Date.now() + 60000).toISOString() }
};
const v38TreasuryContext = makeStorageContext(JSON.stringify(v38TreasuryDatabase));
const migratedV38Treasury = v38TreasuryContext.loadDatabase().withdrawalTreasury;
assert(migratedV38Treasury.balance === 123456 && migratedV38Treasury.timerIncomeTotal === 15, 'La migración v38 debe conservar el saldo y reconocer los ingresos históricos al ritmo anterior de $1 por segundo.');
const lastV38Timestamp = Date.parse(migratedV38Treasury.lastAccruedAt);
assert(v38TreasuryContext.accrueWithdrawalTreasury({ withdrawalTreasury: migratedV38Treasury }, lastV38Timestamp + 1000), 'La tesorería migrada debe aplicar la nueva tarifa al tiempo posterior a la actualización.');
assert(migratedV38Treasury.balance === 123461 && migratedV38Treasury.timerIncomeTotal === 20 && migratedV38Treasury.history.length === 2, 'La nueva tasa debe sumar $5 y conservar intacto el asiento histórico de $1 por segundo.');
assert(migratedV38Treasury.history[1].id === 'old-timer' && migratedV38Treasury.history[1].amount === 15, 'La nueva acumulación no debe reemplazar el asiento histórico anterior.');

const backupContext = {
  ...legacyContext,
  document: { querySelector: () => null },
  MIN_CREDIT_AMOUNT: 100000,
  MAX_AUDIT_EVENTS: 5000,
  money: (value) => '$ ' + Math.round(Number(value) || 0).toLocaleString('en-US')
};
vm.createContext(backupContext);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src/js/17-backup-export-import.js'), 'utf8'), backupContext);
const oldBackup = JSON.parse(storedLegacy);
assert(backupContext.validateBackupDatabase(oldBackup) === '', 'Las copias de seguridad v37 deben seguir validándose.');
assert(oldBackup.accounts.length === 4 && oldBackup.withdrawalTreasury.balance === 321000, 'La importación debe convertir la antigua cuenta en Tesorería y conservar su saldo.');

const timerDb = { withdrawalTreasury: { balance: 100, history: [], elapsedSeconds: 0, timerIncomeTotal: 0, lastAccruedAt: '2026-10-22T12:00:00.000Z' }, auditLog: [] };
const start = Date.parse(timerDb.withdrawalTreasury.lastAccruedAt);
assert(legacyContext.accrueWithdrawalTreasury(timerDb, start + 5000), 'El cronómetro debe acumular tiempo transcurrido.');
assert(timerDb.withdrawalTreasury.balance === 125 && timerDb.withdrawalTreasury.elapsedSeconds === 5 && timerDb.withdrawalTreasury.timerIncomeTotal === 25, 'El saldo y el ingreso del cronómetro deben subir $5 por segundo.');
legacyContext.accrueWithdrawalTreasury(timerDb, start + 6000);
assert(timerDb.withdrawalTreasury.balance === 130 && timerDb.withdrawalTreasury.history.length === 1 && timerDb.withdrawalTreasury.history[0].amount === 30 && timerDb.withdrawalTreasury.history[0].ratePesosPerSecond === 5, 'El ingreso del temporizador debe acumularse a la nueva tasa en un solo movimiento.');
assert(timerDb.auditLog.length === 1 && timerDb.auditLog[0].category === 'tesoreria', 'La acumulación del cronómetro debe registrarse en auditoría.');

const accounts = [null, makeClient(1, 200000), makeClient(2, 200000), makeClient(3, 200000)];
const db = { accounts, withdrawalTreasury: { balance: 0, history: [], elapsedSeconds: 0, lastAccruedAt: new Date().toISOString() }, operationFeesCollected: 0, auditLog: [] };
const operationMessages = [];
const operationContext = {
  db, activeAccountId: 1, currentModalAction: 'withdraw',
  operationError: { hidden: true, textContent: '' },
  amountInput: { value: '100000', setAttribute() {}, focus() {} },
  OPERATION_FEE: 20000, MAX_WITHDRAWAL_AMOUNT: 20000000, MAX_DEPOSIT_AMOUNT: 20000000, MAX_TRANSFER_AMOUNT: 20000000,
  MAX_ACCOUNT_BALANCE: 200000000, MAX_ACCOUNT_ID: 3, TREASURY_NAME: 'Tesorería de retiros',
  maxSavingsBalanceForAccount: () => 200000000,
  account: () => db.accounts[operationContext.activeAccountId],
  roundMoney: (value) => Math.round(Number(value) || 0),
  money: (value) => '$ ' + Math.round(Number(value) || 0).toLocaleString('en-US'),
  resetDailyWithdrawalIfNeeded() {},
  accrueWithdrawalTreasury() {},
  recordMovement(id, type, amount, description, direction) { db.accounts[id].history.unshift({ id: createId(), type, amount, description, direction }); },
  recordTreasuryMovement(type, amount, description, direction) { db.withdrawalTreasury.history.unshift({ id: createId(), type, amount, description, direction }); },
  finalizeOperation(message) { operationMessages.push(message); }
};
vm.createContext(operationContext);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src/js/09-account-operations-and-dialogs-02.js'), 'utf8'), operationContext);
operationContext.submitOperation({ preventDefault() {} });
assert(accounts[1].balance === 80000 && db.withdrawalTreasury.balance === 100000, 'El retiro debe descontar cliente y acreditar automáticamente Tesorería.');
assert(db.operationFeesCollected === 20000, 'La comisión debe permanecer separada del importe recibido.');
assert(db.withdrawalTreasury.history[0].type === 'withdrawal_received' && operationMessages[0].includes('Tesorería de retiros'), 'El abono y la confirmación deben identificar Tesorería.');
for (const clientId of [2, 3]) {
  operationContext.activeAccountId = clientId;
  operationContext.amountInput.value = '50000';
  operationContext.currentModalAction = 'withdraw';
  operationContext.submitOperation({ preventDefault() {} });
}
assert(db.withdrawalTreasury.balance === 200000 && db.operationFeesCollected === 60000, 'Los tres clientes deben acreditar sus retiros y pagar las comisiones separadas.');
operationContext.activeAccountId = 1;
operationContext.currentModalAction = 'deposit';
operationContext.amountInput.value = '50000';
operationContext.submitOperation({ preventDefault() {} });
assert(db.withdrawalTreasury.balance === 150000 && accounts[1].balance === 110000, 'El depósito debe descontar de Tesorería el importe bruto y acreditar en ahorros el neto tras comisión.');
assert(db.withdrawalTreasury.history[0].type === 'deposit_funded' && db.withdrawalTreasury.history[0].amount === 50000 && db.withdrawalTreasury.history[0].direction === 'out', 'Tesorería debe registrar el origen del depósito como egreso.');
assert(db.operationFeesCollected === 80000, 'La comisión del depósito debe seguir sumándose al fondo del analista.');
const balancesBeforeInsufficientDeposit = { treasury: db.withdrawalTreasury.balance, account: accounts[1].balance };
operationContext.amountInput.value = '160000';
operationContext.submitOperation({ preventDefault() {} });
assert(db.withdrawalTreasury.balance === balancesBeforeInsufficientDeposit.treasury && accounts[1].balance === balancesBeforeInsufficientDeposit.account, 'Un depósito superior al saldo de Tesorería debe rechazarse sin cambiar saldos.');
assert(operationContext.operationError.hidden === false && operationContext.operationError.textContent.includes('no alcanza'), 'El depósito rechazado debe explicar que Tesorería no tiene saldo suficiente.');

const treasuryHtmlFile = '16zz-treasury-dashboard.html';
const analystHtmlFile = '16z-analyst-audit-and-reports.html';
const htmlFragments = fs.readdirSync(path.join(__dirname, '..', 'src/html')).filter((file) => file.endsWith('.html')).sort();
assert(htmlFragments.indexOf(treasuryHtmlFile) > htmlFragments.indexOf(analystHtmlFile), 'El panel de Tesorería debe aparecer después del cierre del panel del analista.');
assert(fs.readFileSync(path.join(__dirname, '..', 'src/html', analystHtmlFile), 'utf8').trimEnd().endsWith('</main>'), 'El panel del analista debe cerrar antes de iniciar Tesorería.');
assert(fs.readFileSync(path.join(__dirname, '..', 'src/html', treasuryHtmlFile), 'utf8').trimStart().startsWith('<main id="treasuryView"'), 'Tesorería debe ser una vista raíz independiente.');

const treasurySource = fs.readFileSync(path.join(__dirname, '..', 'src/js/23a-withdrawal-treasury.js'), 'utf8');
const loginStart = treasurySource.indexOf('  function loginTreasury(event) {');
const loginEnd = treasurySource.indexOf('  function formatTreasuryElapsed', loginStart);
assert(loginStart >= 0 && loginEnd > loginStart, 'Debe existir la función de inicio de sesión de Tesorería.');
const loginState = {
  TREASURY_PIN: '3456', activeAccountId: 1, reviewerSession: true, treasurySession: false,
  treasuryPinInput: { value: '3456', setAttribute() {}, focus() {} },
  treasuryLoginError: { hidden: true, textContent: '' },
  loginView: { hidden: false }, reviewerLoginView: { hidden: false }, reviewerView: { hidden: false },
  appView: { hidden: false }, treasuryLoginView: { hidden: false }, treasuryView: { hidden: true },
  persistTabSession(role, accountId) { loginState.persisted = { role, accountId }; },
  renderTreasuryView(force) { loginState.rendered = force; }, startTreasuryTimer() { loginState.timerStarted = true; }
};
vm.createContext(loginState);
vm.runInContext(treasurySource.slice(loginStart, loginEnd), loginState);
loginState.loginTreasury({ preventDefault() {} });
assert(loginState.treasurySession && loginState.treasuryView.hidden === false && loginState.treasuryLoginView.hidden, 'Al entrar, la pantalla independiente de Tesorería debe quedar visible.');
assert(loginState.persisted.role === 'treasury' && loginState.rendered && loginState.timerStarted, 'El acceso debe restaurar el rol, renderizar el saldo e iniciar el cronómetro.');

const transferStart = treasurySource.indexOf('  function submitTreasuryTransfer(event) {');
const transferEnd = treasurySource.indexOf('  treasuryAccessButton.addEventListener', transferStart);
assert(transferStart >= 0 && transferEnd > transferStart, 'Debe existir el flujo de transferencia de Tesorería.');
const elements = {
  '#treasuryAmount': { value: '75000', setAttribute() {}, focus() {} },
  '#treasuryDestination': { value: '2' },
  '#treasuryTransferError': { hidden: true, textContent: '' }
};
const transferMessages = [];
const transferContext = {
  treasurySession: true, TREASURY_NAME: 'Tesorería de retiros', db, MAX_ACCOUNT_BALANCE: 200000000, MAX_ACCOUNT_ID: 3,
  captureDatabaseRevision: () => ({}), isDatabaseRevisionCurrent: () => true, accrueWithdrawalTreasury() {},
  roundMoney: (value) => Math.round(Number(value) || 0),
  $(selector) { return elements[selector]; },
  recordTreasuryMovement(type, amount, description, direction) { db.withdrawalTreasury.history.unshift({ id: createId(), type, amount, description, direction }); },
  recordMovement(id, type, amount, description, direction) { db.accounts[id].history.unshift({ id: createId(), type, amount, description, direction }); },
  saveDatabase: () => true, renderTreasuryView() {}, showToast(message) { transferMessages.push(message); },
  money: (value) => '$ ' + Math.round(Number(value) || 0).toLocaleString('en-US'),
  abortStaleFinancialOperation() { throw new Error('La transferencia no debía estar desactualizada.'); }
};
vm.createContext(transferContext);
vm.runInContext(treasurySource.slice(transferStart, transferEnd), transferContext);
transferContext.submitTreasuryTransfer({ preventDefault() {} });
assert(db.withdrawalTreasury.balance === 75000 && accounts[2].balance === 205000, 'La transferencia debe reducir Tesorería y abonar la cuenta destino.');
assert(db.withdrawalTreasury.history[0].type === 'treasury_transfer' && accounts[2].history[0].description.includes('Tesorería'), 'La transferencia debe quedar anotada en los dos historiales.');
assert(transferMessages[0].includes('Pedro Ocampo') && db.operationFeesCollected === 80000, 'La transferencia interna no debe cobrar comisión.');

console.log('PASS: las tres cuentas cliente y Tesorería quedan en estructuras separadas.');
console.log('PASS: saldos e historial de la cuenta receptora v37 se migran; sus créditos no quedan activos.');
console.log('PASS: Tesorería v38 migra su histórico sin recalcular el saldo y el cronómetro suma $5 por segundo.');
console.log('PASS: los retiros llegan a Tesorería y los depósitos se financian desde su saldo, con rechazo si no alcanza.');
console.log('PASS: Tesorería abre como vista raíz y transfiere a clientes sin comisión ni productos de crédito.');
