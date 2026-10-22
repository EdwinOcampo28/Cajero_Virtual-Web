  historyFilter.addEventListener('change', renderHistory);
  creditForm.addEventListener('submit', submitCreditApplication);
  cardLimitRequestForm.addEventListener('submit', submitCardLimitIncreaseRequest);
  $('#cardLimitRequestedValue').addEventListener('change', () => { $('#cardLimitRequestError').hidden = true; });
  $('#cardFundsForm').addEventListener('submit', submitCardAdvance);
  $('#cardPaymentForm').addEventListener('submit', submitCardPayment);
  ['cardFunds', 'cardPayment'].forEach((prefix) => {
    const form = $(`#${prefix}Form`);
    form.addEventListener('input', () => clearCardFormError(prefix));
    form.addEventListener('change', () => clearCardFormError(prefix));
  });
  $('#loansList').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-loan-pay]');
    if (button) processInstallmentPayment(button.dataset.loanPay);
  });
  $('#loansList').addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-loan-abono-form]');
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector('input[name="abonoAmount"]');
    processCapitalAbono(form.dataset.loanAbonoForm, Number(input.value));
    input.value = '';
  });
  creditAmountInput.addEventListener('input', updateCreditSimulation);
  creditTermSelect.addEventListener('change', updateCreditSimulation);
