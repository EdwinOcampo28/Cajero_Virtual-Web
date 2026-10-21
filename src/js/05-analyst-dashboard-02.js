  function renderReviewerApplications() {
    if (!reviewerSession || !reviewerApplicationsList) return;
    const allApplications = Array.isArray(db.creditApplications) ? db.creditApplications : [];
    const filter = reviewerFilter.value;
    const applications = allApplications.filter((item) => {
      const status = item.status || 'En revisión';
      if (filter === 'pending') return status === 'En revisión';
      if (filter === 'approved') return ['Aprobado', 'Desembolsado', 'Pagado'].includes(status);
      if (filter === 'rejected') return status === 'Rechazado';
      return true;
    });
    reviewerApplicationsList.replaceChildren();
    $('#reviewerEmptyState').hidden = applications.length > 0;
    reviewerApplicationsList.hidden = applications.length === 0;

    applications.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'reviewer-application-card';
      const heading = document.createElement('div');
      heading.className = 'reviewer-card-heading';
      const applicant = document.createElement('div');
      applicant.className = 'reviewer-applicant';
      const name = document.createElement('h3');
      name.textContent = item.applicantName || db.accounts[item.accountId]?.name || 'Cliente';
      const accountLine = document.createElement('p');
      accountLine.textContent = `Cuenta •••• ${(item.accountNumber || db.accounts[item.accountId]?.accountNumber || '').replace(/\s/g, '').slice(-4)} · Solicitud ${String(item.id).slice(-7)}`;
      const requested = document.createElement('strong');
      requested.className = 'reviewer-requested-amount';
      requested.textContent = money(item.amount);
      applicant.append(name, accountLine);
      const status = document.createElement('span');
      status.className = `credit-status ${statusClass(item.status || 'En revisión')}`;
      status.textContent = item.status || 'En revisión';
      heading.append(applicant, requested, status);

      const details = document.createElement('div');
      details.className = 'reviewer-detail-grid';
      const relatedLoan = findLoanForApplication(item.id);
      const detailRows = [
        ['Ingresos mensuales declarados', money(item.monthlyIncome || 0)],
        ['Cuota estimada', money(item.monthlyPayment || 0)],
        ['Plazo', `${item.termMonths || 0} meses`],
        ['Tasa mensual de la solicitud', `${((Number(item.monthlyRate) || ILLUSTRATIVE_MONTHLY_RATE) * 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`],
        ['Situación laboral', item.employment || 'No indicada'],
        ['Destino', item.purpose || 'No indicado'],
        ['Total estimado', money(item.totalPayable || 0)],
        ['Fecha de solicitud', shortDateTime(item.date)],
        ...(relatedLoan ? [['Capital pendiente', money(relatedLoan.outstandingPrincipal)], ['Estado del crédito', relatedLoan.status], ['Cuotas pagadas', `${relatedLoan.installmentsPaid} de ${relatedLoan.termMonths}`]] : [])
      ];
      detailRows.forEach(([label, value]) => {
        const cell = document.createElement('div');
        cell.className = 'reviewer-detail-cell';
        const caption = document.createElement('span');
        caption.textContent = label;
        const content = document.createElement('strong');
        content.textContent = value;
        cell.append(caption, content);
        details.append(cell);
      });

      card.append(heading, details);
      if (item.reviewedAt) {
        const reviewed = document.createElement('p');
        reviewed.className = 'reviewer-decision-meta';
        reviewed.textContent = `Decisión registrada el ${shortDateTime(item.reviewedAt)} por ${item.reviewerName || REVIEWER_NAME}.`;
        card.append(reviewed);
      }
      if (item.reviewerNote) {
        const note = document.createElement('p');
        note.className = 'reviewer-existing-note';
        note.textContent = `Nota del analista: ${item.reviewerNote}`;
        card.append(note);
      }
      const normalizedStatus = item.status || 'En revisión';
      if (normalizedStatus === 'En revisión' || (normalizedStatus === 'Aprobado' && !relatedLoan)) {
        const actions = document.createElement('div');
        actions.className = 'reviewer-card-actions';
        const approve = document.createElement('button');
        approve.type = 'button';
        approve.className = 'button button-primary reviewer-approve-button';
        approve.dataset.reviewId = item.id;
        approve.dataset.reviewDecision = normalizedStatus === 'Aprobado' ? 'Desembolsar' : 'Aprobado';
        approve.textContent = normalizedStatus === 'Aprobado' ? 'Desembolsar crédito' : 'Aprobar y desembolsar';
        actions.append(approve);
        if (normalizedStatus === 'En revisión') {
          const reject = document.createElement('button');
          reject.type = 'button';
          reject.className = 'button button-secondary reviewer-reject-button';
          reject.dataset.reviewId = item.id;
          reject.dataset.reviewDecision = 'Rechazado';
          reject.textContent = 'Rechazar solicitud';
          actions.append(reject);
        }
        card.append(actions);
      }
      reviewerApplicationsList.append(card);
    });
  }
