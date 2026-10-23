#!/usr/bin/env node
// Regression: the final scheduled installment pays every remaining peso despite rounded payments.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const loan = {
  id: 'loan-final-6', accountId: 1, outstandingPrincipal: 150000, monthlyRate: 0.0213,
  termMonths: 6, installmentsPaid: 0, monthlyPayment: 26896,
  nextDueDate: '2026-11-22', status: 'Activo', payments: []
};
let nextId = 0;
const account = { balance: 100000, card: { limit: 500000000, funds: 0, recoveredFunds: 0 } };
const db = { loans: [loan], accounts: [null, account], creditApplications: [] };
const context = {
  db, activeAccountId: 1, ILLUSTRATIVE_MONTHLY_RATE: 0.02, currentMonthlyInterestRate: () => 0.0213,
  roundMoney: (value) => Math.round(Number(value) || 0),
  createId: () => `test-${++nextId}`,
  localDateKey: () => '2026-10-22',
  addMonthsToDate: (date) => date,
  account: () => account,
  money: (value) => `$ ${Math.round(Number(value) || 0)}`,
  captureDatabaseRevision: () => ({}), isDatabaseRevisionCurrent: () => true,
  showAppDialog: async () => true,
  restoreCardAdvanceBalance() {}, updateLinkedApplicationsStatus() {},
  recordMovement() {}, saveDatabase: () => true,
  renderApp() {}, renderLoans() {}, renderCreditApplications() {}, showToast() {}
};
vm.createContext(context);
for (const file of ['03-credit-engine-01.js', '04-credit-ui-and-payments-03.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', file), 'utf8'), context, { filename: file });
}

(async () => {
  const expectedPriorBalance = 26338;
  const estimate = context.calculateCreditEstimate(150000, 6);
  assert(estimate.actualMonths === 6, 'La simulación debe cerrar en el plazo seleccionado, sin una cuota adicional por redondeo.');
  let paidBeforeFinal = 0;
  for (let index = 0; index < 5; index += 1) {
    const installment = context.nextInstallmentFor(loan);
    paidBeforeFinal += installment.paymentAmount;
    loan.outstandingPrincipal = Math.max(0, Math.round(loan.outstandingPrincipal - installment.principal));
    loan.installmentsPaid += 1;
  }
  assert(loan.outstandingPrincipal === expectedPriorBalance, 'El ejemplo debe llegar al último pago con el saldo que deja el redondeo.');
  const finalInstallment = context.nextInstallmentFor(loan);
  assert(finalInstallment.installmentNumber === 6, 'El pago debe registrarse como sexta cuota.');
  assert(finalInstallment.principal === expectedPriorBalance, 'La última cuota debe cubrir todo el capital pendiente.');
  assert(finalInstallment.paymentAmount === expectedPriorBalance + finalInstallment.interest, 'La cuota final debe sumar el interés al capital completo pendiente.');
  assert(estimate.totalPayable === paidBeforeFinal + finalInstallment.paymentAmount, 'El total estimado debe coincidir con las seis cuotas efectivamente cobradas.');
  await context.processInstallmentPayment(loan.id);
  assert(loan.outstandingPrincipal === 0 && loan.status === 'Pagado', 'El último pago debe cerrar la deuda sin saldo residual.');
  assert(loan.payments[0].remainingPrincipal === 0 && loan.payments[0].principal === expectedPriorBalance, 'El historial debe conservar el saldo final en cero.');
  console.log('PASS: la sexta cuota cubre el saldo exacto, registra el pago y cierra el crédito sin pesos pendientes.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
