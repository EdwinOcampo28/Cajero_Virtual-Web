  async function registerLimitIncreaseDecision(requestId, decision) {
    if (!reviewerSession || !['Aprobado', 'Rechazado'].includes(decision)) return;
    const request = (db.limitIncreaseRequests || []).find((item) => item.id === requestId);
    if (!request || (request.status || 'En revisión') !== 'En revisión') { showToast('Esta solicitud ya fue atendida.', 'error'); return; }
    const target = db.accounts[request.accountId];
    const currentLimit = cardCreditLimitForAccount(request.accountId);
    if (decision === 'Aprobado' && (request.requestedLimit <= currentLimit || request.requestedLimit > MAX_CARD_LIMIT)) {
      await showAppDialog({ type: 'alert', title: 'No se puede aprobar el cupo', message: `El cupo actual es ${money(currentLimit)} y el máximo de esta demostración es ${money(MAX_CARD_LIMIT)}.`, eyebrow: 'VALIDACIÓN DE CUPO', icon: '!', confirmText: 'Entendido', danger: true });
      return;
    }
    const confirmed = await showAppDialog({ type: 'confirm', title: decision === 'Aprobado' ? 'Aprobar aumento de cupo' : 'Rechazar solicitud de cupo', message: decision === 'Aprobado' ? `¿Apruebas aumentar el cupo de ${target.name} de ${money(currentLimit)} a ${money(request.requestedLimit)}? Esto amplía el máximo de crédito autorizado, pero no desembolsa dinero automáticamente.` : `¿Confirmas rechazar el aumento de cupo solicitado por ${target.name}?`, eyebrow: 'REVISIÓN DE CUPO', icon: decision === 'Aprobado' ? '✓' : '!', confirmText: decision === 'Aprobado' ? 'Aprobar aumento' : 'Rechazar solicitud', danger: decision === 'Rechazado' });
    if (!confirmed) return;
    const note = await showAppDialog({ type: 'prompt', title: 'Nota de decisión', message: 'Puedes dejar una observación breve para el expediente.', eyebrow: 'REGISTRO DE REVISIÓN', icon: '✎', confirmText: 'Guardar decisión', defaultValue: request.reviewerNote || '', inputLabel: 'Observación del analista' });
    if (note === null) return;
    if (decision === 'Aprobado') {
      target.card = target.card || { number: target.cardNumber, limit: MAX_CARD_FUNDS, funds: 0, recoveredFunds: 0, debt: 0, nextInterestDate: null, history: [] };
      target.card.limit = roundMoney(request.requestedLimit);
    }
    request.status = decision; request.reviewerName = REVIEWER_NAME; request.reviewerNote = note.slice(0, 500); request.reviewedAt = new Date().toISOString(); request.approvedLimit = decision === 'Aprobado' ? target.card.limit : null;
    saveDatabase(); renderReviewerDashboard();
    showToast(decision === 'Aprobado' ? `Cupo aumentado a ${money(target.card.limit)} para ${target.name}. No se realizó ningún desembolso.` : 'Solicitud de aumento de cupo rechazada.');
  }
