#!/usr/bin/env node
// Regression: analyst settings are editable, saved, audited, and accrue the old timer rate first.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function assert(condition, message) { if (!condition) throw new Error(message); }
function element(value = '') {
  const listeners = {};
  return { value, textContent: '', classList: { add() {}, remove() {} }, focus() {}, addEventListener(type, fn) { listeners[type] = fn; }, listeners };
}
const controls = new Map([
  ['simulationSettingsForm', element()], ['simulationMonthlyRateInput', element('2')],
  ['simulationTreasuryRateInput', element('1000')], ['simulationTreasuryCapInput', element('300000000')],
  ['simulationSettingsStatus', element()]
]);
const db = { simulationSettings: { monthlyInterestRate: 0.02, treasuryTimerRate: 1000, treasuryTimerIncomeCap: 300000000 }, withdrawalTreasury: { lastAccruedAt: 'old' } };
let accruedAtRate = null;
let saved = false;
let auditDetails = null;
const context = {
  db, reviewerSession: true,
  $: (selector) => controls.get(String(selector).replace(/^#/, '')) || null,
  simulationSettingsFor: (database) => ({ ...database.simulationSettings }),
  captureDatabaseRevision: () => 'revision', isDatabaseRevisionCurrent: (token) => token === 'revision',
  accrueWithdrawalTreasury(database) { accruedAtRate = database.simulationSettings.treasuryTimerRate; },
  recordAuditEvent(action, options) { auditDetails = options.details; },
  saveDatabase() { saved = true; return true; },
  renderFinancialAuditPanel() {}, renderMonthlyFinancialReport() {},
  showToast() {}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src/js/23b-simulation-settings.js'), 'utf8'), context, { filename: '23b-simulation-settings.js' });
context.renderSimulationSettingsPanel();
assert(controls.get('simulationMonthlyRateInput').value === '2' && controls.get('simulationTreasuryRateInput').value === '1000' && controls.get('simulationTreasuryCapInput').value === '300000000', 'El panel debe cargar los valores iniciales guardados.');
controls.get('simulationMonthlyRateInput').value = '1.75';
controls.get('simulationTreasuryRateInput').value = '1500';
controls.get('simulationTreasuryCapInput').value = '250000000';
controls.get('simulationSettingsForm').listeners.submit({ preventDefault() {} });
assert(accruedAtRate === 1000, 'El tiempo anterior al guardado debe liquidarse usando la tarifa previa.');
assert(db.simulationSettings.monthlyInterestRate === 0.0175 && db.simulationSettings.treasuryTimerRate === 1500 && db.simulationSettings.treasuryTimerIncomeCap === 250000000, 'El panel debe guardar tasa, ritmo y tope nuevos.');
assert(saved && auditDetails.monthlyInterestPercent === 1.75, 'El guardado debe persistir y registrar auditoría de los parámetros.');
console.log('PASS: el panel carga y guarda la tasa, el ritmo y el tope; el cambio conserva la acumulación previa.');
