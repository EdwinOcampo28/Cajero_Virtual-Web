  async function processCapitalAbono(loanId, rawAmount) {
    const loan = (db.loans || []).find((item) => item.id === loanId && item.accountId === activeAccountId);
    const current = account();
    const amount = Number(rawAmount);
    if (!loan || !current || loan.status !== 'Activo') return;
    if (!Number.isInteger(amount) || amount <= 0) return showToast('Ingresa un abono entero mayor que cero.', 'error');
    if (amount > current.balance) return showToast(`No tienes saldo suficiente. Tu saldo disponible es ${money(current.balance)}.`, 'error');
    if (amount > loan.outstandingPrincipal) return showToast(`El abono no puede superar el capital pendiente de ${money(loan.outstandingPrincipal)}.`, 'error');
    const willClose = amount === loan.outstandingPrincipal;
    const transactionRevision = captureDatabaseRevision();
    const confirmed = await showAppDialog({
      type: 'confirm',
      title: willClose ? 'Liquidar crédito' : 'Confirmar abono a capital',
      message: `Abono: ${money(amount)}\n\nEste importe se descontará de tu saldo de ahorros. Puedes usar fondos que hayas trasladado desde el saldo de desembolsos previos. El pago ${willClose ? 'liquidará todo el capital pendiente del crédito.' : 'reducirá el capital pendiente y el plazo estimado, manteniendo la cuota pactada.'}` ,
      eyebrow: 'ABONO EXTRAORDINARIO',
      icon: '↓',
      confirmText: willClose ? 'Liquidar crédito' : 'Confirmar abono'
    });
    if (!confirmed) return;
    if (!isDatabaseRevisionCurrent(transactionRevision)) { abortStaleFinancialOperation(); return; }
    current.balance = roundMoney(current.balance - amount);
    loan.outstandingPrincipal = Math.max(0, roundMoney(loan.outstandingPrincipal - amount));
    restoreCardAdvanceBalance(current, amount);
    loan.payments = Array.isArray(loan.payments) ? loan.payments : [];
    loan.payments.push({ id: createId(), type: willClose ? 'Liquidación' : 'Abono a capital', amount, interest: 0, principal: amount, date: new Date().toISOString(), dueDate: loan.nextDueDate, remainingPrincipal: loan.outstandingPrincipal });
    recordMovement(activeAccountId, 'loan_abono', amount, `${willClose ? 'Liquidación' : 'Abono a capital'} de crédito ${String(loan.id).slice(-7)}`, 'out');
    if (loan.outstandingPrincipal <= 0) {
      loan.outstandingPrincipal = 0;
      loan.status = 'Pagado';
      loan.closedAt = new Date().toISOString();
      updateLinkedApplicationsStatus(loan, 'Pagado');
    }
    if (!saveDatabase()) { renderApp(); return; }
    renderApp();
    renderLoans();
    renderCreditApplications();
    showToast(willClose ? 'Crédito liquidado por anticipado.' : `Abono a capital de ${money(amount)} registrado.`);
  }

  function statusClass(status) {
    if (['Aprobado', 'Desembolsado', 'Pagado'].includes(status)) return 'status-approved';
    if (status === 'Rechazado') return 'status-rejected';
    return 'status-pending';
  }
