  function createMovementRow(item) {
    const row = document.createElement('article');
    row.className = 'movement-row';
    const type = item.type;
    let icon = '＋';
    if (type === 'withdraw') icon = '↗';
    if (type === 'withdrawal_received') icon = '↙';
    if (type === 'deposit_funded') icon = '↗';
    if (type === 'transfer') icon = '⇄';
    if (type === 'credit_disbursement' || type === 'card_disbursement') icon = '↙';
    if (type === 'loan_payment' || type === 'card_payment') icon = '↘';
    if (type === 'loan_abono') icon = '↓';
    if (type === 'operation_fee') icon = '−';
    if (String(type).startsWith('card_')) icon = type === 'card_payment' ? '✓' : type === 'card_advance' || type === 'card_advance_sent' || type === 'card_advance_received' ? '↗' : '▣';
    const leading = document.createElement('div');
    leading.className = 'movement-leading';
    const iconEl = document.createElement('span');
    iconEl.className = `movement-icon ${type}`;
    iconEl.textContent = icon;
    iconEl.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'movement-copy';
    const title = document.createElement('div');
    title.className = 'movement-title';
    title.textContent = item.description;
    const meta = document.createElement('div');
    meta.className = 'movement-meta';
    meta.textContent = shortDateTime(item.date);
    copy.append(title, meta);
    leading.append(iconEl, copy);
    const trailing = document.createElement('div');
    trailing.className = 'movement-trailing';
    const amount = document.createElement('div');
    amount.className = 'movement-amount';
    if (item.direction === 'in') {
      amount.textContent = `+ ${money(item.amount)}`;
      amount.classList.add('positive');
    } else if (item.direction === 'out') {
      amount.textContent = `− ${money(item.amount)}`;
      amount.classList.add('negative');
    } else if (type === 'deposit') {
      amount.textContent = `+ ${money(item.amount)}`;
      amount.classList.add('positive');
    } else if (type === 'withdraw') {
      amount.textContent = `− ${money(item.amount)}`;
      amount.classList.add('negative');
    } else {
      amount.textContent = money(item.amount);
    }
    const status = document.createElement('div');
    status.className = 'movement-status';
    status.textContent = 'Registrado';
    trailing.append(amount, status);
    row.append(leading, trailing);
    return row;
  }
