  function submitOperation(event) {
    event.preventDefault();
    if (!currentModalAction || !account()) return;
    if (typeof catchUpAutomaticEventsBeforeOperation === 'function' && !catchUpAutomaticEventsBeforeOperation()) return;
    operationError.hidden = true;
    const rawAmount = Number(amountInput.value);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || !Number.isInteger(rawAmount)) {
      return operationProblem('Ingresa un monto entero mayor que cero, sin decimales.');
    }
    const amount = roundMoney(rawAmount);
    if (currentModalAction === 'deposit' && amount > MAX_DEPOSIT_AMOUNT) {
      return operationProblem(`El depósito máximo por operación es de ${money(MAX_DEPOSIT_AMOUNT)}.`);
    }
    if (currentModalAction === 'withdraw' && amount > MAX_WITHDRAWAL_AMOUNT) {
      return operationProblem(`El retiro máximo por operación es de ${money(MAX_WITHDRAWAL_AMOUNT)}.`);
    }
    if (currentModalAction === 'transfer' && amount > MAX_TRANSFER_AMOUNT) {
      return operationProblem(`La transferencia máxima por operación es de ${money(MAX_TRANSFER_AMOUNT)}.`);
    }
    const current = account();
    resetDailyWithdrawalIfNeeded(current);

    if (currentModalAction === 'deposit') {
      if (amount <= DEPOSIT_FEE) return operationProblem(`El depósito debe superar la comisión fija de ${money(DEPOSIT_FEE)}.`);
      const netAmount = roundMoney(amount - DEPOSIT_FEE);
      if (current.balance + netAmount > maxSavingsBalanceForAccount(activeAccountId)) {
        return operationProblem(`El depósito excede la precisión numérica segura que admite el simulador.`);
      }
      const treasury = db.withdrawalTreasury;
      accrueWithdrawalTreasury(db);
      if (!treasury || !Number.isSafeInteger(treasury.balance) || treasury.balance < 0) return operationProblem('No se pudo validar el saldo disponible en Tesorería. El depósito no se realizó.');
      if (amount > treasury.balance) return operationProblem(`Tesorería dispone de ${money(treasury.balance)} y no alcanza para financiar el depósito de ${money(amount)}.`);
      treasury.balance -= amount;
      recordTreasuryMovement('deposit_funded', amount, `Depósito de ${current.name}; ${money(netAmount)} abonados y ${money(DEPOSIT_FEE)} de comisión`, 'out');
      current.balance = roundMoney(current.balance + netAmount);
      db.operationFeesCollected = roundMoney((Number(db.operationFeesCollected) || 0) + DEPOSIT_FEE);
      recordMovement(activeAccountId, 'deposit', amount, `Depósito ingresado · Neto recibido ${money(netAmount)}`, 'in');
      recordMovement(activeAccountId, 'operation_fee', DEPOSIT_FEE, 'Comisión por depósito', 'out');
      finalizeOperation(`Depósito de ${money(amount)} realizado. Comisión: ${money(DEPOSIT_FEE)}. Neto abonado: ${money(netAmount)}.`);
      return;
    }

    if (currentModalAction === 'withdraw') {
      const totalDebit = roundMoney(amount + OPERATION_FEE);
      if (totalDebit > current.balance) return operationProblem(`Saldo insuficiente. Necesitas ${money(totalDebit)} para retirar ${money(amount)} y pagar la comisión de ${money(OPERATION_FEE)}.`);
      const receiver = db.withdrawalTreasury;
      if (!receiver || !Number.isSafeInteger(receiver.balance) || amount > Number.MAX_SAFE_INTEGER - receiver.balance) return operationProblem('La Tesorería de retiros alcanzó su límite seguro de saldo; el retiro no se aplicó.');
      current.balance = roundMoney(current.balance - totalDebit);
      current.withdrawnToday = roundMoney(current.withdrawnToday + amount);
      db.operationFeesCollected = roundMoney((Number(db.operationFeesCollected) || 0) + OPERATION_FEE);
      recordMovement(activeAccountId, 'withdraw', amount, `Retiro dirigido a ${TREASURY_NAME}`, 'out');
      recordMovement(activeAccountId, 'operation_fee', OPERATION_FEE, 'Comisión por retiro', 'out');
      receiver.balance += amount;
      recordTreasuryMovement('withdrawal_received', amount, `Retiro recibido automáticamente de ${current.name}`, 'in');
      finalizeOperation(`Retiro de ${money(amount)} acreditado a ${TREASURY_NAME}. Comisión: ${money(OPERATION_FEE)}.`);
      return;
    }

    if (currentModalAction === 'transfer') {
      const destinationId = Number(destinationSelect.value);
      if (!Number.isInteger(destinationId) || destinationId < 1 || destinationId > MAX_ACCOUNT_ID) return operationProblem('Selecciona una cuenta destino válida.');
      if (destinationId === activeAccountId) return operationProblem('No puedes transferir dinero a tu misma cuenta.');
      const totalDebit = roundMoney(amount + OPERATION_FEE);
      if (totalDebit > current.balance) return operationProblem(`Saldo insuficiente. Necesitas ${money(totalDebit)} para transferir ${money(amount)} y pagar la comisión de ${money(OPERATION_FEE)}.`);
      const destination = db.accounts[destinationId];
      if (destination.balance + amount > maxSavingsBalanceForAccount(destinationId)) {
        return operationProblem(`La transferencia excede la precisión numérica segura que admite el simulador.`);
      }
      current.balance = roundMoney(current.balance - totalDebit);
      destination.balance = roundMoney(destination.balance + amount);
      db.operationFeesCollected = roundMoney((Number(db.operationFeesCollected) || 0) + OPERATION_FEE);
      recordMovement(activeAccountId, 'transfer', amount, `Transferencia enviada a ${destination.name}`, 'out');
      recordMovement(activeAccountId, 'operation_fee', OPERATION_FEE, 'Comisión por transferencia', 'out');
      recordMovement(destinationId, 'transfer', amount, `Transferencia recibida de ${current.name}`, 'in');
      finalizeOperation(`Transferencia de ${money(amount)} enviada a ${destination.name}. Comisión: ${money(OPERATION_FEE)}.`);
    }
  }

  function operationProblem(message) {
    operationError.textContent = message;
    operationError.hidden = false;
    amountInput.setAttribute('aria-invalid', 'true');
    amountInput.focus();
  }
