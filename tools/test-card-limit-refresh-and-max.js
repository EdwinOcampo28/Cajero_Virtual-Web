#!/usr/bin/env node
// Regression coverage for card refresh, deferred credit visibility, and the $500M limit state.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.options = [];
    this.dataset = {};
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.max = '';
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
}

const elements = new Map();
const document = { createElement: (tag) => new FakeElement(tag) };
const ctx = {
  document,
  db: {
    limitIncreaseRequests: [],
    creditApplications: [{ id: 'limit-app', accountId: 1, origin: 'Aumento de cupo', amount: 50000000, activatedAmount: 0, cardFundsRemaining: 50000000, termMonths: 12, monthlyPayment: 5000000, status: 'Aprobado', date: '2026-10-22T10:00:00.000Z', disbursedAt: '2026-10-22T10:00:00.000Z', purpose: 'Desembolso automático por aumento de cupo' }],
    loans: [],
    accounts: [null, { id: 1, name: 'Cliente de prueba', accountNumber: '1000 0000 0001', cardNumber: '4111111111111111', balance: 0, card: { number: '4111111111111111', limit: 500000000, funds: 50000000, recoveredFunds: 0, debt: 0, history: [], pendingDisbursements: [] } }]
  },
  activeAccountId: 1,
  MAX_CARD_LIMIT: 500000000,
  MAX_CARD_FUNDS: 100000000,
  MAX_ACCOUNT_BALANCE: 300000000,
  maxSavingsBalanceForAccount: () => 300000000,
  ADVANCE_FEE: 0,
  ILLUSTRATIVE_MONTHLY_RATE: 0.02,
  formatMonthlyInterestRate: () => '2,00 %',
  roundMoney: (amount) => Math.round(Number(amount) || 0),
  account() { return ctx.db.accounts[1]; },
  $ (selector) {
    const key = String(selector).replace(/^#/, '');
    if (!elements.has(key)) elements.set(key, new FakeElement(key === 'cardLimitRequestedValue' ? 'select' : 'div'));
    return elements.get(key);
  },
  money: (amount) => '$ ' + Math.round(Number(amount) || 0).toLocaleString('en-US'),
  shortDateTime: () => '22 oct. 2026',
  statusClass: (status) => String(status).toLowerCase().replace(/\s+/g, '-'),
  localDateKey: () => '2026-10-22',
  addMonthsToDate: () => '2026-11-22',
  saveDatabase: () => true,
  recordCardMovement() {},
  recordMovement() {},
  cardCreditLimitForAccount(id) { return ctx.db.accounts[id].card.limit; },
  totalDisbursedForAccount: () => 50000000,
  availableAdvancesForCard(card) { return Math.min(card.limit, card.funds + card.recoveredFunds); },
  findLoanForApplication: () => null,
  nextInstallmentFor: () => ({ paymentAmount: 5000000 }),
  renderCardLimitRequestSection() {}
};

const select = ctx.$('#cardLimitRequestedValue');
const option = new FakeElement('option');
option.value = '50000000';
select.options = [option];
select.value = '50000000';
vm.createContext(ctx);

for (const file of ['07-card-view-and-helpers-01.js', '07-card-view-and-helpers-02.js', '04-credit-ui-and-payments-01.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', file), 'utf8'), ctx, { filename: file });
}

ctx.renderCardView();
assert(ctx.$('#cardTotalDisbursementsMetric').textContent === '$ 50,000,000', 'La tarjeta debe mostrar el desembolso aunque no haya deuda activa.');
assert(ctx.$('#cardAvailableAdvancesMetric').textContent === '$ 50,000,000', 'La tarjeta debe mostrar los fondos disponibles al refrescar sin deuda.');

ctx.renderCardLimitRequestSection(ctx.account());
assert(ctx.$('#cardLimitRequestField').hidden, 'Al llegar al tope debe ocultarse el selector de aumentos.');
assert(ctx.$('#cardLimitRequestSubmit').hidden, 'Al llegar al tope debe ocultarse el botón de solicitud.');
assert(ctx.$('#cardLimitRequestStatus').textContent.includes('cupo máximo de $ 500,000,000'), 'El tope debe mostrar un mensaje distinto y explícito.');
assert(!option.textContent.includes('$ 550,000,000'), 'El selector no debe sugerir un cupo por encima del máximo.');

ctx.db.accounts[1].card.limit = 450000000;
ctx.renderCardLimitRequestSection(ctx.account());
assert(!ctx.$('#cardLimitRequestField').hidden && !ctx.$('#cardLimitRequestSubmit').hidden, 'Un aumento de $50M debe volver a solicitarse sin actualizar la página cuando aún hay espacio.');
assert(option.textContent.includes('$ 500,000,000'), 'El selector debe mostrar el nuevo cupo permitido.');

ctx.renderCreditApplications();
assert(ctx.$('#creditApplicationsList').children.length === 0, 'El desembolso de aumento aún no debe aparecer como crédito antes de un avance.');

ctx.db.creditApplications[0].activatedAmount = 15000000;
ctx.db.creditApplications[0].cardFundsRemaining = 35000000;
ctx.db.loans.push({ id: 'loan-1', accountId: 1, applicationId: 'limit-app', applicationIds: ['limit-app'], status: 'Activo', termMonths: 12, installmentsPaid: 0, monthlyPayment: 1500000, outstandingPrincipal: 15000000, nextDueDate: '2026-11-22', payments: [] });
ctx.findLoanForApplication = () => ctx.db.loans[0];
ctx.renderCreditApplications();
const activatedCredit = ctx.$('#creditApplicationsList').children[0];
assert(activatedCredit?.children[0]?.children[0]?.textContent === '$ 15,000,000', 'Después de un avance parcial debe mostrarse como crédito solo el importe avanzado.');

console.log('PASS: el saldo de tarjeta se actualiza con deuda en cero.');
console.log('PASS: el tope de $500M oculta el formulario y muestra un mensaje propio.');
console.log('PASS: el aumento no aparece como crédito antes del primer avance; después muestra el importe avanzado.');
