  // Sincronización reactiva entre pestañas del mismo navegador.
  // BroadcastChannel acelera las notificaciones; el evento storage y los eventos
  // de foco/visibilidad sirven como respaldo. Solo se intercambian avisos, nunca datos.
  const REALTIME_CHANNEL_NAME = 'cajero-virtual-live-sync-v1';
  const REALTIME_SOURCE_ID = `tab-${createId()}`;
  let realtimeChannel = null;
  let realtimeStatusTimer = null;
  let realtimeRefreshInProgress = false;
  let realtimeReady = false;

  function setRealtimeSyncStatus(state, label) {
    document.querySelectorAll('[data-realtime-sync-status]').forEach((badge) => {
      badge.dataset.syncState = state;
      const text = badge.querySelector('.realtime-sync-label');
      if (text) text.textContent = label;
      badge.setAttribute('aria-label', label);
    });
  }

  function restoreRealtimeReadyStatus() {
    setRealtimeSyncStatus(realtimeReady ? 'ready' : 'fallback', realtimeReady ? 'En tiempo real' : 'Sincronización automática');
  }

  function broadcastDatabaseSaved() {
    // La escritura en localStorage es la fuente de verdad; el canal anuncia que cambió.
    try {
      if (realtimeChannel) {
        realtimeChannel.postMessage({
          type: 'database-updated',
          sourceId: REALTIME_SOURCE_ID,
          revision: dbRevision,
          savedAt: Date.now()
        });
      }
    } catch (error) {
      realtimeReady = false;
    }
    restoreRealtimeReadyStatus();
  }

  function refreshRealtimeVisibleViews(options = {}) {
    const shouldNotify = options.notify !== false;
    if (reviewerSession && reviewerView && !reviewerView.hidden) {
      const activePage = reviewerView.querySelector('[data-reviewer-tab][aria-current="page"]')?.dataset.reviewerTab || 'overview';
      renderReviewerDashboard();
      // El dashboard mantiene los indicadores globales al día; estas secciones largas
      // se renderizan explícitamente solo si el analista está viéndolas.
      if (activePage === 'tools') {
        if (typeof renderFinancialAuditPanel === 'function') renderFinancialAuditPanel();
        if (typeof renderMonthlyFinancialReport === 'function') renderMonthlyFinancialReport();
      }
      if (activePage === 'settings' && typeof renderSimulationSettingsPanel === 'function') renderSimulationSettingsPanel();
      if (activePage === 'events' && typeof renderAuditLog === 'function') renderAuditLog();
    } else if (typeof treasurySession !== 'undefined' && treasurySession && treasuryView && !treasuryView.hidden && typeof renderTreasuryView === 'function') {
      renderTreasuryView(true);
    } else if (activeAccountId !== null && appView && !appView.hidden) {
      renderApp();
      if (typeof syncQuickAccountSelector === 'function') syncQuickAccountSelector();
    }
    if (shouldNotify) {
      setRealtimeSyncStatus('updated', 'Sincronizado');
      if (realtimeStatusTimer !== null) window.clearTimeout(realtimeStatusTimer);
      realtimeStatusTimer = window.setTimeout(restoreRealtimeReadyStatus, 2200);
    }
  }

  function handleRealtimeExternalChange(source, event) {
    if (realtimeRefreshInProgress) return false;
    if (source === 'storage' && event && event.key !== STORAGE_KEY && event.key !== null) return false;
    if (source === 'broadcast' && event?.data?.sourceId === REALTIME_SOURCE_ID) return false;

    let storedNow;
    try {
      storedNow = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      setRealtimeSyncStatus('error', 'Almacenamiento no disponible');
      return false;
    }
    // storage + BroadcastChannel pueden anunciar el mismo guardado. No se vuelve a renderizar.
    if (storedNow === lastPersistedRaw) return false;

    realtimeRefreshInProgress = true;
    try {
      db = loadDatabase();
      dbRevision += 1;
      if (databaseLoadIssue) {
        setRealtimeSyncStatus('error', 'Revisar datos guardados');
        if (typeof showToast === 'function') {
          showToast('Los datos modificados desde otra pestaña no se pudieron validar. No se guardará encima del archivo; importa una copia válida o revisa el almacenamiento.', 'error');
        }
        refreshRealtimeVisibleViews({ notify: false, reason: source });
        return true;
      }
      refreshRealtimeVisibleViews({ notify: true, reason: source });
      return true;
    } finally {
      realtimeRefreshInProgress = false;
    }
  }

  function checkRealtimeStorage() {
    handleRealtimeExternalChange('focus', null);
  }

  try {
    if ('BroadcastChannel' in window) {
      realtimeChannel = new BroadcastChannel(REALTIME_CHANNEL_NAME);
      realtimeChannel.addEventListener('message', (event) => {
        if (event.data?.type === 'database-updated') handleRealtimeExternalChange('broadcast', event);
      });
      realtimeReady = true;
    }
  } catch (error) {
    realtimeChannel = null;
    realtimeReady = false;
  }

  window.addEventListener('focus', checkRealtimeStorage);
  window.addEventListener('pageshow', checkRealtimeStorage);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkRealtimeStorage();
  });
  window.addEventListener('online', checkRealtimeStorage);
  restoreRealtimeReadyStatus();
  if (typeof startSimulationAutomation === 'function') startSimulationAutomation();
