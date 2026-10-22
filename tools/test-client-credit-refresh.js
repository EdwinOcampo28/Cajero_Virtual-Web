#!/usr/bin/env node
// Prueba de regresión: cambios de crédito y aumento de cupo deben refrescarse
// aun cuando su pantalla esté oculta, sin reconstruir formularios de cuotas ocultos.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '02-format-navigation-and-history-03.js'), 'utf8');

function makeElement(id = '') {
  return {
    id, textContent: '', innerHTML: '', hidden: false, value: '', className: '', children: [],
    dataset: {}, style: {},
    replaceChildren(...items) { this.children = [...items]; },
    append(...items) { this.children.push(...items); },
    setAttribute() {}, removeAttribute() {},
    classList: { toggle() {}, add() {}, remove() {} }
  };
}
const elements = new Map();
const document = { createElement: () => makeElement(), querySelectorAll: () => [] };
const calls = [];
const current = { id: 1, name: 'Edwin Ocampo', accountNumber: '7184 3059 6247', balance: 0, withdrawnToday: 0, history: [], card: { number: '5412804310001045', funds: 0, recoveredFunds: 0, debt: 0 } };
const ctx = {
  document, Date, Intl, String, Number, Math, Array,
  $: (selector) => { const id = String(selector).replace(/^#/, ''); if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id); },
  account: () => current,
  activeAccountId: 1,
  currentView: 'overview',
  MAX_WITHDRAWAL_AMOUNT: 20000000,
  resetDailyWithdrawalIfNeeded() {}, initials: () => 'EO', escapeHTML: (s) => s,
  money: (v) => '$ ' + String(Math.round(Number(v) || 0)),
  moneyShort: (v) => String(Math.round(Number(v) || 0)),
  capitalize: (s) => s, fullDate: () => 'miércoles, 21 de octubre de 2026',
  localDateKey: () => '2026-10-21', shortDateTime: () => '21 oct.',
  renderHistory() { calls.push('history'); }, renderCardView() { calls.push('card'); ctx.renderCardLimitRequestSection(current); },
  renderCardLimitRequestSection() { calls.push('limit-request'); },
  updateCreditSimulation() { calls.push('credit-simulation'); },
  renderLoans() { calls.push('loans'); },
  renderCreditApplications() { calls.push('credit-applications'); },
  renderCreditApplicationFormState() { calls.push('credit-form-state'); },
  renderFinancialHistories() { calls.push('financial-history'); },
  createMovementRow() { return makeElement(); }
};
vm.createContext(ctx);
vm.runInContext(source, ctx, { filename: '02-format-navigation-and-history-03.js' });

function expect(condition, message) { if (!condition) throw new Error(message); }
ctx.renderApp();
expect(calls.includes('limit-request'), 'El estado de aumento de cupo no se refresca en Resumen.');
expect(calls.includes('credit-applications'), 'Las solicitudes de crédito no se refrescan en Resumen.');
expect(calls.includes('credit-form-state'), 'El botón de solicitud de crédito no se refresca en Resumen.');
expect(!calls.includes('loans'), 'Los formularios de cuotas ocultos no deben reconstruirse en Resumen.');

calls.length = 0;
ctx.currentView = 'credits';
ctx.renderApp();
expect(calls.includes('credit-simulation') && calls.includes('loans'), 'La pantalla de Créditos no refresca simulación/cuotas.');
expect(calls.includes('limit-request'), 'El estado de aumento de cupo no se refresca mientras se ve Créditos.');
expect(calls.includes('credit-applications') && calls.includes('credit-form-state'), 'La pantalla de Créditos no refresca solicitudes y botón.');

calls.length = 0;
ctx.currentView = 'finance';
ctx.renderApp();
expect(calls.includes('card') && calls.includes('limit-request'), 'La pantalla Tarjeta no refresca datos de aumento de cupo.');
expect(calls.includes('credit-applications') && calls.includes('credit-form-state'), 'Las solicitudes de crédito no se refrescan mientras se ve Tarjeta.');

console.log('PASS: solicitudes de crédito y aumentos de cupo se refrescan en Resumen, Tarjeta y Créditos; formularios de cuotas ocultos no se reconstruyen.');
