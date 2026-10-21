  function renderFinancialHistories() {
    const current = account();
    if (!current) return;

    const cardHistory = Array.isArray(current.card?.history) ? current.card.history.slice() : [];
    const cardList = $('#cardActivityList');
    cardList.replaceChildren();
    cardHistory.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((item) => cardList.append(createMovementRow(item)));
    $('#emptyCardActivity').hidden = cardHistory.length > 0;
    cardList.hidden = cardHistory.length === 0;
    $('#financialCardHistoryCount').textContent = String(cardHistory.length);

    const loans = (db.loans || []).filter((loan) => loan.accountId === activeAccountId);
    const payments = loans.flatMap((loan) => (Array.isArray(loan.payments) ? loan.payments : []).map((payment) => ({
      id: payment.id || createId(),
      type: payment.type === 'Cuota' ? 'loan_payment' : 'loan_abono',
      amount: roundMoney(payment.amount),
      direction: 'out',
      date: payment.date,
      description: `${payment.type === 'Cuota' ? `Pago de cuota ${payment.installmentNumber || ''}` : payment.type === 'Liquidación' ? 'Liquidación anticipada' : 'Abono a capital'} · Crédito ${String(loan.id).slice(-7).toUpperCase()} · Capital: ${money(payment.principal)} · Interés: ${money(payment.interest)}`
    }))).sort((a, b) => new Date(b.date) - new Date(a.date));
    const paymentList = $('#loanPaymentHistoryList');
    paymentList.replaceChildren();
    payments.forEach((item) => paymentList.append(createMovementRow(item)));
    $('#emptyLoanPaymentHistory').hidden = payments.length > 0;
    paymentList.hidden = payments.length === 0;
    $('#financialLoanPaymentCount').textContent = String(payments.length);
    $('#financialApplicationsCount').textContent = String((db.creditApplications || []).filter((item) => item.accountId === activeAccountId).length);
  }

  function cardFormProblem(prefix, message) {
    const error = $(`#${prefix}Error`);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function clearCardFormError(prefix) {
    const error = $(`#${prefix}Error`);
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
  }

  function validIntegerAmount(value) {
    return Number.isFinite(value) && Number.isInteger(value) && value > 0;
  }
