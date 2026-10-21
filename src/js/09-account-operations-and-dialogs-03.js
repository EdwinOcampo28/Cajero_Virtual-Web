  function finalizeOperation(message) {
    saveDatabase();
    closeModal();
    renderApp();
    if (currentView === 'history') renderHistory();
    showToast(message);
  }

  function showAppDialog({
    type = 'confirm',
    title = 'Confirmar operación',
    message = '',
    eyebrow = 'CAJERO VIRTUAL',
    icon = '✓',
    confirmText = 'Continuar',
    cancelText = 'Cancelar',
    defaultValue = '',
    inputLabel = 'Nota para el expediente',
    danger = false
  } = {}) {
    if (appDialogResolver) return Promise.resolve(null);

    appDialogType = type;
    appDialogPreviousFocus = document.activeElement;
    $('#appDialogTitle').textContent = title;
    $('#appDialogMessage').textContent = message;
    $('#appDialogEyebrow').textContent = eyebrow;
    $('#appDialogIcon').textContent = icon;
    $('#appDialogConfirm').textContent = confirmText;
    $('#appDialogCancel').textContent = cancelText;
    $('#appDialogInputLabel').textContent = inputLabel;
    $('#appDialogInput').value = String(defaultValue ?? '');
    $('#appDialogInputWrap').hidden = type !== 'prompt';
    $('#appDialogCancel').hidden = type === 'alert';
    $('#appDialogConfirm').classList.toggle('button-danger', danger);
    appDialogCard.classList.toggle('is-danger', danger);
    appDialogCard.classList.toggle('is-alert', type === 'alert');
    appDialogOverlay.hidden = false;
    document.body.classList.add('dialog-open');

    return new Promise((resolve) => {
      appDialogResolver = resolve;
      const focusTarget = type === 'prompt'
        ? $('#appDialogInput')
        : (type === 'alert' ? $('#appDialogConfirm') : $('#appDialogCancel'));
      focusTarget.focus();
    });
  }

  function finishAppDialog(accepted) {
    if (!appDialogResolver) return;
    let result;
    if (appDialogType === 'alert') {
      result = true;
    } else if (appDialogType === 'prompt') {
      result = accepted ? $('#appDialogInput').value.trim() : null;
    } else {
      result = Boolean(accepted);
    }

    const resolve = appDialogResolver;
    appDialogResolver = null;
    appDialogOverlay.hidden = true;
    document.body.classList.remove('dialog-open');
    const previousFocus = appDialogPreviousFocus;
    appDialogPreviousFocus = null;
    resolve(result);
    if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) {
      previousFocus.focus();
    }
  }
