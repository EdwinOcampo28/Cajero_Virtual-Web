  $('#appDialogConfirm').addEventListener('click', () => finishAppDialog(true));
  $('#appDialogCancel').addEventListener('click', () => finishAppDialog(false));
  appDialogOverlay.querySelector('.app-dialog-close').addEventListener('click', () => finishAppDialog(false));
  appDialogOverlay.addEventListener('click', (event) => {
    if (event.target === appDialogOverlay) finishAppDialog(false);
  });
  $('#closeModalButton').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (event) => { if (event.target === modalOverlay) closeModal(); });
  operationForm.addEventListener('submit', submitOperation);
  $('#quickAmounts').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-amount]');
    if (!button) return;
    amountInput.value = button.dataset.amount;
    operationError.hidden = true;
    amountInput.setAttribute('aria-invalid', 'false');
    $('#quickAmounts').querySelectorAll('.quick-amount').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    amountInput.focus();
  });
  amountInput.addEventListener('input', () => {
    $('#quickAmounts').querySelectorAll('.quick-amount').forEach((button) => {
      const selected = button.dataset.amount === amountInput.value;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    amountInput.setAttribute('aria-invalid', 'false');
    operationError.hidden = true;
  });
