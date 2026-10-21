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
    const applications = (db.creditApplications || []).filter((item) => item.accountId === activeAccountId);
    $('#emptyCreditApplications').hidden = applications.length > 0;
    container.hidden = applications.length === 0;
    applications.forEach((item) => {
      const loan = findLoanForApplication(item.id);
      const card = document.createElement('article');
      card.className = 'credit-application-item';
      const main = document.createElement('div');
      main.className = 'credit-application-main';
      const title = document.createElement('strong');
      title.textContent = money(item.amount);
      const meta = document.createElement('span');
      meta.textContent = `${item.purpose} · ${loan ? `${loan.termMonths - loan.installmentsPaid} meses restantes` : `${item.termMonths} meses`} · ${loan ? 'Cuota vigente de la deuda' : 'Cuota estimada'} ${money(loan ? loan.monthlyPayment : item.monthlyPayment)}`;
      const date = document.createElement('small');
      date.textContent = `Solicitada el ${shortDateTime(item.date)}`;
      main.append(title, meta, date);
      const status = document.createElement('span');
      status.className = `credit-status ${statusClass(loan && loan.status === 'Pagado' ? 'Pagado' : (item.status || 'En revisión'))}`;
      status.textContent = loan ? (loan.status === 'Pagado' ? 'Crédito pagado' : 'Desembolsado') : (item.status || 'En revisión');
      const copy = document.createElement('div');
      copy.className = 'credit-application-status';
      copy.append(status);
      if (item.reviewedAt || item.disbursedAt) {
        const reviewDate = document.createElement('small');
        reviewDate.className = 'credit-review-date';
        reviewDate.textContent = item.disbursedAt ? `Desembolsado el ${shortDateTime(item.disbursedAt)}` : `Revisada el ${shortDateTime(item.reviewedAt)}`;
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
      if (item.reviewerNote) {
        const note = document.createElement('p');
        note.className = 'credit-review-note';
        note.textContent = `Nota del analista: ${item.reviewerNote}`;
        card.append(note);
      }
      container.append(card);
    });
  }
