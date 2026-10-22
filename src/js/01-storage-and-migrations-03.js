  function freshDatabase() {
    return {
      accounts: ACCOUNT_SEED.map((seed) => seed ? {
        ...seed,
        withdrawalDate: localDateKey(),
        history: [],
        card: { number: seed.cardNumber, limit: MAX_CARD_FUNDS, funds: 0, recoveredFunds: 0, debt: 0, nextInterestDate: null, history: [], pendingDisbursements: [] }
      } : null),
      creditApplications: [],
      loans: [],
      advanceFeesCollected: 0,
      operationFeesCollected: 0,
      limitIncreaseRequests: [],
      auditLog: [],
      withdrawalTreasury: freshWithdrawalTreasury()
    };
  }

  function freshWithdrawalTreasury() {
    return { name: TREASURY_NAME, accountNumber: TREASURY_ACCOUNT_NUMBER, pin: TREASURY_PIN, balance: 0, history: [], elapsedSeconds: 0, timerIncomeTotal: 0, lastAccruedAt: new Date().toISOString() };
  }

  function normalizeWithdrawalTreasury(database) {
    const legacyReceiver = database.accounts?.[4];
    const hadTreasury = Boolean(database.withdrawalTreasury && typeof database.withdrawalTreasury === 'object' && !Array.isArray(database.withdrawalTreasury));
    const saved = hadTreasury ? database.withdrawalTreasury : {};
    if (hadTreasury && ((saved.balance !== undefined && (!Number.isSafeInteger(saved.balance) || saved.balance < 0))
      || (saved.history !== undefined && (!Array.isArray(saved.history) || saved.history.length > 10000 || saved.history.some((item) => !item || typeof item !== 'object' || (item.amount !== undefined && (!Number.isSafeInteger(item.amount) || item.amount < 0)))))
      || (saved.elapsedSeconds !== undefined && (!Number.isSafeInteger(saved.elapsedSeconds) || saved.elapsedSeconds < 0))
      || (saved.timerIncomeTotal !== undefined && (!Number.isSafeInteger(saved.timerIncomeTotal) || saved.timerIncomeTotal < 0))
      || (saved.lastAccruedAt !== undefined && (typeof saved.lastAccruedAt !== 'string' || Number.isNaN(Date.parse(saved.lastAccruedAt)))))) return null;
    if (!hadTreasury && legacyReceiver && (!Number.isSafeInteger(legacyReceiver.balance) || legacyReceiver.balance < 0 || !Array.isArray(legacyReceiver.history))) return null;
    const treasury = {
      ...freshWithdrawalTreasury(),
      balance: hadTreasury ? (saved.balance ?? 0) : 0,
      history: Array.isArray(saved.history) ? saved.history.slice().map((item) => ({ ...item, amount: Math.round(item.amount || 0) })) : [],
      elapsedSeconds: saved.elapsedSeconds ?? 0,
      timerIncomeTotal: saved.timerIncomeTotal ?? saved.elapsedSeconds ?? 0,
      lastAccruedAt: saved.lastAccruedAt || new Date().toISOString()
    };
    if (!hadTreasury && legacyReceiver) {
      treasury.balance = legacyReceiver.balance;
      treasury.history = legacyReceiver.history.slice(0, 10000).map((item) => ({ ...item, amount: Math.round(Number(item.amount) || 0) }));
    }
    database.accounts = database.accounts.slice(0, MAX_ACCOUNT_ID + 1);
    database.withdrawalTreasury = treasury;
    return treasury;
  }

  function appendTreasuryAuditEvent(database, movement) {
    if (!Array.isArray(database.auditLog)) database.auditLog = [];
    const existing = database.auditLog.find((event) => event.id === movement.id);
    const event = {
      id: typeof movement.id === 'string' ? movement.id : createId(),
      date: movement.date || new Date().toISOString(),
      action: movement.type === 'timer_income' ? 'Acumulación automática de tesorería' : movement.type === 'withdrawal_received' ? 'Retiro acreditado a tesorería' : movement.type === 'deposit_funded' ? 'Depósito financiado por Tesorería' : movement.type === 'treasury_transfer' ? 'Transferencia enviada desde Tesorería' : 'Movimiento de Tesorería',
      category: 'tesoreria', accountId: null, accountName: TREASURY_NAME, source: movement.type === 'timer_income' ? 'Temporizador' : 'Tesorería',
      amount: Math.max(0, Math.round(Number(movement.amount) || 0)), direction: movement.direction || null,
      description: String(movement.description || '').slice(0, 400), referenceId: movement.id || null, details: { movementType: movement.type || 'movement', ratePesosPerSecond: movement.ratePesosPerSecond || null, elapsedSeconds: movement.elapsedSeconds || null }
    };
    if (existing) Object.assign(existing, event);
    else database.auditLog.unshift(event);
    if (database.auditLog.length > MAX_AUDIT_EVENTS) database.auditLog.length = MAX_AUDIT_EVENTS;
  }

  function recordTreasuryMovement(type, amount, description, direction = null) {
    const treasury = db?.withdrawalTreasury;
    if (!treasury || !Number.isSafeInteger(amount) || amount < 0) return null;
    const item = { id: createId(), type, amount, description: String(description || ''), direction, date: new Date().toISOString() };
    treasury.history.unshift(item);
    treasury.history = treasury.history.slice(0, 10000);
    appendTreasuryAuditEvent(db, item);
    return item;
  }

  function accrueWithdrawalTreasury(database = db, now = Date.now()) {
    const treasury = database?.withdrawalTreasury;
    if (!treasury || !Number.isSafeInteger(treasury.balance) || !Number.isFinite(now)) return false;
    const last = Date.parse(treasury.lastAccruedAt);
    if (!Number.isFinite(last) || last > now) { treasury.lastAccruedAt = new Date(now).toISOString(); return false; }
    const seconds = Math.floor((now - last) / 1000);
    if (seconds < 1) return false;
    if (!Number.isSafeInteger(treasury.timerIncomeTotal) || treasury.timerIncomeTotal < 0) {
      treasury.timerIncomeTotal = Math.max(0, Math.round(Number(treasury.elapsedSeconds) || 0));
    }
    const income = seconds * TREASURY_TIMER_RATE;
    if (!Number.isSafeInteger(income) || income > Number.MAX_SAFE_INTEGER - treasury.balance
      || seconds > Number.MAX_SAFE_INTEGER - treasury.elapsedSeconds
      || income > Number.MAX_SAFE_INTEGER - treasury.timerIncomeTotal) return false;
    const latest = treasury.history[0];
    const canExtendLatestTimer = latest?.type === 'timer_income' && latest.ratePesosPerSecond === TREASURY_TIMER_RATE;
    if (canExtendLatestTimer && income > Number.MAX_SAFE_INTEGER - latest.amount) return false;
    const accruedSeconds = (canExtendLatestTimer ? Number(latest.elapsedSeconds) || 0 : 0) + seconds;
    const accruedAmount = (canExtendLatestTimer ? latest.amount : 0) + income;
    const item = canExtendLatestTimer
      ? { ...latest, amount: accruedAmount, elapsedSeconds: accruedSeconds, description: `Temporizador: ${accruedSeconds} segundo(s) a $${TREASURY_TIMER_RATE} por segundo`, direction: 'in', date: new Date(now).toISOString() }
      : { id: createId(), type: 'timer_income', amount: income, elapsedSeconds: seconds, ratePesosPerSecond: TREASURY_TIMER_RATE, description: `Temporizador: ${seconds} segundo(s) a $${TREASURY_TIMER_RATE} por segundo`, direction: 'in', date: new Date(now).toISOString() };
    treasury.balance += income;
    treasury.timerIncomeTotal += income;
    treasury.elapsedSeconds += seconds;
    treasury.lastAccruedAt = new Date(last + seconds * 1000).toISOString();
    if (canExtendLatestTimer) treasury.history[0] = item;
    else treasury.history.unshift(item);
    treasury.history = treasury.history.slice(0, 10000);
    appendTreasuryAuditEvent(database, item);
    return true;
  }

  function migrateLegacyCardDebts(database) {
    if (!database || !Array.isArray(database.loans)) return;
    for (let accountId = 1; accountId <= MAX_ACCOUNT_ID; accountId += 1) {
      const card = database.accounts?.[accountId]?.card;
      if (!card) continue;
      const legacyDebt = Math.max(0, Math.round(Number(card.debt) || 0));
      if (legacyDebt <= 0) {
        card.debt = 0;
        card.nextInterestDate = null;
        continue;
      }
      const active = database.loans.find((loan) => loan.accountId === accountId && loan.status === 'Activo' && Number(loan.outstandingPrincipal) > 0);
      if (active) {
        active.outstandingPrincipal = roundMoney(active.outstandingPrincipal + legacyDebt);
        active.reborrowedCapitalTotal = roundMoney((Number(active.reborrowedCapitalTotal) || 0) + legacyDebt);
        active.originalDisbursedTotal = Math.max(0, roundMoney(Number.isFinite(active.originalDisbursedTotal) ? active.originalDisbursedTotal : (active.source === 'Avance de capital recuperado' ? 0 : Number(active.principalOriginal) || 0)));
        active.principalOriginal = active.originalDisbursedTotal;
        active.source = active.originalDisbursedTotal > 0 ? 'Crédito unificado' : 'Avance de capital recuperado';
        const paid = Math.max(0, Number(active.installmentsPaid) || 0);
        active.monthlyRate = ILLUSTRATIVE_MONTHLY_RATE;
        active.termMonths = paid + 60;
        active.monthlyPayment = calculateCreditEstimate(active.outstandingPrincipal, 60).monthlyPayment;
        active.nextDueDate = addMonthsToDate(localDateKey(), 1);
      } else {
        const migratedLoan = createLoanFromCardAdvance(accountId, legacyDebt);
        if (migratedLoan) database.loans.push(migratedLoan);
      }
      card.debt = 0;
      card.nextInterestDate = null;
      if (!Array.isArray(card.history)) card.history = [];
      card.history.unshift({ id: createId(), type: 'card_debt_unified', amount: legacyDebt, description: 'Saldo heredado integrado en la deuda única de crédito', direction: 'out', date: new Date().toISOString() });
    }
  }
