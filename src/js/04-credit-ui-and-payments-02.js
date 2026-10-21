  function renderLoans() {
    const current = account();
    const container = $('#loansList');
    if (!current || !container) return;
    container.replaceChildren();
    const loans = (db.loans || []).filter((loan) => loan.accountId === activeAccountId).sort((a, b) => new Date(b.disbursedAt) - new Date(a.disbursedAt));
    $('#emptyLoans').hidden = loans.length > 0;
    container.hidden = loans.length === 0;

    loans.forEach((loan) => {
      const card = document.createElement('article');
      card.className = `loan-card${loan.status === 'Pagado' ? ' loan-paid' : ''}`;
      const header = document.createElement('div');
      header.className = 'loan-card-header';
      const titleWrap = document.createElement('div');
      const eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = `CRÉDITO · ${String(loan.id).slice(-7).toUpperCase()}`;
      const title = document.createElement('h3');
      title.textContent = loan.status === 'Pagado' ? 'Crédito finalizado' : 'Crédito activo';
      titleWrap.append(eyebrow, title);
      const status = document.createElement('span');
      status.className = `credit-status ${statusClass(loan.status === 'Pagado' ? 'Pagado' : 'Desembolsado')}`;
      status.textContent = loan.status;
      header.append(titleWrap, status);
      card.append(header);

      const stats = document.createElement('div');
      stats.className = 'loan-stats-grid';
      const next = nextInstallmentFor(loan);
      const remainingMonths = loan.status === 'Pagado' ? 0 : estimateRemainingInstallments(loan);
      const originalDisbursed = Number.isFinite(loan.originalDisbursedTotal)
        ? loan.originalDisbursedTotal
        : (loan.source === 'Avance de capital recuperado' ? 0 : Number(loan.principalOriginal) || 0);
      const reusedCapital = Math.max(0, Number(loan.reborrowedCapitalTotal) || (loan.source === 'Avance de capital recuperado' ? Number(loan.principalOriginal) || 0 : 0));
      const statItems = [
        [originalDisbursed > 0 ? 'Desembolsos originales acumulados' : 'Capital reutilizado', money(originalDisbursed > 0 ? originalDisbursed : reusedCapital)],
        ['Capital añadido por avances', money(reusedCapital)],
        ['Capital pendiente', money(loan.outstandingPrincipal)],
        ['Cuota mensual actual', loan.status === 'Pagado' ? '—' : money(loan.monthlyPayment)],
        ['Cuota siguiente', loan.status === 'Pagado' ? '—' : money(next.paymentAmount)],
        ['Interés de la cuota', loan.status === 'Pagado' ? '—' : money(next.interest)],
        ['Tasa mensual', `${(loan.monthlyRate * 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`],
        ['Cuotas pagadas', `${loan.installmentsPaid} de ${loan.termMonths}`],
        ['Plazo restante estimado', `${remainingMonths} meses`],
        [loan.status === 'Pagado' ? 'Fecha de cierre' : 'Próximo vencimiento', loan.status === 'Pagado' ? shortDateTime(loan.closedAt || new Date().toISOString()) : loan.nextDueDate]
      ];
      statItems.forEach(([label, value]) => {
        const cell = document.createElement('div');
        cell.className = 'loan-stat-cell';
        const caption = document.createElement('span');
        caption.textContent = label;
        const content = document.createElement('strong');
        content.textContent = value;
        cell.append(caption, content);
        stats.append(cell);
      });
      card.append(stats);

      if (loan.status === 'Activo') {
        const breakdown = document.createElement('p');
        breakdown.className = 'loan-breakdown-note';
        breakdown.textContent = `La próxima cuota de ${money(next.paymentAmount)} se distribuye en ${money(next.interest)} de interés y ${money(next.principal)} de capital. El pago se descuenta del saldo disponible de tu cuenta de ahorros.`;
        card.append(breakdown);
        const actions = document.createElement('div');
        actions.className = 'loan-actions';
        const payButton = document.createElement('button');
        payButton.type = 'button';
        payButton.className = 'button button-primary';
        payButton.dataset.loanPay = loan.id;
        payButton.textContent = `Pagar cuota · ${money(next.paymentAmount)}`;
        actions.append(payButton);

        const extraForm = document.createElement('form');
        extraForm.className = 'loan-extra-form';
        extraForm.dataset.loanAbonoForm = loan.id;
        const label = document.createElement('label');
        label.htmlFor = `abono-${loan.id}`;
        label.textContent = 'Abono extraordinario a capital';
        const inputWrap = document.createElement('div');
        inputWrap.className = 'loan-extra-input-wrap';
        const input = document.createElement('input');
        input.id = `abono-${loan.id}`;
        input.name = 'abonoAmount';
        input.type = 'number';
        input.inputMode = 'numeric';
        input.min = '1';
        input.max = String(Math.min(loan.outstandingPrincipal, current.balance));
        input.step = '1';
        input.placeholder = 'Monto del abono';
        input.required = true;
        const abonoButton = document.createElement('button');
        abonoButton.className = 'button button-secondary';
        abonoButton.type = 'submit';
        abonoButton.textContent = 'Abonar';
        inputWrap.append(input, abonoButton);
        const hint = document.createElement('small');
        hint.textContent = `Máximo por fondos disponibles: ${money(current.balance)}. Los abonos reducen capital y acortan el plazo estimado, manteniendo la cuota pactada.`;
        extraForm.append(label, inputWrap, hint);
        actions.append(extraForm);
        card.append(actions);
      }

      container.append(card);
    });
  }
