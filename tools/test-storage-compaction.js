#!/usr/bin/env node
// Regression: compact browser storage while preserving ledger totals and financial summaries.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function assert(condition, message) { if (!condition) throw new Error(message); }
let id = 0;
const ctx = {
  MAX_ACCOUNT_ID: 3, MAX_AUDIT_EVENTS: 2000, MAX_ACCOUNT_HISTORY_ITEMS: 500,
  MAX_CARD_HISTORY_ITEMS: 500, MAX_TREASURY_HISTORY_ITEMS: 2000,
  MAX_CREDIT_APPLICATIONS: 500, MAX_LIMIT_INCREASE_REQUESTS: 500, MAX_CLOSED_LOANS: 200,
  STORAGE_KEY: 'storage-test', dbRevision: 0, databaseLoadIssue: false,
  createId: () => `test-${++id}`,
  showToast(message) { ctx.toasts.push(message); }, toasts: [],
  accrueWithdrawalTreasury() {}, processSimulationAutomationEvents: () => ({ caughtUp: true })
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src/js/01-storage-and-migrations-04.js'), 'utf8'), ctx);

function movements(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `movement-${index}`, type: index % 5 === 0 ? 'operation_fee' : 'deposit',
    amount: 1000, direction: index % 5 === 0 ? 'out' : 'in',
    description: index % 5 === 0 ? 'Comisión por reparto automático de Tesorería' : 'Depósito',
    date: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString()
  })).reverse();
}
function net(history) { return history.reduce((sum, row) => sum + (row.direction === 'in' ? row.amount : row.direction === 'out' ? -row.amount : 0), 0); }
function feeTotal(history) { return history.filter((row) => row.type === 'operation_fee').reduce((sum, row) => sum + row.amount, 0); }
const accountHistory = movements(1200);
const treasuryHistory = movements(2300);
const accounts = [null];
for (let accountId = 1; accountId <= 3; accountId += 1) {
  accounts.push({ id: accountId, balance: net(accountHistory), history: [...accountHistory], card: { history: [...accountHistory], pendingDisbursements: [] } });
}
const loans = [];
const applications = [];
for (let index = 0; index < 205; index += 1) {
  const applicationId = `application-${index}`;
  const date = new Date(Date.UTC(2024, 0, 1) + index * 86400000).toISOString();
  applications.push({ id: applicationId, accountId: 1, amount: 100000, activatedAmount: 100000, cardFundsRemaining: 0, status: 'Desembolsado', date, disbursedAt: date });
  loans.push({ id: `loan-${index}`, accountId: 1, applicationId, applicationIds: [applicationId], status: 'Pagado', outstandingPrincipal: 0, originalDisbursedTotal: 100000, principalOriginal: 100000, closedAt: date, payments: [{ amount: 110000, principal: 100000, interest: 10000 }] });
}
const pendingApplication = { id: 'pending-app', accountId: 1, amount: 50000, activatedAmount: 0, cardFundsRemaining: 50000, status: 'Aprobado', disbursedAt: new Date().toISOString() };
applications.unshift(pendingApplication);
accounts[1].card.funds = 50000;
accounts[1].card.limit = 100000000;
accounts[1].card.pendingDisbursements.push({ applicationId: 'pending-app', remainingAmount: 50000 });
const db = {
  accounts, loans, creditApplications: applications,
  limitIncreaseRequests: Array.from({ length: 700 }, (_, index) => ({ id: `request-${index}`, accountId: 1, status: 'Rechazado', date: new Date(Date.UTC(2025, 0, 1) + index * 1000).toISOString() })).concat([{ id: 'pending-request', accountId: 2, status: 'En revisión' }]),
  auditLog: Array.from({ length: 2400 }, (_, index) => ({ id: `audit-${index}`, action: 'Movimiento', date: new Date().toISOString() })),
  withdrawalTreasury: { balance: 1000000, history: treasuryHistory }
};
const savingsNetBefore = net(db.accounts[1].history);
const feeTotalBefore = feeTotal(db.accounts[1].history);
const treasuryFeesBefore = feeTotal(db.withdrawalTreasury.history);
assert(ctx.compactDatabaseForStorage(db), 'La compactación debe ejecutarse ante historiales largos.');
assert(db.accounts[1].history.length <= 520 && net(db.accounts[1].history) === savingsNetBefore, 'El historial de ahorros debe resumirse conservando su saldo neto.');
assert(feeTotal(db.accounts[1].history) === feeTotalBefore, 'Las comisiones de operaciones resumidas deben conservar su total.');
assert(db.accounts[1].history.some((row) => row.type === 'operation_fee' && /reparto autom[aá]tico de tesorer[ií]a/i.test(row.description)), 'El resumen debe conservar la categoría de comisión para los reportes.')
assert(db.accounts[1].card.history.length <= 520, 'El historial de tarjeta debe compactarse.');
assert(db.withdrawalTreasury.history.length <= 2020 && feeTotal(db.withdrawalTreasury.history) === treasuryFeesBefore, 'Tesorería debe compactarse sin perder el total de comisiones registradas.');
assert(db.loans.length === 200 && db.creditApplications.length === 201, 'Se deben conservar créditos recientes y la solicitud pendiente en tarjeta.');
assert(db.accounts[1].card.pendingDisbursements[0].applicationId === db.creditApplications[0].id, 'La solicitud aún pendiente de desembolso debe seguir vinculada a la tarjeta.');
assert(db.limitIncreaseRequests.some((request) => request.id === 'pending-request') && db.limitIncreaseRequests.length <= 501, 'Las solicitudes pendientes deben conservarse al resumir el historial.');
assert(db.archivedFinancialSummary.loanOriginalDisbursements === 500000, 'El resumen debe conservar el capital original de los préstamos archivados.');
assert(db.archivedFinancialSummary.applicationActivatedDisbursements === 500000, 'El resumen debe conciliar los desembolsos activados archivados.');
assert(db.archivedFinancialSummary.interestEarned === 50000 && db.archivedFinancialSummary.principalRecovered === 500000, 'Los intereses y capital recuperado archivados deben conservar sus totales.');
assert(db.archivedFinancialSummary.monthlyPayments.reduce((sum, row) => sum + row.amount, 0) === 550000 && db.archivedFinancialSummary.monthlyPayments.reduce((sum, row) => sum + row.interest, 0) === 50000 && db.archivedFinancialSummary.monthlyPayments.reduce((sum, row) => sum + row.count, 0) === 5, 'Los pagos archivados deben conservar sus totales para informes mensuales.');
assert(db.archivedFinancialSummary.monthlyDisbursements.reduce((sum, row) => sum + row.amount, 0) === 500000 && db.archivedFinancialSummary.monthlyDisbursements.reduce((sum, row) => sum + row.count, 0) === 5, 'Los desembolsos archivados deben conservar sus totales mensuales.')
assert(db.archivedFinancialSummary.paymentsAmountByAccount[1] === 550000 && db.archivedFinancialSummary.paymentCountByAccount[1] === 5, 'El resumen del cliente debe conservar los pagos archivados por titular.')
assert(db.auditLog.length === 2000, 'El registro de auditoría debe mantenerse en su límite configurado.');

const retryAccounts = [null];
for (let accountId = 1; accountId <= 3; accountId += 1) retryAccounts.push({ id: accountId, balance: 0, history: movements(1000), card: { history: movements(1000), pendingDisbursements: [] } });
const retryDb = { accounts: retryAccounts, loans: [], creditApplications: [], limitIncreaseRequests: [], auditLog: [], withdrawalTreasury: { balance: 0, history: [] } };
let stored = JSON.stringify(retryDb);
ctx.db = retryDb;
ctx.lastPersistedRaw = stored;
let writeCount = 0;
let persisted = null;
ctx.localStorage = {
  getItem: () => stored,
  setItem(key, value) { writeCount += 1; if (writeCount === 1) throw new Error('QuotaExceededError'); persisted = value; stored = value; }
};
assert(ctx.saveDatabase(), 'El guardado debe reintentar tras el primer error de cuota.');
assert(writeCount === 2 && JSON.parse(persisted).accounts[1].history.length <= 120, 'El reintento debe persistir el estado compactado.');
assert(ctx.toasts.some((message) => message.includes('saldos') && message.includes('conservaron')), 'La interfaz debe informar que se conservó el estado financiero.');
console.log('PASS: historiales largos se compactan sin cambiar saldos ni totales de comisiones.');
console.log('PASS: préstamos activos, solicitudes pendientes, intereses y capital recuperado se conservan.');
console.log('PASS: ante un error de cuota el guardado vuelve a intentar con una base compactada.');
