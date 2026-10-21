  function submitOperation(event) {
    event.preventDefault();
    if (!currentModalAction || !account()) return;
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
    const current = account();
    resetDailyWithdrawalIfNeeded(current);

    if (currentModalAction === 'deposit') {
      if (amount <= OPERATION_FEE) return operationProblem(`El depósito debe superar la comisión fija de ${money(OPERATION_FEE)}.`);
      const netAmount = roundMoney(amount - OPERATION_FEE);
      if (current.balance + netAmount > MAX_ACCOUNT_BALANCE) {
        return operationProblem(`Después de descontar la comisión de ${money(OPERATION_FEE)}, este depósito superaría el saldo máximo de ${money(MAX_ACCOUNT_BALANCE)}. Puedes ingresar como máximo ${money(MAX_ACCOUNT_BALANCE - current.balance + OPERATION_FEE)}.`);
      }
      current.balance = roundMoney(current.balance + netAmount);
      db.operationFeesCollected = roundMoney((Number(db.operationFeesCollected) || 0) + OPERATION_FEE);
      recordMovement(activeAccountId, 'deposit', amount, `Depósito ingresado · Neto recibido ${money(netAmount)}`, 'in');
      recordMovement(activeAccountId, 'operation_fee', OPERATION_FEE, 'Comisión por depósito', 'out');
      finalizeOperation(`Depósito de ${money(amount)} realizado. Comisión: ${money(OPERATION_FEE)}. Neto abonado: ${money(netAmount)}.`);
      return;
    }

    if (currentModalAction === 'withdraw') {
      const totalDebit = roundMoney(amount + OPERATION_FEE);
      if (totalDebit > current.balance) return operationProblem(`Saldo insuficiente. Necesitas ${money(totalDebit)} para retirar ${money(amount)} y pagar la comisión de ${money(OPERATION_FEE)}.`);
      current.balance = roundMoney(current.balance - totalDebit);
      current.withdrawnToday = roundMoney(current.withdrawnToday + amount);
      db.operationFeesCollected = roundMoney((Number(db.operationFeesCollected) || 0) + OPERATION_FEE);
      recordMovement(activeAccountId, 'withdraw', amount, 'Retiro de efectivo entregado', 'out');
      recordMovement(activeAccountId, 'operation_fee', OPERATION_FEE, 'Comisión por retiro', 'out');
      finalizeOperation(`Retiro de ${money(amount)} realizado. Comisión: ${money(OPERATION_FEE)}.`);
      return;
    }

    if (currentModalAction === 'transfer') {
      const destinationId = Number(destinationSelect.value);
      if (!Number.isInteger(destinationId) || destinationId < 1 || destinationId > 3) return operationProblem('Selecciona una cuenta destino válida.');
      if (destinationId === activeAccountId) return operationProblem('No puedes transferir dinero a tu misma cuenta.');
      const totalDebit = roundMoney(amount + OPERATION_FEE);
      if (totalDebit > current.balance) return operationProblem(`Saldo insuficiente. Necesitas ${money(totalDebit)} para transferir ${money(amount)} y pagar la comisión de ${money(OPERATION_FEE)}.`);
      const destination = db.accounts[destinationId];
      if (destination.balance + amount > MAX_ACCOUNT_BALANCE) {
        return operationProblem(`La cuenta de destino no puede superar ${money(MAX_ACCOUNT_BALANCE)}. Solo puede recibir ${money(MAX_ACCOUNT_BALANCE - destination.balance)} más.`);
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
