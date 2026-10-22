#!/usr/bin/env node
// Prueba de humo sin dependencias externas: canal entre dos pestañas, actualización de vistas y deduplicación.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '24-live-sync-and-refresh.js'), 'utf8');
const sharedStorage = { raw: 'snapshot-0', getItem() { return this.raw; } };
const allChannels = [];
class FakeBroadcastChannel {
  constructor(name) { this.name = name; this.handlers = {}; allChannels.push(this); }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  postMessage(message) {
    for (const channel of allChannels) {
      if (channel === this || channel.name !== this.name) continue;
      const handler = channel.handlers.message;
      if (handler) queueMicrotask(() => handler({ data: message }));
    }
  }
}

function makeTab(tabName, role) {
  const calls = [];
  const badgeLabel = { textContent: '' };
  const badge = { dataset: {}, querySelector: () => badgeLabel, setAttribute() {} };
  const reviewerView = {
    hidden: role !== 'analyst',
    querySelector: () => ({ dataset: { reviewerTab: 'tools' } })
  };
  const ctx = {
    window: {
      BroadcastChannel: FakeBroadcastChannel,
      addEventListener(name) { calls.push(['window-listener', name]); },
      setTimeout() { return 1; }, clearTimeout() {}
    },
    BroadcastChannel: FakeBroadcastChannel,
    document: {
      querySelectorAll: () => [badge],
      addEventListener(name) { calls.push(['document-listener', name]); },
      visibilityState: 'visible'
    },
    localStorage: { getItem: () => sharedStorage.raw },
    STORAGE_KEY: 'cajero_test_key', dbRevision: 0, lastPersistedRaw: 'snapshot-0',
    databaseLoadIssue: false, db: {}, reviewerSession: role === 'analyst', reviewerView,
    activeAccountId: role === 'client' ? 1 : null,
    appView: { hidden: role !== 'client' },
    createId: () => `tab-${tabName}`,
    loadDatabase() { ctx.lastPersistedRaw = sharedStorage.raw; ctx.databaseLoadIssue = false; return { loaded: sharedStorage.raw }; },
    renderApp() { calls.push(['render-app']); }, syncQuickAccountSelector() { calls.push(['sync-account-selector']); },
    renderReviewerDashboard() { calls.push(['render-reviewer']); },
    renderFinancialAuditPanel() { calls.push(['render-audit']); },
    renderMonthlyFinancialReport() { calls.push(['render-report']); }, renderAuditLog() { calls.push(['render-events']); },
    showToast() { calls.push(['toast']); }, console, Date, Math
  };
  vm.createContext(ctx);
  vm.runInContext(moduleSource, ctx, { filename: '24-live-sync-and-refresh.js' });
  return { ctx, calls, badgeLabel };
}

(async () => {
  const clientTab = makeTab('client', 'client');
  const analystTab = makeTab('analyst', 'analyst');

  // Simula un depósito ya persistido por el cliente y la notificación enviada al canal.
  sharedStorage.raw = 'snapshot-1';
  clientTab.ctx.lastPersistedRaw = sharedStorage.raw;
  clientTab.ctx.dbRevision += 1;
  clientTab.ctx.broadcastDatabaseSaved();
  await new Promise((resolve) => setTimeout(resolve, 0));

  if (!analystTab.calls.some((item) => item[0] === 'render-reviewer')) throw new Error('La vista del analista no se actualizó tras el aviso de otra pestaña.');
  if (!analystTab.calls.some((item) => item[0] === 'render-report')) throw new Error('El informe visible no se actualizó tras el aviso remoto.');
  if (analystTab.ctx.lastPersistedRaw !== 'snapshot-1') throw new Error('La pestaña del analista no cargó la última versión guardada.');

  const reportRenderCount = analystTab.calls.filter((item) => item[0] === 'render-report').length;
  // El mismo cambio anunciado también por storage debe ignorarse para no renderizar dos veces.
  analystTab.ctx.handleRealtimeExternalChange('storage', { key: 'cajero_test_key' });
  if (analystTab.calls.filter((item) => item[0] === 'render-report').length !== reportRenderCount) throw new Error('Se procesó dos veces la misma actualización.');

  // Fallback si BroadcastChannel no llega: el cambio de storage/foco también refresca al cliente.
  sharedStorage.raw = 'snapshot-2';
  analystTab.ctx.lastPersistedRaw = sharedStorage.raw;
  clientTab.ctx.handleRealtimeExternalChange('storage', { key: 'cajero_test_key' });
  if (!clientTab.calls.some((item) => item[0] === 'render-app')) throw new Error('El respaldo de storage no actualizó la vista del cliente.');

  console.log('OK: dos pestañas simuladas, actualización automática del analista y del cliente, sección activa actualizada y notificaciones duplicadas deduplicadas.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
