  function selectedFinancialReportMonth() {
    const input = $('#financialReportMonth');
    return input?.value || localDateKey().slice(0, 7);
  }

  function belongsToMonth(dateValue, monthValue) {
    if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}$/.test(monthValue)) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === monthValue;
  }

  function getMonthlyFinancialReport(monthValue = selectedFinancialReportMonth(), accountId = getReviewerSelectedClientId()) {
    const summary = captureFinancialStateSummary();
    const includesAccount = (item) => accountId === null || Number(item.accountId) === Number(accountId);
    const movements = summary.histories.filter((movement) => includesAccount(movement) && belongsToMonth(movement.date, monthValue));
    const sumMovements = (predicate) => roundMoney(movements.filter(predicate).reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0));
    const relevantLoans = summary.loans.filter(includesAccount);
    const monthPayments = relevantLoans.flatMap((loan) => (Array.isArray(loan.payments) ? loan.payments : []).map((payment) => ({ ...payment, loanId: loan.id, accountId: loan.accountId })))
      .filter((payment) => belongsToMonth(payment.date, monthValue));
    const monthDisbursements = summary.applications.filter((application) => includesAccount(application) && belongsToMonth(application.disbursedAt, monthValue));
    const relevantAccounts = Array.isArray(db.accounts) ? db.accounts.slice(1).filter((account) => account && (accountId === null || Number(account.id) === Number(accountId))) : [];
    const relevantCurrentLoans = relevantLoans.filter((loan) => loan.status === 'Activo' && Number(loan.outstandingPrincipal) > 0);
    const grossDeposits = sumMovements((item) => item.type === 'deposit');
    const depositFees = sumMovements((item) => item.type === 'operation_fee' && /dep[oó]sito/i.test(item.description || ''));
    const withdrawalFees = sumMovements((item) => item.type === 'operation_fee' && /retiro/i.test(item.description || ''));
    const transferFees = sumMovements((item) => item.type === 'operation_fee' && /transferencia/i.test(item.description || ''));
    const treasuryDistributionFees = sumMovements((item) => item.type === 'operation_fee' && /reparto autom[aá]tico de tesorer[ií]a/i.test(item.description || ''));
    const withdrawals = sumMovements((item) => item.type === 'withdraw');
    const withdrawalsReceived = sumMovements((item) => item.type === 'withdrawal_received');
    const transfersSent = sumMovements((item) => item.type === 'transfer' && item.direction === 'out');
    const operationFees = sumMovements((item) => item.type === 'operation_fee');
    const advanceFees = sumMovements((item) => item.type === 'card_advance_fee');
    const advances = sumMovements((item) => item.type === 'card_advance' && item.direction === 'in');
    const disbursed = roundMoney(monthDisbursements.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0));
    const capitalRepaid = roundMoney(monthPayments.reduce((sum, item) => sum + Math.max(0, Number(item.principal) || 0), 0));
    const interestCollected = roundMoney(monthPayments.reduce((sum, item) => sum + Math.max(0, Number(item.interest) || 0), 0));
    const installmentPayments = roundMoney(monthPayments.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0));
    return {
      month: monthValue,
      grossDeposits,
      depositFees,
      withdrawalFees,
      transferFees,
      treasuryDistributionFees,
      netDeposits: roundMoney(grossDeposits - depositFees),
      withdrawals,
      withdrawalsReceived,
      transfersSent,
      disbursed,
      advances,
      capitalRepaid,
      interestCollected,
      installmentPayments,
      operationFees,
      advanceFees,
      totalFees: roundMoney(operationFees + advanceFees),
      savingsBalance: roundMoney(relevantAccounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0)),
      outstandingPrincipal: roundMoney(relevantLoans.reduce((sum, loan) => sum + Math.max(0, Number(loan.outstandingPrincipal) || 0), 0)),
      activeLoans: relevantCurrentLoans.length,
      overdueLoans: relevantCurrentLoans.filter((loan) => typeof loan.nextDueDate === 'string' && loan.nextDueDate < localDateKey()).length,
      pendingApplications: summary.applications.filter((application) => includesAccount(application) && (application.status || 'En revisión') === 'En revisión').length,
      movementsCount: movements.reduce((sum, item) => sum + Math.max(1, Number(item.movementCount) || 1), 0),
      paymentsCount: monthPayments.reduce((sum, item) => sum + Math.max(1, Number(item.count) || 1), 0),
      disbursementsCount: monthDisbursements.reduce((sum, item) => sum + Math.max(1, Number(item.archivedCount) || 1), 0),
      generatedAt: new Date().toISOString()
    };
  }

  function csvCell(value) {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadCsvFile(filename, rows) {
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function renderFinancialAuditPanel() {
    if (!reviewerSession || !$('#financialAuditStatus')) return;
    const result = runFinancialAudit();
    const selectedClientId = getReviewerSelectedClientId();
    const selectedClientName = selectedClientId === null ? null : (db.accounts[selectedClientId]?.name || '');
    const globalAuditCheck = (item) => /^(Estructura principal|Fondo disponible del analista|Identificadores del registro de auditoría)$/.test(item.label || '');
    const scopedChecks = selectedClientName
      ? result.checks.filter((item) => globalAuditCheck(item) || String(item.label).includes(selectedClientName) || String(item.detail).includes(selectedClientName))
      : result.checks;
    const scopedErrors = scopedChecks.filter((item) => !item.passed && item.severity !== 'warning');
    const scopedWarnings = scopedChecks.filter((item) => !item.passed && item.severity === 'warning');
    const scopedPassed = scopedChecks.length - scopedErrors.length - scopedWarnings.length;
    const status = $('#financialAuditStatus');
    status.classList.toggle('has-errors', scopedErrors.length > 0);
    status.classList.toggle('has-warnings', scopedErrors.length === 0 && scopedWarnings.length > 0);
    const scopeLabel = selectedClientName ? ` para ${selectedClientName}` : '';
    status.textContent = scopedErrors.length
      ? `Auditoría${scopeLabel}: ${scopedErrors.length} inconsistencia(s) crítica(s), ${scopedWarnings.length} advertencia(s) y ${scopedPassed} comprobación(es) correctas. Revisa el detalle antes de continuar.`
      : scopedWarnings.length
        ? `Auditoría${scopeLabel}: ${scopedWarnings.length} advertencia(s), ${scopedPassed} comprobación(es) correctas y ninguna inconsistencia crítica.`
        : `Auditoría${scopeLabel}: ${scopedPassed} comprobaciones correctas. No se detectaron inconsistencias en las reglas verificadas.`;

    const summary = $('#financialAuditSummary');
    summary.replaceChildren();
    const metrics = [
      ['Comprobaciones correctas', scopedPassed, 'Conciliaciones sin diferencias'],
      ['Inconsistencias', scopedErrors.length, 'Requieren revisión'],
      ['Advertencias', scopedWarnings.length, 'Datos heredados o diferencias leves'],
      ['Eventos guardados', selectedClientId === null ? (db.auditLog || []).length : (db.auditLog || []).filter((event) => Number(event.accountId) === selectedClientId).length, `Máximo ${MAX_AUDIT_EVENTS}`]
    ];
    metrics.forEach(([label, value, detail]) => {
      const card = document.createElement('article');
      card.className = 'reviewer-audit-metric';
      const caption = document.createElement('span'); caption.textContent = label;
      const number = document.createElement('strong'); number.textContent = String(value);
      const note = document.createElement('small'); note.textContent = detail;
      card.append(caption, number, note); summary.append(card);
    });

    const issueList = $('#financialAuditIssues');
    issueList.replaceChildren();
    const failed = scopedChecks.filter((item) => !item.passed);
    if (!failed.length) {
      const item = document.createElement('div');
      item.className = 'reviewer-audit-issue';
      const title = document.createElement('strong'); title.textContent = 'Sin diferencias detectadas';
      const text = document.createElement('span'); text.textContent = 'Los saldos, límites, deuda unificada y contadores de comisiones pasaron las comprobaciones actuales.';
      item.append(title, text); issueList.append(item);
    } else {
      failed.slice(0, 30).forEach((check) => {
        const item = document.createElement('div');
        item.className = `reviewer-audit-issue${check.severity === 'warning' ? '' : ' is-error'}`;
        const title = document.createElement('strong'); title.textContent = `${check.severity === 'warning' ? 'Advertencia' : 'Inconsistencia'} · ${check.label}`;
        const text = document.createElement('span'); text.textContent = check.detail;
        item.append(title, text); issueList.append(item);
      });
      if (failed.length > 30) {
        const remainder = document.createElement('small'); remainder.textContent = `Se omitieron ${failed.length - 30} avisos adicionales en la vista; el análisis completo se ejecutó.`; issueList.append(remainder);
      }
    }
    renderAuditLog();
    renderMonthlyFinancialReport();
  }

  function renderAuditLog() {
    const list = $('#auditLogList');
    if (!list) return;
    list.replaceChildren();
    const category = $('#auditLogFilter')?.value || 'all';
    const query = ($('#auditLogSearch')?.value || '').trim().toLocaleLowerCase('es-CO');
    const selectedClientId = getReviewerSelectedClientId();
    const source = Array.isArray(db.auditLog) ? db.auditLog : [];
    const filtered = source.filter((event) => {
      if (selectedClientId !== null && Number(event.accountId) !== selectedClientId) return false;
      if (category !== 'all' && event.category !== category) return false;
      if (!query) return true;
      return [event.action, event.category, event.accountName, event.source, event.description, event.referenceId, JSON.stringify(event.details || {})]
        .some((value) => String(value || '').toLocaleLowerCase('es-CO').includes(query));
    }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 100);
    $('#auditLogEmpty').hidden = filtered.length > 0;
    filtered.forEach((event) => {
      const row = document.createElement('article'); row.className = 'reviewer-audit-row';
      const date = document.createElement('time'); date.className = 'reviewer-audit-date'; date.dateTime = event.date || ''; date.textContent = shortDateTime(event.date || '');
      const titleWrap = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = event.action || 'Evento';
      const meta = document.createElement('small'); meta.textContent = `${event.source || 'Sistema'}${event.accountName ? ` · ${event.accountName}` : ''}${event.referenceId ? ` · Ref. ${event.referenceId.slice(-8)}` : ''}`;
      titleWrap.append(title, meta);
      const description = document.createElement('div'); description.className = 'reviewer-audit-description';
      const desc = document.createElement('small'); desc.textContent = event.description || event.category || 'Sin descripción';
      const categoryChip = document.createElement('span'); categoryChip.className = 'reviewer-audit-chip'; categoryChip.textContent = event.category || 'sistema';
      description.append(desc, categoryChip);
      const amount = document.createElement('strong'); amount.className = 'reviewer-audit-amount'; amount.textContent = event.amount === null || event.amount === undefined ? '—' : money(event.amount);
      row.append(date, titleWrap, description, amount); list.append(row);
    });
  }

  function renderMonthlyFinancialReport() {
    const container = $('#financialReportCards');
    if (!container) return;
    const report = getMonthlyFinancialReport();
    container.replaceChildren();
    const cards = [
      ['Depósitos brutos', report.grossDeposits, `Neto abonado ${money(report.netDeposits)}`],
      ['Retiros', report.withdrawals, 'Importe retirado por clientes'],
      ['Retiros recibidos', report.withdrawalsReceived, 'Importe acreditado en tesorería'],
      ['Transferencias enviadas', report.transfersSent, 'No suma las recibidas'],
      ['Desembolsos de créditos', report.disbursed, `${report.disbursementsCount} desembolso(s)`],
      ['Capital recuperado', report.capitalRepaid, 'Principal recibido en pagos'],
      ['Intereses cobrados', report.interestCollected, 'Intereses pagados en el mes'],
      ['Comisiones por depósitos', report.depositFees, 'Cobros asociados a depósitos'],
      ['Comisiones por retiros', report.withdrawalFees, 'Cobros asociados a retiros'],
      ['Comisiones por transferencias', report.transferFees, 'Cobros asociados a transferencias'],
      ['Comisiones por reparto de Tesorería', report.treasuryDistributionFees, 'Cobro de $20.000 por cuenta en cada reparto'],
      ['Comisiones por avances', report.advanceFees, 'Cobros asociados a avances'],
      ['Total de comisiones', report.totalFees, 'Suma de todas las comisiones'],
      ['Capital pendiente', report.outstandingPrincipal, `${report.activeLoans} crédito(s) activo(s)`],
      ['Cartera vencida actual', report.overdueLoans, 'Créditos con fecha de vencimiento anterior a hoy'],
      ['Saldo actual de ahorros', report.savingsBalance, 'Foto del saldo conjunto al generar el informe'],
      ['Avances a ahorros', report.advances, 'Importe bruto trasladado desde la tarjeta'],
      ['Pagos de cuotas y abonos', report.installmentPayments, `${report.paymentsCount} pago(s) registrados`]
    ];
    cards.forEach(([label, value, detail], index) => {
      const card = document.createElement('article');
      card.className = `reviewer-report-card${/Depósitos brutos|Retiros recibidos|Capital recuperado|Intereses cobrados|Comisiones|Total de comisiones/.test(label) ? ' is-positive' : ''}${/Cartera vencida/.test(label) && Number(value) > 0 ? ' is-warning' : ''}`;
      const caption = document.createElement('span'); caption.textContent = label;
      const number = document.createElement('strong'); number.textContent = label === 'Cartera vencida actual' ? String(value) : (typeof value === 'number' ? money(value) : String(value));
      const note = document.createElement('small'); note.textContent = detail;
      card.append(caption, number, note); container.append(card);
    });
    const clientId = getReviewerSelectedClientId();
    const clientName = clientId === null ? 'Todos los clientes' : (db.accounts[clientId]?.name || 'Cliente seleccionado');
    $('#financialReportFootnote').textContent = `Periodo: ${report.month}. Filtro: ${clientName}. ${report.movementsCount} movimiento(s) de ahorros; ${report.paymentsCount} pagos; ${report.disbursementsCount} desembolso(s). Los intereses corresponden solo a importes cobrados registrados en los pagos. El saldo de ahorros y el capital pendiente son una foto actual, no un saldo histórico del cierre del mes. Generado ${shortDateTime(report.generatedAt)}.`;
  }

  function exportAuditLogCsv() {
    if (!reviewerSession) { showToast('Solo el analista puede exportar el registro de auditoría.', 'error'); return; }
    try {
      recordAuditEvent('Registro de auditoría exportado', { category: 'respaldos', source: 'Analista', amount: (db.auditLog || []).length, description: 'Exportación del registro cronológico a CSV.' });
      if (!saveDatabase()) return;
      const events = Array.isArray(db.auditLog) ? db.auditLog.slice().sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
      const rows = [['Fecha ISO', 'Categoría', 'Acción', 'Titular', 'Cuenta ID', 'Origen', 'Importe COP', 'Dirección', 'Referencia', 'Descripción', 'Detalles JSON']];
      events.forEach((event) => rows.push([event.date, event.category, event.action, event.accountName, event.accountId, event.source, event.amount, event.direction, event.referenceId, event.description, JSON.stringify(event.details || {})]));
      downloadCsvFile(`Cajero_Virtual_Auditoria_${new Date().toISOString().slice(0, 10)}.csv`, rows);
      renderFinancialAuditPanel();
      showToast(`Registro de auditoría exportado: ${events.length} eventos.`);
    } catch (error) { showToast('No se pudo exportar el registro de auditoría.', 'error'); }
  }

  function exportFinancialReportCsv() {
    if (!reviewerSession) { showToast('Solo el analista puede exportar informes financieros.', 'error'); return; }
    const report = getMonthlyFinancialReport();
    const rows = [
      ['Informe financiero mensual', report.month],
      ['Generado', report.generatedAt],
      ['Métrica', 'Valor COP o unidades', 'Detalle'],
      ['Depósitos brutos', report.grossDeposits, 'Importes ingresados antes de comisión'],
      ['Comisiones por depósitos', report.depositFees, 'Comisión cobrada por depósitos'],
      ['Comisiones por retiros', report.withdrawalFees, 'Comisión cobrada por retiros'],
      ['Comisiones por transferencias', report.transferFees, 'Comisión cobrada por transferencias'],
      ['Comisiones por reparto de Tesorería', report.treasuryDistributionFees, 'Comisión de $20.000 por cuenta en cada reparto'],
      ['Depósitos netos', report.netDeposits, 'Importe abonado después de comisión'],
      ['Retiros', report.withdrawals, 'Importe retirado por clientes'],
      ['Retiros recibidos', report.withdrawalsReceived, 'Importe acreditado automáticamente a tesorería'],
      ['Transferencias enviadas', report.transfersSent, 'Importe recibido por los destinatarios'],
      ['Desembolsos de crédito', report.disbursed, `${report.disbursementsCount} operaciones`],
      ['Avances a ahorros', report.advances, 'No se cuentan como desembolsos nuevos'],
      ['Capital recuperado', report.capitalRepaid, 'Principal de cuotas, abonos y liquidaciones'],
      ['Intereses cobrados', report.interestCollected, 'Excluye intereses futuros no pagados'],
      ['Total de comisiones por operaciones', report.operationFees, 'Incluye depósitos, retiros, transferencias y reparto de Tesorería'],
      ['Comisiones de avances', report.advanceFees, 'Costos de avances a ahorros'],
      ['Total de comisiones', report.totalFees, 'Incluye todas las comisiones de operación, Tesorería y avances'],
      ['Pagos de cuotas y abonos', report.installmentPayments, `${report.paymentsCount} pagos registrados`],
      ['Capital pendiente actual', report.outstandingPrincipal, `${report.activeLoans} créditos activos`],
      ['Créditos vencidos actuales', report.overdueLoans, 'Número de créditos con vencimiento pasado'],
      ['Saldo actual de ahorros', report.savingsBalance, 'Foto del saldo conjunto al momento de generar el informe; las métricas de movimiento reflejan el mes elegido']
    ];
    try {
      recordAuditEvent('Informe financiero mensual exportado', { category: 'respaldos', source: 'Analista', amount: report.month ? 0 : null, description: `Informe del periodo ${report.month}.`, details: { month: report.month } });
      if (!saveDatabase()) return;
      downloadCsvFile(`Cajero_Virtual_Informe_${report.month}.csv`, rows);
      renderFinancialAuditPanel();
      showToast(`Informe de ${report.month} exportado correctamente.`);
    } catch (error) { showToast('No se pudo exportar el informe financiero.', 'error'); }
  }
