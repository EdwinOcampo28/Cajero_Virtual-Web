  // Resumen histórico acumulado por titular y desglose independiente de comisiones.
  // Los importes proceden de movimientos y pagos registrados, no de estimaciones futuras.
  function getReviewerClientFinancialSummary(accountId = null) {
    const allAccounts = Array.isArray(db?.accounts) ? db.accounts.slice(1).filter(Boolean) : [];
    const accounts = allAccounts.filter((item) => accountId === null || Number(item.id) === Number(accountId));
    const accountIds = new Set(accounts.map((item) => Number(item.id)));
    const histories = accounts.flatMap((item) => (Array.isArray(item.history) ? item.history : []).map((movement) => ({ ...movement, accountId: Number(item.id) })));
    if (accountId === null && Array.isArray(db?.withdrawalTreasury?.history)) histories.push(...db.withdrawalTreasury.history.map((movement) => ({ ...movement, accountId: null })));
    const loans = (Array.isArray(db?.loans) ? db.loans : []).filter((loan) => accountIds.has(Number(loan.accountId)));
    const payments = loans.flatMap((loan) => (Array.isArray(loan.payments) ? loan.payments : []).map((payment) => ({ ...payment, loanId: loan.id, accountId: Number(loan.accountId) })));
    const sumHistory = (predicate) => roundMoney(histories.filter(predicate).reduce((sum, movement) => sum + Math.max(0, Number(movement.amount) || 0), 0));
    const sumPayments = (field) => roundMoney(payments.reduce((sum, payment) => sum + Math.max(0, Number(payment[field]) || 0), 0));
    const operationFee = (pattern) => sumHistory((movement) => movement.type === 'operation_fee' && pattern.test(String(movement.description || '')));

    const depositFees = operationFee(/dep[oó]sito/i);
    const withdrawalFees = operationFee(/retiro/i);
    const transferFees = operationFee(/transferencia/i);
    const treasuryDistributionFees = operationFee(/reparto autom[aá]tico de tesorer[ií]a/i);
    const advanceFees = sumHistory((movement) => movement.type === 'card_advance_fee');
    const totalFees = roundMoney(depositFees + withdrawalFees + transferFees + treasuryDistributionFees + advanceFees);
    const archivedFinancial = db?.archivedFinancialSummary || {};
    const sumArchivedByAccount = (key) => roundMoney([...accountIds].reduce((sum, id) => sum + Math.max(0, Number(archivedFinancial[key]?.[id]) || 0), 0));
    const archivedPaymentsAmount = sumArchivedByAccount('paymentsAmountByAccount');
    const archivedPrincipalPaid = sumArchivedByAccount('principalRecoveredByAccount');
    const archivedInterestPaid = sumArchivedByAccount('interestEarnedByAccount');
    const archivedPaymentCount = sumArchivedByAccount('paymentCountByAccount');
    const installmentPayments = roundMoney(sumPayments('amount') + archivedPaymentsAmount);
    const capitalPaid = roundMoney(sumPayments('principal') + archivedPrincipalPaid);
    const interestPaid = roundMoney(sumPayments('interest') + archivedInterestPaid);
    const totalOriginalDisbursements = roundMoney(accounts.reduce((sum, item) => sum + totalDisbursedForAccount(Number(item.id)), 0));
    const currentDebt = roundMoney(loans.reduce((sum, loan) => sum + Math.max(0, Number(loan.outstandingPrincipal) || 0), 0));
    const availableCardFunds = roundMoney(accounts.reduce((sum, item) => sum + (typeof availableAdvancesForCard === 'function'
      ? availableAdvancesForCard(item.card)
      : Math.max(0, (Number(item.card?.funds) || 0) + (Number(item.card?.recoveredFunds) || 0))), 0));
    const currentSavings = roundMoney(accounts.reduce((sum, item) => sum + Math.max(0, Number(item.balance) || 0), 0));
    const grossDeposits = sumHistory((movement) => movement.type === 'deposit');
    const withdrawals = sumHistory((movement) => movement.type === 'withdraw');
    const withdrawalsReceived = sumHistory((movement) => movement.type === 'withdrawal_received');
    const transfersSent = sumHistory((movement) => movement.type === 'transfer' && movement.direction === 'out');
    const transfersReceived = sumHistory((movement) => movement.type === 'transfer' && movement.direction === 'in');
    const advancesToSavings = sumHistory((movement) => movement.type === 'card_advance' && movement.direction === 'in');
    const paidToSystem = roundMoney(installmentPayments + totalFees);

    return {
      accountCount: accounts.length,
      currentSavings,
      availableCardFunds,
      currentDebt,
      totalOriginalDisbursements,
      installmentPayments,
      capitalPaid,
      interestPaid,
      depositFees,
      withdrawalFees,
      transferFees,
      treasuryDistributionFees,
      advanceFees,
      totalFees,
      paidToSystem,
      grossDeposits,
      withdrawals,
      withdrawalsReceived,
      transfersSent,
      transfersReceived,
      advancesToSavings,
      pendingCreditApplications: (Array.isArray(db?.creditApplications) ? db.creditApplications : []).filter((item) => accountIds.has(Number(item.accountId)) && (item.status || 'En revisión') === 'En revisión').length,
      activeLoans: loans.filter((loan) => loan.status === 'Activo' && Number(loan.outstandingPrincipal) > 0).length,
      movementCount: histories.reduce((sum, movement) => sum + Math.max(1, Number(movement.movementCount) || 1), 0),
      paymentCount: payments.length + archivedPaymentCount
    };
  }

  function renderReviewerCommissionCards() {
    const summary = getReviewerClientFinancialSummary(null);
    const elements = [
      ['reviewerFundDepositAndTreasuryFees', roundMoney(summary.depositFees + summary.treasuryDistributionFees)],
      ['reviewerFundWithdrawalFees', summary.withdrawalFees],
      ['reviewerFundTransferFees', summary.transferFees],

      ['reviewerFundFees', summary.advanceFees]
    ];
    elements.forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = money(value);
    });
  }

  function renderReviewerClientSummary() {
    const container = $('#reviewerClientSummaryCards');
    if (!container) return;
    const accountId = getReviewerSelectedClientId();
    const accountName = accountId === null ? 'Todos los clientes' : (db.accounts?.[accountId]?.name || 'Cliente seleccionado');
    const summary = getReviewerClientFinancialSummary(accountId);
    const heading = $('#reviewerClientSummaryHeading');
    const scope = $('#reviewerClientSummaryScope');
    const description = $('#reviewerClientSummaryDescription');
    if (heading) heading.textContent = accountId === null ? 'Resumen de todos los clientes' : `Resumen de ${accountName}`;
    if (scope) scope.textContent = accountName;
    if (description) description.textContent = accountId === null
      ? 'Acumulado de todos los titulares: cuotas, abonos, comisiones y actividad de cuentas. Los saldos son la fotografía actual.'
      : 'Acumulado de este titular: cuánto ha pagado en cuotas, capital, intereses y cada comisión, además de sus saldos y movimientos actuales.';

    const cards = [
      ['Total pagado en todo', summary.paidToSystem, 'Cuotas, abonos y todas las comisiones', 'is-positive'],
      ['Cuotas y abonos pagados', summary.installmentPayments, `${summary.paymentCount} pago(s) registrados`, ''],
      ['Capital amortizado', summary.capitalPaid, 'Capital devuelto mediante cuotas y abonos', 'is-positive'],
      ['Intereses pagados', summary.interestPaid, 'Solo interés efectivamente cobrado', 'is-positive'],
      ['Comisiones por depósitos', summary.depositFees, 'Costo acumulado de depósitos', 'is-fee-deposit'],
      ['Comisiones por retiros', summary.withdrawalFees, 'Costo acumulado de retiros', 'is-fee-withdraw'],
      ['Comisiones por transferencias', summary.transferFees, 'Costo acumulado de transferencias', 'is-fee-transfer'],
      ['Comisiones por reparto de Tesorería', summary.treasuryDistributionFees, 'Cobro de $20.000 por cuenta en cada reparto', 'is-fee-transfer'],
      ['Comisiones por avances', summary.advanceFees, 'Costo acumulado de avances', 'is-fee-advance'],
      ['Total de comisiones', summary.totalFees, 'Suma de todos los tipos de comisión', 'is-positive'],
      ['Saldo actual de ahorros', summary.currentSavings, 'Saldo disponible de las cuentas seleccionadas', 'is-balance'],
      ['Disponible en tarjeta', summary.availableCardFunds, 'Fondos desembolsados y capital recuperado disponibles', 'is-balance'],
      ['Capital pendiente', summary.currentDebt, `${summary.activeLoans} crédito(s) activo(s)`, 'is-warning'],
      ['Desembolsos originales', summary.totalOriginalDisbursements, 'Importe original de créditos, sin contar traslados a ahorros', ''],
      ['Depósitos brutos', summary.grossDeposits, 'Importes ingresados antes de la comisión', ''],
      ['Retiros realizados', summary.withdrawals, 'Importe retirado por clientes', ''],
      ['Retiros recibidos', summary.withdrawalsReceived, 'Importe acreditado en tesorería', 'is-positive'],
      ['Transferencias enviadas', summary.transfersSent, 'Importe enviado a otras cuentas', ''],
      ['Transferencias recibidas', summary.transfersReceived, 'Importe recibido de otros titulares', ''],
      ['Avances a ahorros', summary.advancesToSavings, 'Fondos trasladados desde tarjeta a ahorros', '']
    ];
    container.replaceChildren();
    cards.forEach(([label, value, detail, style]) => {
      const card = document.createElement('article');
      card.className = `reviewer-client-summary-card${style ? ` ${style}` : ''}`;
      const caption = document.createElement('span'); caption.textContent = label;
      const amount = document.createElement('strong'); amount.textContent = money(value);
      const note = document.createElement('small'); note.textContent = detail;
      card.append(caption, amount, note);
      container.append(card);
    });
  }

  // La sesión del analista puede restaurarse antes de cargar este módulo al duplicar o recargar una pestaña.
  // Renderizamos de nuevo las tarjetas al terminar de definir los renderizadores para evitar un panel vacío.
  if (typeof reviewerSession !== 'undefined' && reviewerSession && typeof reviewerView !== 'undefined' && reviewerView && !reviewerView.hidden) {
    renderReviewerCommissionCards();
    renderReviewerClientSummary();
  }
