  // Copias de seguridad locales. Solo el analista puede exportar/importar el estado completo.
  const BACKUP_FORMAT = 'cajero-virtual-backup';
  const BACKUP_SCHEMA_VERSION = 1;
  const MAX_BACKUP_FILE_BYTES = 15 * 1024 * 1024;

  function makeBackupEnvelope() {
    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      app: 'Cajero Virtual',
      appVersion: 'v26.0',
      exportedAt: new Date().toISOString(),
      database: JSON.parse(JSON.stringify(db))
    };
  }

  function validateBackupDatabase(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'El archivo no contiene una base de datos válida.';
    if (!Array.isArray(data.accounts) || data.accounts.length !== 4 || data.accounts[0] !== null) return 'La copia no contiene las tres cuentas esperadas.';
    if (!Array.isArray(data.creditApplications) || !Array.isArray(data.loans) || !Array.isArray(data.limitIncreaseRequests)) return 'Faltan listas de créditos, préstamos o solicitudes.';
    if (!Number.isFinite(Number(data.advanceFeesCollected ?? 0)) || Number(data.advanceFeesCollected ?? 0) < 0) return 'El acumulado de comisiones por avances no es válido.';
    if (!Number.isFinite(Number(data.operationFeesCollected ?? 0)) || Number(data.operationFeesCollected ?? 0) < 0) return 'El acumulado de comisiones de operaciones no es válido.';

    for (let i = 1; i <= 3; i += 1) {
      const accountRecord = data.accounts[i];
      if (!accountRecord || accountRecord.id !== i || !Number.isFinite(accountRecord.balance) || accountRecord.balance < 0 || accountRecord.balance > MAX_ACCOUNT_BALANCE || !Array.isArray(accountRecord.history)) {
        return `La información de la cuenta ${i} no es válida o excede el saldo máximo de ahorros.`;
      }
      const card = accountRecord.card;
      if (!card || !Number.isFinite(card.limit) || card.limit < MAX_CARD_FUNDS || card.limit > MAX_CARD_LIMIT || !Number.isFinite(card.funds) || card.funds < 0 || !Number.isFinite(card.recoveredFunds ?? 0) || Number(card.recoveredFunds ?? 0) < 0 || card.funds + Number(card.recoveredFunds ?? 0) > card.limit || !Array.isArray(card.history)) {
        return `La tarjeta de la cuenta ${i} contiene un saldo o cupo no válido.`;
      }
    }
    for (const loan of data.loans) {
      if (!loan || typeof loan.id !== 'string' || !Number.isInteger(loan.accountId) || loan.accountId < 1 || loan.accountId > 3 || !Number.isFinite(loan.outstandingPrincipal) || loan.outstandingPrincipal < 0 || !Array.isArray(loan.payments)) return 'La copia contiene un crédito o pago con datos no válidos.';
    }
    for (const application of data.creditApplications) {
      if (!application || typeof application.id !== 'string' || !Number.isInteger(application.accountId) || application.accountId < 1 || application.accountId > 3 || !Number.isFinite(application.amount) || application.amount <= 0 || typeof application.date !== 'string') return 'La copia contiene una solicitud de crédito no válida.';
    }
    for (const request of data.limitIncreaseRequests) {
      if (!request || typeof request.id !== 'string' || !Number.isInteger(request.accountId) || request.accountId < 1 || request.accountId > 3 || !Number.isFinite(request.requestedLimit) || request.requestedLimit < MAX_CARD_FUNDS || request.requestedLimit > MAX_CARD_LIMIT || typeof request.date !== 'string') return 'La copia contiene una solicitud de aumento de cupo no válida.';
    }
    return '';
  }

  function exportSystemBackup() {
    if (!reviewerSession) {
      showToast('Solo el analista puede exportar una copia completa del sistema.', 'error');
      return;
    }
    try {
      const envelope = makeBackupEnvelope();
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `Cajero_Virtual_Copia_Seguridad_${stamp}.json`;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast('Copia de seguridad exportada. Guárdala en un lugar seguro.');
    } catch (error) {
      showToast('No se pudo exportar la copia de seguridad.', 'error');
    }
  }

  async function importSystemBackupFile(file) {
    if (!reviewerSession) {
      showToast('Solo el analista puede importar una copia completa del sistema.', 'error');
      return;
    }
    if (!file) return;
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      showToast('El archivo supera el tamaño máximo permitido de 15 MB.', 'error');
      return;
    }

    let envelope;
    try {
      envelope = JSON.parse(await file.text());
    } catch (error) {
      showToast('No se pudo leer el archivo. Selecciona una copia JSON válida.', 'error');
      return;
    }
    if (envelope?.format !== BACKUP_FORMAT || envelope?.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      showToast('El archivo no es una copia de seguridad válida del Cajero Virtual.', 'error');
      return;
    }
    const validationError = validateBackupDatabase(envelope.database);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const counts = `${envelope.database.loans.length} créditos, ${envelope.database.creditApplications.length} solicitudes y ${envelope.database.limitIncreaseRequests.length} solicitudes de cupo`;
    const confirmed = await showAppDialog({
      type: 'confirm',
      title: 'Restaurar copia de seguridad',
      message: `El archivo contiene ${counts}. Al continuar, reemplazarás todos los datos actuales de este navegador por los de la copia exportada el ${shortDateTime(envelope.exportedAt || '')}. Esta acción no se puede deshacer sin otra copia. ¿Deseas continuar?`,
      eyebrow: 'IMPORTAR RESPALDO',
      icon: '!',
      confirmText: 'Restaurar datos',
      danger: true
    });
    if (!confirmed) return;

    const previousRaw = localStorage.getItem(STORAGE_KEY);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope.database));
      const restored = loadDatabase();
      if (!restored || !Array.isArray(restored.accounts) || restored.accounts.length !== 4 || !Array.isArray(restored.loans) || !Array.isArray(restored.creditApplications)) {
        throw new Error('La copia no pudo normalizarse.');
      }
      db = restored;
      saveDatabase();
      if (reviewerSession) renderReviewerDashboard();
      else if (activeAccountId !== null) renderApp();
      showToast('Copia restaurada correctamente. Los datos anteriores fueron reemplazados.');
    } catch (error) {
      try {
        if (previousRaw === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, previousRaw);
      } catch (rollbackError) { /* Si el almacenamiento está bloqueado, se conserva el aviso original. */ }
      db = loadDatabase();
      if (reviewerSession) renderReviewerDashboard();
      else if (activeAccountId !== null) renderApp();
      showToast('No se pudo restaurar la copia; se intentó conservar los datos anteriores.', 'error');
    }
  }

  const exportBackupButton = document.querySelector('#exportBackupButton');
  const importBackupButton = document.querySelector('#importBackupButton');
  const importBackupFile = document.querySelector('#importBackupFile');
  if (exportBackupButton) exportBackupButton.addEventListener('click', exportSystemBackup);
  if (importBackupButton && importBackupFile) {
    importBackupButton.addEventListener('click', () => {
      if (reviewerSession) importBackupFile.click();
      else showToast('Inicia sesión como analista para importar una copia.', 'error');
    });
    importBackupFile.addEventListener('change', async () => {
      const [file] = importBackupFile.files || [];
      importBackupFile.value = '';
      await importSystemBackupFile(file);
    });
  }
