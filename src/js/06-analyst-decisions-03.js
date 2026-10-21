  async function registerCreditDecision(applicationId, decision) {
    if (!reviewerSession || !['Aprobado', 'Rechazado', 'Desembolsar'].includes(decision)) return;
    const application = (db.creditApplications || []).find((item) => item.id === applicationId);
    if (!application) return;
    const oldApprovedWithoutLoan = application.status === 'Aprobado' && !findLoanForApplication(application.id);
    const isLegacyDisbursement = decision === 'Desembolsar' && oldApprovedWithoutLoan;
    if (decision === 'Desembolsar' && !isLegacyDisbursement) return;
    if (decision !== 'Desembolsar' && (application.status || 'En revisión') !== 'En revisión') {
      showToast('Esta solicitud ya tiene una decisión registrada.', 'error');
      return;
    }
    const targetAccount = db.accounts[application.accountId];
    if (decision === 'Aprobado' || decision === 'Desembolsar') {
      targetAccount.card = targetAccount.card || { number: targetAccount.cardNumber, limit: MAX_CARD_FUNDS, funds: 0, recoveredFunds: 0, debt: 0, nextInterestDate: null, history: [] };
      if (!Number.isFinite(targetAccount.card.recoveredFunds)) targetAccount.card.recoveredFunds = 0;
      const poolAvailable = availableAnalystCapital();
      const personalExposure = outstandingCreditExposureForAccount(application.accountId);
      if (application.amount > poolAvailable) {
        await showAppDialog({
          type: 'alert',
          title: 'Fondo de crédito insuficiente',
          message: `El analista administra ${money(ANALYST_TOTAL_CAPITAL)} en capital total y tiene ${money(poolAvailable)} disponibles. Esta solicitud es por ${money(application.amount)}.`,
          eyebrow: 'FONDO DEL ANALISTA', icon: '!', confirmText: 'Entendido', danger: true
        });
        return;
      }
      const personalCardLimit = cardCreditLimitForAccount(application.accountId);
      if (personalExposure + application.amount > personalCardLimit) {
        await showAppDialog({
          type: 'alert',
          title: 'Tope de crédito del titular',
          message: `El cupo autorizado de esta tarjeta es ${money(personalCardLimit)}. Esta cuenta tiene ${money(personalExposure)} pendientes y solo puede recibir ${money(availablePersonalCreditForAccount(application.accountId))} más.`,
          eyebrow: 'TOPE POR TARJETA', icon: '!', confirmText: 'Entendido', danger: true
        });
        return;
      }
      if (availableAdvancesForCard(targetAccount.card) + application.amount > cardLimitForRecord(targetAccount.card)) {
        await showAppDialog({
          type: 'alert',
          title: 'Fondos de tarjeta por encima del tope',
          message: `Los fondos sin trasladar de esta tarjeta superarían su cupo autorizado de ${money(cardLimitForRecord(targetAccount.card))}. Traslada parte a ahorros antes de desembolsar otro crédito.`,
          eyebrow: 'TOPE DE FONDOS DE TARJETA', icon: '!', confirmText: 'Entendido', danger: true
        });
        return;
      }
    }
    const confirmText = decision === 'Rechazado'
      ? '¿Confirmas rechazar esta solicitud de crédito? No se realizará ningún desembolso.'
      : `¿Confirmas aprobar y desembolsar ${money(application.amount)} a la tarjeta de crédito de ${application.applicantName || targetAccount.name}? Los fondos quedarán disponibles en la tarjeta para trasladarlos a ahorros y el préstamo iniciará su plan de cuotas.`;
    const approved = await showAppDialog({
      type: 'confirm',
      title: decision === 'Rechazado' ? 'Rechazar solicitud' : 'Aprobar y desembolsar crédito',
      message: confirmText,
      eyebrow: 'DECISIÓN DEL ANALISTA',
      icon: decision === 'Rechazado' ? '!' : '✓',
      confirmText: decision === 'Rechazado' ? 'Rechazar solicitud' : 'Aprobar y desembolsar',
      danger: decision === 'Rechazado'
    });
    if (!approved) return;
    const note = await showAppDialog({
      type: 'prompt',
      title: 'Nota de decisión',
      message: 'Añade una observación breve para dejar constancia en el expediente. Este campo es opcional.',
      eyebrow: 'REGISTRO DE REVISIÓN',
      icon: '✎',
      confirmText: 'Guardar decisión',
      defaultValue: application.reviewerNote || '',
      inputLabel: 'Observación del analista'
    });
    if (note === null) return;

    application.reviewerName = REVIEWER_NAME;
    application.reviewerNote = note.trim().slice(0, 500);
    application.reviewedAt = application.reviewedAt || new Date().toISOString();
    if (decision === 'Rechazado') {
      application.status = 'Rechazado';
      application.reviewerDecision = 'Rechazado';
    } else {
      if (!Array.isArray(db.loans)) db.loans = [];
      const loan = addOriginalDisbursementToUnifiedDebt(application);
      targetAccount.card.funds = roundMoney(targetAccount.card.funds + application.amount);
      recordCardMovement(application.accountId, 'card_disbursement', application.amount, `Desembolso de crédito ${String(loan.id).slice(-7)} recibido en tarjeta`, 'in');
      application.status = 'Desembolsado';
      application.reviewerDecision = 'Aprobado';
      application.disbursedAt = new Date().toISOString();
      application.loanId = loan.id;
      application.monthlyPayment = loan.monthlyPayment;
      const currentEstimate = calculateCreditEstimate(loan.outstandingPrincipal, Math.max(1, loan.termMonths - loan.installmentsPaid));
      application.totalPayable = currentEstimate.totalPayable;
      application.totalInterest = currentEstimate.totalInterest;
      recordMovement(application.accountId, 'card_disbursement', application.amount, `Desembolso de crédito integrado a la deuda única ${String(loan.id).slice(-7)} (no ingresado aún a ahorros)`, null);
    }
    saveDatabase();
    renderReviewerDashboard();
    showToast(decision === 'Rechazado' ? 'Solicitud rechazada. No se desembolsó dinero.' : `Crédito desembolsado: ${money(application.amount)} disponibles en los fondos de tu tarjeta. Trasládalos a ahorros para usarlos.`);
  }
