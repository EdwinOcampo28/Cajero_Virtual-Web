  // Controles del centro de auditoría y los informes. El informe nunca modifica saldos.
  const runFinancialAuditButton = $('#runFinancialAuditButton');
  const exportAuditLogButton = $('#exportAuditLogButton');
  const auditLogFilter = $('#auditLogFilter');
  const auditLogSearch = $('#auditLogSearch');
  const financialReportMonth = $('#financialReportMonth');
  const refreshFinancialReportButton = $('#refreshFinancialReportButton');
  const exportFinancialReportButton = $('#exportFinancialReportButton');

  if (financialReportMonth && !financialReportMonth.value) {
    financialReportMonth.value = localDateKey().slice(0, 7);
  }
  if (runFinancialAuditButton) {
    runFinancialAuditButton.addEventListener('click', () => {
      if (!reviewerSession) { showToast('Inicia sesión como analista para ejecutar la auditoría.', 'error'); return; }
      renderFinancialAuditPanel();
      const result = runFinancialAudit();
      const selectedClientId = getReviewerSelectedClientId();
      const selectedClientName = selectedClientId === null ? null : (db.accounts[selectedClientId]?.name || 'el cliente seleccionado');
      showToast(selectedClientName
        ? `Auditoría ejecutada para el sistema completo; la pantalla muestra resultados asociados a ${selectedClientName}.`
        : (result.errors.length
          ? `Auditoría terminada: ${result.errors.length} inconsistencia(s) crítica(s) y ${result.warnings.length} advertencia(s).`
          : `Auditoría terminada: ${result.passed} comprobaciones correctas y ${result.warnings.length} advertencia(s).`));
    });
  }
  if (exportAuditLogButton) exportAuditLogButton.addEventListener('click', exportAuditLogCsv);
  if (auditLogFilter) auditLogFilter.addEventListener('change', renderAuditLog);
  if (auditLogSearch) auditLogSearch.addEventListener('input', renderAuditLog);
  if (financialReportMonth) financialReportMonth.addEventListener('change', renderMonthlyFinancialReport);
  if (refreshFinancialReportButton) refreshFinancialReportButton.addEventListener('click', renderMonthlyFinancialReport);
  if (exportFinancialReportButton) exportFinancialReportButton.addEventListener('click', exportFinancialReportCsv);

  // La sesión de analista puede haberse restaurado antes de cargar este módulo.
  if (reviewerSession && reviewerView && !reviewerView.hidden) renderFinancialAuditPanel();
