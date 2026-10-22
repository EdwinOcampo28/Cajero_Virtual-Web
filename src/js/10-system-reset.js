  async function resetDemoData() {
    const transactionRevision = captureDatabaseRevision();
    const confirmed = await showAppDialog({
      type: 'confirm',
      title: 'Borrar todos los datos del sistema',
      message: 'Esta acción eliminará los saldos y todos los registros guardados del cajero: movimientos, solicitudes, créditos, desembolsos, cuotas, abonos e intereses acumulados. Las tres cuentas de prueba y sus PIN se conservarán para poder volver a entrar, pero quedarán en $ 0 y sin historial. La Tesorería también se reiniciará a $ 0 y su cronómetro empezará de nuevo. Esta acción no se puede deshacer.',
      eyebrow: 'BORRADO TOTAL · ACCIÓN IRREVERSIBLE',
      icon: '!',
      confirmText: 'Borrar todos los datos',
      danger: true
    });
    if (!confirmed) return;
    if (!isDatabaseRevisionCurrent(transactionRevision)) { abortStaleFinancialOperation(); return; }

    let previousRaw = null;
    let previousLegacyRaw = null;
    let snapshotCaptured = false;
    let resetSerialized = null;
    try {
      previousRaw = localStorage.getItem(STORAGE_KEY);
      previousLegacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      snapshotCaptured = true;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      lastPersistedRaw = null;
      databaseLoadIssue = false;
      dbRevision += 1;
      db = freshDatabase();
      recordAuditEvent('Reinicio total del sistema', {
        category: 'sistema', source: 'Analista',
        description: 'Se borraron los datos operativos y se reinició la demostración a solicitud explícita del analista.'
      });
      resetSerialized = JSON.stringify(db);
      if (!saveDatabase()) throw new Error('No se pudo persistir el reinicio.');
    } catch (error) {
      if (snapshotCaptured) {
        try {
          const currentRaw = localStorage.getItem(STORAGE_KEY);
          if (currentRaw === null || (resetSerialized !== null && currentRaw === resetSerialized)) {
            // Restore only if the storage still contains our attempted reset. Never overwrite a
            // different value that another tab may have committed while the reset was running.
            if (previousRaw === null) localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, previousRaw);
            if (previousLegacyRaw === null) localStorage.removeItem(LEGACY_STORAGE_KEY);
            else localStorage.setItem(LEGACY_STORAGE_KEY, previousLegacyRaw);
            lastPersistedRaw = previousRaw;
            databaseLoadIssue = false;
            dbRevision += 1;
            db = loadDatabase();
          } else if (currentRaw === previousRaw) {
            // The primary store was not changed; restore the legacy key only if reset touched it.
            if (previousLegacyRaw === null) localStorage.removeItem(LEGACY_STORAGE_KEY);
            else localStorage.setItem(LEGACY_STORAGE_KEY, previousLegacyRaw);
            lastPersistedRaw = previousRaw;
            databaseLoadIssue = false;
            dbRevision += 1;
            db = loadDatabase();
          } else {
            databaseLoadIssue = false;
            dbRevision += 1;
            db = loadDatabase();
          }
        } catch (rollbackError) {
          databaseLoadIssue = true;
        }
      } else {
        databaseLoadIssue = true;
      }
      showToast('No se pudo completar el borrado de forma segura. Se intentó recuperar el estado anterior sin sobrescribir cambios de otra pestaña.', 'error');
      return;
    }

    clearTabSession();
    activeAccountId = null;
    reviewerSession = false;
    treasurySession = false;
    if (typeof stopTreasuryTimer === 'function') stopTreasuryTimer();
    closeModal();
    appView.hidden = true;
    reviewerView.hidden = true;
    reviewerLoginView.hidden = true;
    if (treasuryLoginView) treasuryLoginView.hidden = true;
    if (treasuryView) treasuryView.hidden = true;
    loginView.hidden = false;
    loginError.hidden = true;
    pinInput.value = '';
    reviewerPinInput.value = '';
    showToast('Todos los datos operativos fueron borrados. Las tres cuentas y la Tesorería quedaron en $ 0 y sin historial.');
    accountSelect.focus();
  }
