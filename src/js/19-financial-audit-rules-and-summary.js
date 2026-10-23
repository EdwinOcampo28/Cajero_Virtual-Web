  // Reglas de auditoría financiera y resumen para conciliación e informes.
  function auditAddCheck(checks, label, passed, detail, severity = 'error') {
    checks.push({ label, passed: Boolean(passed), detail: String(detail || ''), severity });
  }

  function runFinancialAudit() {
    const checks = [];
    const accounts = Array.isArray(db?.accounts) ? db.accounts : [];
    const loans = Array.isArray(db?.loans) ? db.loans : [];
    const applications = Array.isArray(db?.creditApplications) ? db.creditApplications : [];
    const increaseRequests = Array.isArray(db?.limitIncreaseRequests) ? db.limitIncreaseRequests : [];

    auditAddCheck(checks, 'Estructura principal', accounts.length === MAX_ACCOUNT_ID + 1 && accounts[0] === null, 'Deben existir exactamente las tres cuentas de ahorro de prueba.');
    const settings = db?.simulationSettings;
    const settingsValid = Boolean(settings && Number.isFinite(settings.monthlyInterestRate) && settings.monthlyInterestRate >= 0 && settings.monthlyInterestRate <= 1 && Number.isSafeInteger(settings.treasuryTimerRate) && settings.treasuryTimerRate >= 1 && Number.isSafeInteger(settings.treasuryTimerIncomeCap) && settings.treasuryTimerIncomeCap >= 0 && Number.isSafeInteger(settings.analystCapital) && settings.analystCapital >= 0 && Number.isSafeInteger(settings.limitIncreaseAmount) && settings.limitIncreaseAmount >= MIN_CREDIT_AMOUNT && settings.limitIncreaseAmount % MIN_CREDIT_AMOUNT === 0);
    auditAddCheck(checks, 'Configuración de simulación', settingsValid, settingsValid ? `Interés mensual ${formatMonthlyInterestRate(settings.monthlyInterestRate)}; cronómetro ${money(settings.treasuryTimerRate)} por segundo, sin tope de acumulación.` : 'La tasa o el ritmo de la simulación no son válidos.');
    const treasury = db?.withdrawalTreasury;
    const treasuryValid = Boolean(treasury && Number.isSafeInteger(treasury.balance) && treasury.balance >= 0 && Number.isSafeInteger(treasury.elapsedSeconds) && treasury.elapsedSeconds >= 0 && Number.isSafeInteger(treasury.timerIncomeTotal) && treasury.timerIncomeTotal >= 0 && Array.isArray(treasury.history) && !('card' in treasury));
    auditAddCheck(checks, 'Tesorería independiente', treasuryValid, treasuryValid ? `Saldo ${money(treasury.balance)}; cronómetro ${treasury.elapsedSeconds} segundos; ingresos acumulados ${money(treasury.timerIncomeTotal)}; sin tarjeta.` : 'El saldo, cronómetro o historial de tesorería no son válidos.');

    for (let id = 1; id <= MAX_ACCOUNT_ID; id += 1) {
      const accountRecord = accounts[id];
      if (!accountRecord) {
        auditAddCheck(checks, `Cuenta ${id}`, false, 'No se encuentra la cuenta.', 'error');
        continue;
      }
      const balanceValid = Number.isSafeInteger(accountRecord.balance) && accountRecord.balance >= 0 && accountRecord.balance <= maxSavingsBalanceForAccount(id);
      auditAddCheck(checks, `Saldo de ${accountRecord.name}`, balanceValid, `Saldo: ${money(accountRecord.balance)}; dentro del rango numérico exacto del simulador.`);
      // Reconstruye el saldo de ahorros desde el libro de movimientos. Los movimientos sin
      // dirección (p. ej., desembolsos a la tarjeta) no afectan directamente los ahorros.
      const ledgerBalance = roundMoney((Array.isArray(accountRecord.history) ? accountRecord.history : []).reduce((sum, movement) => {
        const amount = Math.max(0, Number(movement?.amount) || 0);
        if (movement?.direction === 'in') return sum + amount;
        if (movement?.direction === 'out') return sum - amount;
        return sum;
      }, 0));
      const savingsDelta = Math.abs(ledgerBalance - roundMoney(accountRecord.balance || 0));
      auditAddCheck(checks, `Conciliación del libro de ahorros de ${accountRecord.name}`, savingsDelta === 0,
        savingsDelta === 0
          ? `El saldo de cuenta coincide con el libro de movimientos (${money(ledgerBalance)}).`
          : `Diferencia de ${money(savingsDelta)}: el libro indica ${money(ledgerBalance)} y la cuenta registra ${money(accountRecord.balance)}. Copias antiguas pueden no contener un saldo inicial; revisa el historial.`, 'warning');

      const card = accountRecord.card || {};
      const limitValid = Number.isSafeInteger(card.limit) && card.limit >= MAX_CARD_FUNDS && card.limit <= MAX_CARD_LIMIT;
      const cardAmountsValid = [card.funds, card.recoveredFunds ?? 0, card.debt ?? 0].every((value) => Number.isSafeInteger(value) && value >= 0);
      const cardCapacityValid = cardAmountsValid && roundMoney((card.funds || 0) + (card.recoveredFunds || 0)) <= card.limit;
      auditAddCheck(checks, `Cupo de tarjeta de ${accountRecord.name}`, limitValid && cardCapacityValid, `Cupo ${money(card.limit || 0)}; fondos sin trasladar ${money(card.funds || 0)}; capital recuperado disponible ${money(card.recoveredFunds || 0)}.`);
      const pendingEntries = Array.isArray(card.pendingDisbursements) ? card.pendingDisbursements : [];
      const pendingTotal = roundMoney(pendingEntries.reduce((sum, item) => sum + Math.max(0, Number(item?.remainingAmount) || 0), 0));
      const pendingByApplication = new Map();
      pendingEntries.forEach((item) => pendingByApplication.set(item.applicationId, (pendingByApplication.get(item.applicationId) || 0) + (Number(item.remainingAmount) || 0)));
      const pendingReferencesValid = pendingEntries.every((item) => {
        const application = applications.find((candidate) => candidate.id === item.applicationId && candidate.accountId === id);
        return item && typeof item.applicationId === 'string' && Number.isSafeInteger(item.remainingAmount) && item.remainingAmount > 0
          && application && Number(application.cardFundsRemaining) === pendingByApplication.get(item.applicationId);
      }) && applications.filter((application) => application.accountId === id && Number(application.cardFundsRemaining) > 0)
        .every((application) => pendingByApplication.get(application.id) === Number(application.cardFundsRemaining));
      auditAddCheck(checks, `Desembolsos pendientes de ${accountRecord.name}`, pendingReferencesValid && pendingTotal <= Number(card.funds || 0),
        pendingReferencesValid && pendingTotal <= Number(card.funds || 0)
          ? `${money(pendingTotal)} siguen en tarjeta sin activar crédito ni cuotas.`
          : 'Los fondos pendientes no coinciden con su solicitud o superan los fondos disponibles de la tarjeta.');

      const activeCount = loans.filter((loan) => loan.accountId === id && loan.status === 'Activo' && Number(loan.outstandingPrincipal) > 0).length;
      auditAddCheck(checks, `Deuda unificada de ${accountRecord.name}`, activeCount <= 1, activeCount > 1 ? `Se encontraron ${activeCount} deudas activas; deberían consolidarse en una sola.` : 'Hay como máximo una deuda activa unificada.');

      const exposure = outstandingCreditExposureForAccount(id);
      auditAddCheck(checks, `Exposición crediticia de ${accountRecord.name}`, exposure <= cardCreditLimitForAccount(id), `Deuda pendiente ${money(exposure)} frente a cupo ${money(cardCreditLimitForAccount(id))}.`);
      if (Number(card.debt || 0) > 0) {
        auditAddCheck(checks, `Saldo legado de tarjeta de ${accountRecord.name}`, false, `Queda una deuda heredada de tarjeta de ${money(card.debt)} fuera de la deuda unificada. Revisa la sección de pagos de tarjeta.`, 'warning');
      }
    }

    loans.forEach((loan) => {
      const label = `Crédito ${String(loan.id || '').slice(-7)}`;
      const principalValid = Number.isSafeInteger(loan.outstandingPrincipal) && loan.outstandingPrincipal >= 0;
      auditAddCheck(checks, `${label}: capital pendiente`, principalValid, `Capital pendiente: ${money(loan.outstandingPrincipal || 0)}.`);
      auditAddCheck(checks, `${label}: estado`, loan.status === 'Pagado' ? loan.outstandingPrincipal === 0 : (loan.status !== 'Activo' || loan.outstandingPrincipal > 0), loan.status === 'Pagado' ? 'Un crédito pagado debe tener capital pendiente cero.' : 'El estado debe corresponder al capital pendiente.');

      const payments = Array.isArray(loan.payments) ? loan.payments : [];
      const principalPaid = roundMoney(payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.principal) || 0), 0));
      const paidInterest = roundMoney(payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.interest) || 0), 0));
      const original = Number.isFinite(loan.originalDisbursedTotal)
        ? Math.max(0, roundMoney(loan.originalDisbursedTotal))
        : (loan.source === 'Avance de capital recuperado' ? 0 : Math.max(0, roundMoney(loan.principalOriginal || 0)));
      const reborrowed = Number.isFinite(loan.reborrowedCapitalTotal)
        ? Math.max(0, roundMoney(loan.reborrowedCapitalTotal))
        : (loan.source === 'Avance de capital recuperado' ? Math.max(0, roundMoney(loan.principalOriginal || 0)) : 0);
      const expectedBalance = Math.max(0, roundMoney(original + reborrowed - principalPaid));
      const delta = Math.abs(expectedBalance - roundMoney(loan.outstandingPrincipal || 0));
      auditAddCheck(checks, `${label}: conciliación de capital`, delta === 0, delta === 0
        ? `Capital inicial y reutilizado menos capital pagado = ${money(expectedBalance)}.`
        : `Diferencia de ${money(delta)}: esperado ${money(expectedBalance)}, registrado ${money(loan.outstandingPrincipal)}.`, 'error');

      payments.forEach((payment, index) => {
        const fieldsValid = [payment.amount, payment.principal, payment.interest].every((value) => Number.isSafeInteger(Number(value)) && Number(value) >= 0);
        const splitMatches = roundMoney(Number(payment.principal) + Number(payment.interest)) === roundMoney(payment.amount);
        if (!fieldsValid || !splitMatches) {
          auditAddCheck(checks, `${label}: distribución del pago ${index + 1}`, false, 'El importe no coincide con capital más interés o hay un valor monetario inválido.', 'error');
        }
      });
    });

    const treasuryHistory = Array.isArray(db.withdrawalTreasury?.history) ? db.withdrawalTreasury.history : [];
    const operationFeesInHistory = roundMoney(accounts.slice(1).reduce((sum, item) => sum + (item?.history || []).filter((move) => move.type === 'operation_fee').reduce((inner, move) => inner + Math.max(0, Number(move.amount) || 0), 0), 0) + treasuryHistory.filter((move) => move.type === 'operation_fee').reduce((sum, move) => sum + Math.max(0, Number(move.amount) || 0), 0));
    const advanceFeesInHistory = roundMoney(accounts.slice(1).reduce((sum, item) => sum + (item?.history || []).filter((move) => move.type === 'card_advance_fee').reduce((inner, move) => inner + Math.max(0, Number(move.amount) || 0), 0), 0) + treasuryHistory.filter((move) => move.type === 'card_advance_fee').reduce((sum, move) => sum + Math.max(0, Number(move.amount) || 0), 0));
    const operationFeesStored = roundMoney(Number(db.operationFeesCollected) || 0);
    const advanceFeesStored = roundMoney(Number(db.advanceFeesCollected) || 0);
    auditAddCheck(checks, 'Conciliación de comisiones de operaciones', Math.abs(operationFeesInHistory - operationFeesStored) === 0,
      `Contador: ${money(operationFeesStored)}; movimientos: ${money(operationFeesInHistory)}.`, 'warning');
    auditAddCheck(checks, 'Conciliación de comisiones por avance', Math.abs(advanceFeesInHistory - advanceFeesStored) === 0,
      `Contador: ${money(advanceFeesStored)}; movimientos: ${money(advanceFeesInHistory)}.`, 'warning');

    const archivedFinancial = db?.archivedFinancialSummary || {};
    const interestFromPayments = roundMoney(Math.max(0, Number(archivedFinancial.interestEarned) || 0) + loans.reduce((sum, loan) => sum + (Array.isArray(loan.payments) ? loan.payments.reduce((paid, payment) => paid + Math.max(0, Number(payment.interest) || 0), 0) : 0), 0));
    const analystInterest = totalInterestEarned();
    auditAddCheck(checks, 'Conciliación de intereses ganados', Math.abs(interestFromPayments - analystInterest) === 0,
      `Pagos registrados: ${money(interestFromPayments)}; tarjeta de intereses ganados: ${money(analystInterest)}.`, 'error');

    const linkedLoanApplicationAmounts = roundMoney(Math.max(0, Number(archivedFinancial.loanOriginalDisbursements) || 0) + loans.reduce((sum, loan) => sum + Math.max(0, Number(loan.originalDisbursedTotal ?? (loan.source === 'Avance de capital recuperado' ? 0 : loan.principalOriginal)) || 0), 0));
    const paidApplicationsAmount = roundMoney(Math.max(0, Number(archivedFinancial.applicationActivatedDisbursements) || 0) + applications.reduce((sum, application) => {
      const activated = Number.isFinite(application.activatedAmount)
        ? Math.max(0, Number(application.activatedAmount))
        : (['Desembolsado', 'Pagado'].includes(application.status) ? Math.max(0, Number(application.amount) || 0) : 0);
      return sum + activated;
    }, 0));
    auditAddCheck(checks, 'Conciliación de desembolsos originales', Math.abs(linkedLoanApplicationAmounts - paidApplicationsAmount) === 0,
      `Capital activado en préstamos: ${money(linkedLoanApplicationAmounts)}; desembolsos ya avanzados en solicitudes: ${money(paidApplicationsAmount)}. Los fondos aún en tarjeta no generan crédito.`, 'warning');

    const unlinkedDisbursements = applications.filter((application) => {
      const activated = Number.isFinite(application.activatedAmount)
        ? Number(application.activatedAmount) > 0
        : ['Desembolsado', 'Pagado'].includes(application.status);
      return activated && !findLoanForApplication(application.id);
    });
    auditAddCheck(checks, 'Solicitudes desembolsadas vinculadas a crédito', unlinkedDisbursements.length === 0,
      unlinkedDisbursements.length ? `${unlinkedDisbursements.length} solicitud(es) desembolsada(s) no tiene(n) un crédito asociado.` : 'Todas las solicitudes desembolsadas tienen un crédito asociado.', unlinkedDisbursements.length ? 'warning' : 'error');

    const pendingByAccount = new Map();
    applications.filter((application) => (application.status || 'En revisión') === 'En revisión').forEach((application) => {
      pendingByAccount.set(application.accountId, (pendingByAccount.get(application.accountId) || 0) + 1);
    });
    const duplicatePending = Array.from(pendingByAccount.entries()).filter(([, count]) => count > 1);
    auditAddCheck(checks, 'Solicitudes pendientes por titular', duplicatePending.length === 0,
      duplicatePending.length ? `Hay varios pendientes para las cuentas: ${duplicatePending.map(([id, count]) => `${id} (${count})`).join(', ')}.` : 'Ningún titular tiene más de una solicitud personal pendiente.', duplicatePending.length ? 'warning' : 'error');

    const pendingIncreaseByAccount = new Map();
    increaseRequests.filter((request) => (request.status || 'En revisión') === 'En revisión').forEach((request) => {
      pendingIncreaseByAccount.set(request.accountId, (pendingIncreaseByAccount.get(request.accountId) || 0) + 1);
    });
    const duplicatePendingIncreases = Array.from(pendingIncreaseByAccount.entries()).filter(([, count]) => count > 1);
    auditAddCheck(checks, 'Solicitudes pendientes de aumento de cupo', duplicatePendingIncreases.length === 0,
      duplicatePendingIncreases.length ? `Hay varias solicitudes de aumento pendientes para las cuentas: ${duplicatePendingIncreases.map(([id, count]) => `${id} (${count})`).join(', ')}.` : 'Ningún titular tiene más de una solicitud de aumento pendiente.', 'warning');

    const uniqueIds = (items) => {
      const ids = items.map((item) => item?.id).filter((id) => typeof id === 'string' && id);
      return ids.length === new Set(ids).size;
    };
    const historyIdsUnique = accounts.slice(1).every((item) => uniqueIds(item?.history || []) && uniqueIds(item?.card?.history || [])) && uniqueIds(treasuryHistory);
    auditAddCheck(checks, 'Identificadores de movimientos únicos', historyIdsUnique, historyIdsUnique ? 'Los movimientos de ahorros, tarjetas y tesorería no repiten identificadores dentro de sus libros.' : 'Hay identificadores de movimiento repetidos en un historial de ahorros, tarjeta o tesorería.', 'warning');
    const loanIdsUnique = uniqueIds(loans);
    const applicationIdsUnique = uniqueIds(applications);
    auditAddCheck(checks, 'Identificadores de créditos y solicitudes únicos', loanIdsUnique && applicationIdsUnique, loanIdsUnique && applicationIdsUnique ? 'Los identificadores de préstamos y solicitudes no se repiten.' : 'Se encontraron referencias de préstamo o solicitud duplicadas.', 'error');

    const rawAnalystAvailability = roundMoney(totalAnalystBalance() - analystCapitalCommitted());
    auditAddCheck(checks, 'Fondo disponible del analista', Number.isFinite(rawAnalystAvailability) && rawAnalystAvailability >= 0,
      rawAnalystAvailability >= 0
      ? `Capital libre calculado: ${money(rawAnalystAvailability)} después de restar créditos activos y fondos que siguen en las tarjetas.`
        : `El capital pendiente supera el fondo total por ${money(Math.abs(rawAnalystAvailability))}. Bloquea nuevos desembolsos hasta revisar la conciliación.`, 'error');

    const auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
    const auditIds = auditLog.map((entry) => entry.id).filter(Boolean);
    const duplicates = auditIds.length - new Set(auditIds).size;
    auditAddCheck(checks, 'Identificadores del registro de auditoría', duplicates === 0,
      duplicates ? `Se detectaron ${duplicates} identificadores repetidos.` : `Los ${auditIds.length} eventos tienen identificadores únicos.`, duplicates ? 'warning' : 'error');

    const errors = checks.filter((item) => !item.passed && item.severity !== 'warning');
    const warnings = checks.filter((item) => !item.passed && item.severity === 'warning');
    return { generatedAt: new Date().toISOString(), checks, errors, warnings, passed: checks.length - errors.length - warnings.length };
  }

  function captureFinancialStateSummary() {
    const accounts = Array.isArray(db?.accounts) ? db.accounts.slice(1) : [];
    const liveLoans = Array.isArray(db?.loans) ? db.loans : [];
    const archivedFinancial = db?.archivedFinancialSummary || {};
    const archivedLoans = (Array.isArray(archivedFinancial.monthlyPayments) ? archivedFinancial.monthlyPayments : []).map((row) => ({
      id: `archived-${row.accountId}-${row.month}`, accountId: row.accountId, status: 'Archivado', outstandingPrincipal: 0,
      payments: [{ amount: row.amount, principal: row.principal, interest: row.interest, count: row.count, date: `${row.month}-15T12:00:00` }]
    }));
    const archivedApplications = (Array.isArray(archivedFinancial.monthlyDisbursements) ? archivedFinancial.monthlyDisbursements : []).map((row) => ({
      id: `archived-disbursement-${row.accountId}-${row.month}`, accountId: row.accountId, amount: row.amount,
      disbursedAt: `${row.month}-15T12:00:00`, status: 'Desembolsado', archivedCount: row.count
    }));
    const loans = [...liveLoans, ...archivedLoans];
    const payments = liveLoans.flatMap((loan) => Array.isArray(loan.payments) ? loan.payments : []);
    const histories = accounts.flatMap((item) => (item?.history || []).map((movement) => ({ ...movement, accountId: item.id, accountName: item.name })));
    const treasuryHistory = Array.isArray(db?.withdrawalTreasury?.history) ? db.withdrawalTreasury.history.map((movement) => ({ ...movement, accountId: null, accountName: TREASURY_NAME })) : [];
    histories.push(...treasuryHistory);
    return {
      savingsBalance: roundMoney(accounts.reduce((sum, item) => sum + (Number(item.balance) || 0), 0)),
      originalDisbursements: roundMoney(accounts.reduce((sum, account) => sum + totalDisbursedForAccount(account.id), 0)),
      outstandingPrincipal: outstandingLoanPrincipalAcrossSystem(),
      principalRecovered: roundMoney(Math.max(0, Number(db?.archivedFinancialSummary?.principalRecovered) || 0) + payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.principal) || 0), 0)),
      interestEarned: totalInterestEarned(),
      advanceFees: totalAdvanceFeesEarned(),
      operationFees: totalOperationFeesEarned(),
      activeLoans: loans.filter((loan) => loan.status === 'Activo' && Number(loan.outstandingPrincipal) > 0).length,
      overdueLoans: loans.filter((loan) => loan.status === 'Activo' && Number(loan.outstandingPrincipal) > 0 && typeof loan.nextDueDate === 'string' && loan.nextDueDate < localDateKey()).length,
      pendingApplications: (db.creditApplications || []).filter((application) => (application.status || 'En revisión') === 'En revisión').length,
      histories,
      loans,
      applications: [...(Array.isArray(db.creditApplications) ? db.creditApplications : []), ...archivedApplications]
    };
  }
