  async function registerLimitIncreaseDecision(requestId, decision) {
    if (!reviewerSession || !['Aprobado', 'Rechazado'].includes(decision)) return;
    const request = (db.limitIncreaseRequests || []).find((item) => item.id === requestId);
    if (!request || (request.status || 'En revisión') !== 'En revisión') {
      showToast('Esta solicitud ya fue atendida.', 'error');
      return;
    }

    const target = db.accounts[request.accountId];
    if (!target) {
      showToast('No se encontró la cuenta asociada a la solicitud.', 'error');
      return;
    }
    const currentLimit = cardCreditLimitForAccount(request.accountId);
    const increaseAmount = roundMoney(request.requestedLimit - currentLimit);
    if (decision === 'Aprobado') {
      if (increaseAmount <= 0 || request.requestedLimit > MAX_CARD_LIMIT) {
        await showAppDialog({ type: 'alert', title: 'No se puede aprobar el cupo', message: `El cupo actual es ${money(currentLimit)} y el máximo de esta demostración es ${money(MAX_CARD_LIMIT)}.`, eyebrow: 'VALIDACIÓN DE CUPO', icon: '!', confirmText: 'Entendido', danger: true });
        return;
      }
      const analystAvailable = availableAnalystCapital();
      if (increaseAmount > analystAvailable) {
        await showAppDialog({ type: 'alert', title: 'Fondo insuficiente para desembolsar', message: `Aprobar el aumento desembolsará automáticamente ${money(increaseAmount)}. El analista tiene ${money(analystAvailable)} disponibles.`, eyebrow: 'FONDO DEL ANALISTA', icon: '!', confirmText: 'Entendido', danger: true });
        return;
      }
      const exposure = outstandingCreditExposureForAccount(request.accountId);
      if (exposure + increaseAmount > request.requestedLimit) {
        await showAppDialog({ type: 'alert', title: 'El desembolso supera el cupo', message: `La deuda pendiente es ${money(exposure)}. Al desembolsar ${money(increaseAmount)}, la exposición quedaría en ${money(exposure + increaseAmount)}, por encima del nuevo cupo ${money(request.requestedLimit)}.`, eyebrow: 'VALIDACIÓN DE CUPO', icon: '!', confirmText: 'Entendido', danger: true });
        return;
      }
      const availableOnCard = availableAdvancesForCard(target.card);
      if (availableOnCard + increaseAmount > request.requestedLimit) {
        await showAppDialog({ type: 'alert', title: 'Fondos de tarjeta por encima del tope', message: `El desembolso automático de ${money(increaseAmount)} superaría el límite solicitado de ${money(request.requestedLimit)}.`, eyebrow: 'VALIDACIÓN DE TARJETA', icon: '!', confirmText: 'Entendido', danger: true });
        return;
      }
    }

    const confirmed = await showAppDialog({
      type: 'confirm',
      title: decision === 'Aprobado' ? 'Aprobar y desembolsar aumento' : 'Rechazar solicitud de cupo',
      message: decision === 'Aprobado'
        ? `¿Apruebas aumentar el cupo de ${target.name} de ${money(currentLimit)} a ${money(request.requestedLimit)}? Al confirmar, la diferencia de ${money(increaseAmount)} se desembolsará automáticamente a su tarjeta y se sumará a la deuda unificada, con plazo de 60 meses al 2,13 % mensual.`
        : `¿Confirmas rechazar el aumento de cupo solicitado por ${target.name}? No se realizará ningún desembolso.`,
      eyebrow: 'REVISIÓN DE CUPO',
      icon: decision === 'Aprobado' ? '✓' : '!',
      confirmText: decision === 'Aprobado' ? 'Aprobar y desembolsar' : 'Rechazar solicitud',
      danger: decision === 'Rechazado'
    });
    if (!confirmed) return;

    const note = await showAppDialog({ type: 'prompt', title: 'Nota de decisión', message: 'Puedes dejar una observación breve para el expediente.', eyebrow: 'REGISTRO DE REVISIÓN', icon: '✎', confirmText: 'Guardar decisión', defaultValue: request.reviewerNote || '', inputLabel: 'Observación del analista' });
    if (note === null) return;

    const decisionDate = new Date().toISOString();
    request.status = decision;
    request.reviewerName = REVIEWER_NAME;
    request.reviewerNote = note.slice(0, 500);
    request.reviewedAt = decisionDate;

    if (decision === 'Aprobado') {
      target.card = target.card || { number: target.cardNumber, limit: MAX_CARD_FUNDS, funds: 0, recoveredFunds: 0, debt: 0, nextInterestDate: null, history: [] };
      // El aumento de cupo no solo sube el límite: desembolsa automáticamente la diferencia
      // y la integra en la deuda única del cliente, como cualquier otro desembolso original.
      target.card.limit = roundMoney(request.requestedLimit);
      const estimate = calculateCreditEstimate(increaseAmount, 60);
      const automaticApplication = {
        id: createId(),
        accountId: request.accountId,
        applicantName: target.name,
        accountNumber: target.accountNumber,
        amount: increaseAmount,
        monthlyIncome: 0,
        termMonths: 60,
        monthlyRate: ILLUSTRATIVE_MONTHLY_RATE,
        employment: 'Aumento de cupo',
        purpose: `Desembolso automático por aumento de cupo (${money(currentLimit)} a ${money(request.requestedLimit)})`,
        monthlyPayment: estimate.monthlyPayment,
        totalPayable: estimate.totalPayable,
        totalInterest: estimate.totalInterest,
        status: 'Desembolsado',
        date: decisionDate,
        reviewedAt: decisionDate,
        disbursedAt: decisionDate,
        reviewerName: REVIEWER_NAME,
        reviewerNote: note.slice(0, 500),
        origin: 'Aumento de cupo',
        limitIncreaseRequestId: request.id
      };
      if (!Array.isArray(db.creditApplications)) db.creditApplications = [];
      db.creditApplications.unshift(automaticApplication);
      const loan = addOriginalDisbursementToUnifiedDebt(automaticApplication);
      target.card.funds = roundMoney(target.card.funds + increaseAmount);
      recordCardMovement(request.accountId, 'card_disbursement', increaseAmount, `Desembolso automático por aumento de cupo ${String(request.id).slice(-7)}`, 'in');
      recordMovement(request.accountId, 'card_disbursement', increaseAmount, `Desembolso automático por aumento de cupo; integrado a la deuda unificada ${String(loan.id).slice(-7)}`, null);
      automaticApplication.loanId = loan.id;
      automaticApplication.monthlyPayment = loan.monthlyPayment;
      request.approvedLimit = target.card.limit;
      request.disbursedAmount = increaseAmount;
      request.disbursedAt = decisionDate;
      request.loanId = loan.id;
      request.creditApplicationId = automaticApplication.id;
    } else {
      request.approvedLimit = null;
      request.disbursedAmount = 0;
    }

    saveDatabase();
    renderReviewerDashboard();
    showToast(decision === 'Aprobado'
      ? `Cupo aumentado a ${money(target.card.limit)}. Se desembolsaron automáticamente ${money(increaseAmount)} a ${target.name} y se integraron a su deuda.`
      : 'Solicitud de aumento de cupo rechazada. No se realizó ningún desembolso.');
  }
