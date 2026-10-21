  function consolidateActiveLoans(database) {
    if (!database || !Array.isArray(database.loans)) return;
    for (let accountId = 1; accountId <= 3; accountId += 1) {
      const activeLoans = database.loans
        .filter((loan) => loan.accountId === accountId && loan.status !== 'Pagado' && Number(loan.outstandingPrincipal) > 0)
        .sort((a, b) => new Date(a.disbursedAt || 0) - new Date(b.disbursedAt || 0));
      if (activeLoans.length <= 1) continue;
      const primary = activeLoans[0];
      const activeIds = new Set(activeLoans.map((loan) => loan.id));
      const outstanding = roundMoney(activeLoans.reduce((sum, loan) => sum + Math.max(0, Number(loan.outstandingPrincipal) || 0), 0));
      const originalDisbursed = roundMoney(activeLoans.reduce((sum, loan) => {
        const original = Number.isFinite(loan.originalDisbursedTotal)
          ? loan.originalDisbursedTotal
          : (loan.source === 'Avance de capital recuperado' ? 0 : Number(loan.principalOriginal) || 0);
        return sum + Math.max(0, original);
      }, 0));
      const reusedCapital = roundMoney(activeLoans.reduce((sum, loan) => {
        const reused = Number.isFinite(loan.reborrowedCapitalTotal)
          ? loan.reborrowedCapitalTotal
          : (loan.source === 'Avance de capital recuperado' ? Number(loan.principalOriginal) || 0 : 0);
        return sum + Math.max(0, reused);
      }, 0));
      const allApplications = Array.from(new Set(activeLoans.flatMap((loan) => [
        ...(Array.isArray(loan.applicationIds) ? loan.applicationIds : []),
        ...(loan.applicationId ? [loan.applicationId] : [])
      ]).filter((id) => typeof id === 'string' && id)));
      const allPayments = activeLoans.flatMap((loan) => Array.isArray(loan.payments) ? loan.payments : [])
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      const priorInstallmentsPaid = activeLoans.reduce((sum, loan) => sum + Math.max(0, Number(loan.installmentsPaid) || 0), 0);
      primary.outstandingPrincipal = outstanding;
      primary.originalDisbursedTotal = originalDisbursed;
      primary.principalOriginal = originalDisbursed;
      primary.reborrowedCapitalTotal = reusedCapital;
      primary.applicationIds = allApplications;
      primary.applicationId = primary.applicationId || allApplications[0] || null;
      primary.payments = allPayments;
      primary.installmentsPaid = priorInstallmentsPaid;
      primary.monthlyRate = ILLUSTRATIVE_MONTHLY_RATE;
      primary.termMonths = priorInstallmentsPaid + 60;
      primary.monthlyPayment = calculateCreditEstimate(outstanding, 60).monthlyPayment;
      primary.nextDueDate = addMonthsToDate(localDateKey(), 1);
      primary.source = originalDisbursed > 0 ? 'Crédito unificado' : 'Avance de capital recuperado';
      primary.status = 'Activo';
      primary.closedAt = null;
      database.loans = database.loans.filter((loan) => !activeIds.has(loan.id) || loan.id === primary.id);
    }
  }

  function recordCardMovement(accountId, type, amount, description, direction = null) {
    const card = db.accounts[accountId].card;
    if (!Array.isArray(card.history)) card.history = [];
    const item = { id: createId(), type, amount: roundMoney(amount), description, direction, date: new Date().toISOString() };
    card.history.unshift(item);
    return item;
  }

  function saveDatabase() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (error) {
      showToast('No se pudo guardar en este navegador. Comprueba el almacenamiento disponible.', 'error');
    }
  }

  function resetDailyWithdrawalIfNeeded(account) {
    const today = localDateKey();
    if (account.withdrawalDate !== today) {
      account.withdrawnToday = 0;
      account.withdrawalDate = today;
    }
  }
