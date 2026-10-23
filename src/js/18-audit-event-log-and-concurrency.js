  // Motor de auditoría de solo lectura y registro cronológico del sistema.
  // No registra PIN ni credenciales; conserva como máximo MAX_AUDIT_EVENTS eventos.
  function recordAuditEvent(action, options = {}) {
    if (!db || typeof db !== 'object') return null;
    if (!Array.isArray(db.auditLog)) db.auditLog = [];
    const accountId = Number.isInteger(options.accountId) && options.accountId >= 1 && options.accountId <= MAX_ACCOUNT_ID
      ? options.accountId : null;
    const accountRecord = accountId ? db.accounts?.[accountId] : null;
    const details = {};
    if (options.details && typeof options.details === 'object' && !Array.isArray(options.details)) {
      Object.entries(options.details).slice(0, 16).forEach(([key, value]) => {
        if (['string', 'number', 'boolean'].includes(typeof value) || value === null) {
          details[String(key).slice(0, 50)] = typeof value === 'string' ? value.slice(0, 250) : value;
        }
      });
    }
    const amount = Number(options.amount);
    const event = {
      id: createId(),
      date: typeof options.date === 'string' && Number.isFinite(Date.parse(options.date)) ? options.date : new Date().toISOString(),
      action: String(action || 'Evento del sistema').slice(0, 120),
      category: String(options.category || 'sistema').slice(0, 40),
      accountId,
      accountName: accountRecord?.name || (typeof options.accountName === 'string' ? options.accountName.slice(0, 100) : null),
      source: String(options.source || 'Sistema').slice(0, 40),
      amount: options.amount !== undefined && Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : null,
      direction: ['in', 'out'].includes(options.direction) ? options.direction : null,
      description: String(options.description || '').slice(0, 400),
      referenceId: typeof options.referenceId === 'string' ? options.referenceId.slice(0, 100) : null,
      details
    };
    db.auditLog.unshift(event);
    if (db.auditLog.length > MAX_AUDIT_EVENTS) db.auditLog.length = MAX_AUDIT_EVENTS;
    return event;
  }

  function recordAuditMovement(accountId, movement, source) {
    const type = String(movement?.type || 'movement');
    const description = String(movement?.description || 'Movimiento registrado');
    const direction = movement?.direction || null;
    const labels = {
      deposit: ['Depósito registrado', 'ahorros'],
      withdraw: ['Retiro registrado', 'ahorros'],
      withdrawal_received: ['Retiro acreditado automáticamente', 'ahorros'],
      transfer: [direction === 'in' ? 'Transferencia recibida' : 'Transferencia enviada', 'ahorros'],
      operation_fee: ['Comisión de operación cobrada', 'comisiones'],
      card_disbursement: ['Desembolso registrado', 'creditos'],
      treasury_distribution: ['Abono automático desde Tesorería', 'tesoreria'],
      loan_payment: ['Pago de cuota registrado', 'creditos'],
      loan_abono: ['Abono o liquidación registrada', 'creditos'],
      card_advance: ['Avance a ahorros registrado', 'tarjeta'],
      card_advance_fee: ['Comisión por avance cobrada', 'comisiones'],
      card_reborrow: ['Capital recuperado reutilizado', 'creditos'],
      card_payment: ['Pago de deuda de tarjeta', 'tarjeta'],
      card_interest: ['Interés heredado de tarjeta registrado', 'intereses'],
      card_debt_unified: ['Deuda heredada unificada', 'creditos']
    };
    const [action, category] = labels[type] || ['Movimiento financiero registrado', 'sistema'];
    const accountRecord = db.accounts?.[accountId];
    const details = { movementType: type };
    if (source === 'Ahorros' && accountRecord) details.balanceAfter = roundMoney(accountRecord.balance);
    if (source === 'Tarjeta' && accountRecord?.card) {
      details.cardFundsAfter = roundMoney(accountRecord.card.funds || 0);
      details.recoveredFundsAfter = roundMoney(accountRecord.card.recoveredFunds || 0);
      details.cardLimit = roundMoney(accountRecord.card.limit || 0);
    }
    return recordAuditEvent(action, {
      category, accountId, amount: movement?.amount, source,
      direction, description, referenceId: movement?.id, details, date: movement?.date
    });
  }

  function abortStaleFinancialOperation() {
    // Una pestaña cambió la base mientras había una confirmación abierta. Descartar el estado
    // obsoleto evita que una escritura sobrescriba silenciosamente saldos más recientes.
    db = loadDatabase();
    dbRevision += 1;
    if (reviewerSession && reviewerView && !reviewerView.hidden) renderReviewerDashboard();
    else if (typeof treasurySession !== 'undefined' && treasurySession && treasuryView && !treasuryView.hidden && typeof renderTreasuryView === 'function') renderTreasuryView(true);
    else if (activeAccountId !== null && appView && !appView.hidden) renderApp();
    showToast('Los datos cambiaron desde otra pestaña. No se aplicó esta operación; revisa los saldos actualizados e inténtalo de nuevo.', 'error');
  }
