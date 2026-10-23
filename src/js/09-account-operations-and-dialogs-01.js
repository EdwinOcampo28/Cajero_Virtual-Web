  function openModal(action) {
    if (action === 'deposit' && typeof catchUpAutomaticEventsBeforeOperation === 'function' && !catchUpAutomaticEventsBeforeOperation()) return;
    if (action === 'deposit') accrueWithdrawalTreasury(db);
    if (action === 'balance') {
      renderApp();
      showToast(`Saldo disponible: ${money(account().balance)}.`);
      return;
    }
    const config = {
      deposit: { icon: '＋', eyebrow: 'AUMENTAR SALDO', title: 'Depositar dinero', description: `Tesorería financiará el importe total; se cobrará una comisión fija de ${money(DEPOSIT_FEE)} y el saldo recibirá el neto.`, label: 'Monto del depósito', hint: `Máximo por depósito: ${money(MAX_DEPOSIT_AMOUNT)}. Tesorería disponible: ${money(db.withdrawalTreasury?.balance || 0)}. Comisión: ${money(DEPOSIT_FEE)}; el importe total se descuenta de Tesorería y el neto llega a tus ahorros. Ahorros sin tope de saldo.` },
      withdraw: { icon: "↗", eyebrow: "RETIRO DE EFECTIVO", title: "Retirar dinero", description: "El importe se acreditará automáticamente a la Tesorería de retiros. La comisión fija de " + money(OPERATION_FEE) + " se cobra por separado.", label: "Monto a retirar", hint: "Saldo disponible: " + money(account().balance) + ". El importe se enviará a Tesorería de retiros (•••• 0004). Comisión: " + money(OPERATION_FEE) + ". Máximo por retiro: " + money(MAX_WITHDRAWAL_AMOUNT) + "." },
      transfer: { icon: '⇄', eyebrow: 'ENVÍO ENTRE CUENTAS', title: 'Transferir dinero', description: `El destinatario recibe el importe indicado; a tu cuenta se le descontará además la comisión de ${money(OPERATION_FEE)}.`, label: 'Monto a transferir', hint: `Saldo disponible: ${money(account().balance)}. Comisión: ${money(OPERATION_FEE)}. Máximo por transferencia: ${money(MAX_TRANSFER_AMOUNT)}. No se permiten transferencias a la misma cuenta.` }
    };
    const selected = config[action];
    if (!selected) return;
    currentModalAction = action;
    previousFocusedElement = document.activeElement;
    $('#modalIcon').textContent = selected.icon;
    $('#modalEyebrow').textContent = selected.eyebrow;
    $('#modalTitle').textContent = selected.title;
    $('#modalDescription').textContent = selected.description;
    $('#amountLabel').textContent = selected.label;
    $('#operationHint').lastElementChild.textContent = selected.hint;
    $('#confirmOperationButton').innerHTML = `${action === 'deposit' ? 'Confirmar depósito' : action === 'withdraw' ? 'Confirmar retiro' : 'Confirmar transferencia'} <span aria-hidden="true">→</span>`;
    destinationField.hidden = action !== 'transfer';
    if (action === 'transfer') populateDestinations();
    const quickAmounts = $('#quickAmounts');
    quickAmounts.replaceChildren();
    const presets = action === 'deposit' ? QUICK_DEPOSIT_AMOUNTS : action === 'withdraw' ? QUICK_WITHDRAW_AMOUNTS : action === 'transfer' ? QUICK_TRANSFER_AMOUNTS : [];
    quickAmounts.hidden = presets.length === 0;
    presets.forEach((amount) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-amount';
      button.dataset.amount = String(amount);
      button.setAttribute('aria-pressed', 'false');
      button.textContent = money(amount);
      quickAmounts.append(button);
    });
    amountInput.step = '1';
    amountInput.min = '1';
    amountInput.max = String(action === 'deposit' ? MAX_DEPOSIT_AMOUNT : action === 'withdraw' ? MAX_WITHDRAWAL_AMOUNT : MAX_TRANSFER_AMOUNT);
    operationError.hidden = true;
    amountInput.value = '';
    amountInput.placeholder = '0';
    amountInput.setAttribute('aria-invalid', 'false');
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => (action === 'transfer' ? destinationSelect : amountInput).focus(), 20);
  }

  function populateDestinations() {
    destinationSelect.replaceChildren();
    for (let id = 1; id <= MAX_ACCOUNT_ID; id += 1) {
      if (id === activeAccountId) continue;
      const option = document.createElement('option');
      option.value = String(id);
      option.textContent = `Ahorros · •••• ${db.accounts[id].accountNumber.slice(-4)} · ${db.accounts[id].name}`;
      destinationSelect.append(option);
    }
  }

  function closeModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
    currentModalAction = null;
    if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') previousFocusedElement.focus();
  }
