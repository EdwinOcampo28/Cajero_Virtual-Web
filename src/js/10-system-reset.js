  async function resetDemoData() {
    const confirmed = await showAppDialog({
      type: 'confirm',
      title: 'Borrar todos los datos del sistema',
      message: 'Esta acción eliminará los saldos y todos los registros guardados del cajero: movimientos, solicitudes, créditos, desembolsos, cuotas, abonos e intereses acumulados. Las tres cuentas de prueba y sus PIN se conservarán para poder volver a entrar, pero quedarán en $ 0 y sin historial. Esta acción no se puede deshacer.',
      eyebrow: 'BORRADO TOTAL · ACCIÓN IRREVERSIBLE',
      icon: '!',
      confirmText: 'Borrar todos los datos',
      danger: true
    });
    if (!confirmed) return;
    // Borra todos los datos administrados por esta aplicación, sin tocar el almacenamiento de otros sitios.
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      showToast('El navegador no permitió borrar los datos guardados.', 'error');
      return;
    }
    db = freshDatabase();
    saveDatabase();
    clearTabSession();
    activeAccountId = null;
    reviewerSession = false;
    closeModal();
    appView.hidden = true;
    reviewerView.hidden = true;
    reviewerLoginView.hidden = true;
    loginView.hidden = false;
    loginError.hidden = true;
    pinInput.value = '';
    reviewerPinInput.value = '';
    showToast('Todos los datos operativos fueron borrados. Las tres cuentas quedaron en $ 0 y sin historial.');
    accountSelect.focus();
  }
