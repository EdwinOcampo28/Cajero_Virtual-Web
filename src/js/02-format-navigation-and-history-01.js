  function money(value, includeCurrency = true) {
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(Number(value) || 0));
    return includeCurrency ? `$ ${formatted}` : formatted;
  }

  function moneyShort(value) {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
  }

  function account() {
    return activeAccountId === null ? null : db.accounts[activeAccountId];
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  }

  function fullDate(date = new Date()) {
    return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  function shortDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
  }

  function recordMovement(accountId, type, amount, description, direction = null) {
    const item = {
      id: createId(),
      type,
      amount: roundMoney(amount),
      description,
      direction,
      date: new Date().toISOString()
    };
    db.accounts[accountId].history.unshift(item);
    return item;
  }

  function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function roundMoney(value) {
    return Math.round(Number(value) || 0);
  }
