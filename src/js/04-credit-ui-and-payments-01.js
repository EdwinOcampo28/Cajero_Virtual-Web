  function updateCreditSimulation() {
    if (!creditAmountInput || !creditTermSelect) return;
    const amount = Math.max(0, Math.round(Number(creditAmountInput.value) || 0));
    const months = Number(creditTermSelect.value) || 60;
    const estimate = calculateCreditEstimate(amount, months);
    $('#creditMonthlyPayment').textContent = money(estimate.monthlyPayment);
    $('#creditSelectedTerm').textContent = String(months);
    $('#creditSimAmount').textContent = money(amount);
    $('#creditTotalPayable').textContent = money(estimate.totalPayable);
    $('#creditTotalInterest').textContent = money(estimate.totalInterest);
  }

  function renderCreditApplications() {
    const current = account();
    if (!current) return;
    const container = $('#creditApplicationsList');
    container.replaceChildren();
    const applications = (db.creditApplications || []).filter((item) => item.accountId === activeAccountId
      && (item.origin !== 'Aumento de cupo' || Number(item.activatedAmount) > 0));
    $('#emptyCreditApplications').hidden = applications.length > 0;
    container.hidden = applications.length === 0;
    applications.forEach((item) => {
      const loan = findLoanForApplication(item.id);
      const card = document.createElement('article');
      card.className = 'credit-application-item';
      const main = document.createElement('div');
      main.className = 'credit-application-main';
      const title = document.createElement('strong');
      title.textContent = money(item.origin === 'Aumento de cupo' && Number(item.activatedAmount) > 0 ? item.activatedAmount : item.amount);
      const meta = document.createElement('span');
      const fundsPending = Math.max(0, Number(item.cardFundsRemaining) || 0);
      meta.textContent = `${item.purpose} · ${loan ? `${loan.termMonths - loan.installmentsPaid} meses restantes` : `${item.termMonths} meses`} · ${loan ? 'Cuota vigente de la deuda' : (fundsPending > 0 ? 'Sin cuotas hasta avanzar' : 'Cuota estimada')} ${loan ? money(loan.monthlyPayment) : (fundsPending > 0 ? '' : money(item.monthlyPayment))}`;
      const date = document.createElement('small');
      date.textContent = `Solicitada el ${shortDateTime(item.date)}`;
      main.append(title, meta, date);
      const status = document.createElement('span');
      status.className = `credit-status ${statusClass(loan && loan.status === 'Pagado' ? 'Pagado' : (item.status || 'En revisión'))}`;
      status.textContent = fundsPending > 0
        ? (Number(item.activatedAmount) > 0 ? `Avance parcial · ${money(fundsPending)} en tarjeta` : 'Fondos en tarjeta · sin crédito activo')
        : (loan ? (loan.status === 'Pagado' ? 'Crédito pagado' : 'Crédito activo') : (item.status || 'En revisión'));
      const copy = document.createElement('div');
      copy.className = 'credit-application-status';
      copy.append(status);
      if (item.reviewedAt || item.disbursedAt) {
        const reviewDate = document.createElement('small');
        reviewDate.className = 'credit-review-date';
        reviewDate.textContent = item.disbursedAt ? `Fondos cargados en tarjeta el ${shortDateTime(item.disbursedAt)}` : `Revisada el ${shortDateTime(item.reviewedAt)}`;
        copy.append(reviewDate);
      }
      card.append(main, copy);
      if (loan) {
        const loanSummary = document.createElement('p');
        loanSummary.className = 'credit-review-note';
        loanSummary.textContent = loan.status === 'Pagado'
          ? `Crédito pagado. Total registrado en abonos y cuotas: ${money((loan.payments || []).reduce((sum, item) => sum + item.amount, 0))}.`
          : `Saldo de capital pendiente: ${money(loan.outstandingPrincipal)} · Próxima cuota: ${money(nextInstallmentFor(loan).paymentAmount)} · Vencimiento: ${loan.nextDueDate}.`;
        card.append(loanSummary);
      }
      if (fundsPending > 0) {
        const pendingFunds = document.createElement('p');
        pendingFunds.className = 'credit-review-note';
        pendingFunds.textContent = `Fondos aún disponibles en la tarjeta: ${money(fundsPending)}. Ese monto no genera crédito ni cuotas hasta trasladarlo a ahorros mediante un avance.`;
        card.append(pendingFunds);
      }
      if (item.reviewerNote) {
        const note = document.createElement('p');
        note.className = 'credit-review-note';
        note.textContent = `Nota del analista: ${item.reviewerNote}`;
        card.append(note);
      }
      container.append(card);
    });
  }
