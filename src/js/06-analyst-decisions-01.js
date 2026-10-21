  function renderReviewerLimitIncreaseRequests() {
    if (!reviewerSession || !reviewerLimitRequestsList) return;
    const requests = Array.isArray(db.limitIncreaseRequests) ? db.limitIncreaseRequests.slice().sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
    reviewerLimitRequestsList.replaceChildren();
    const empty = $('#reviewerLimitRequestsEmpty');
    if (empty) empty.hidden = requests.length > 0;
    reviewerLimitRequestsList.hidden = requests.length === 0;
    requests.forEach((request) => {
      const card = document.createElement('article');
      card.className = 'reviewer-application-card';
      const heading = document.createElement('div');
      heading.className = 'reviewer-card-heading';
      const applicant = document.createElement('div');
      applicant.className = 'reviewer-applicant';
      const name = document.createElement('h3');
      name.textContent = request.applicantName || db.accounts[request.accountId]?.name || 'Cliente';
      const accountLine = document.createElement('p');
      accountLine.textContent = `Cuenta •••• ${(request.accountNumber || db.accounts[request.accountId]?.accountNumber || '').replace(/\s/g, '').slice(-4)} · Solicitud ${String(request.id).slice(-7)}`;
      applicant.append(name, accountLine);
      const status = document.createElement('span');
      status.className = `credit-status ${statusClass(request.status || 'En revisión')}`;
      status.textContent = request.status || 'En revisión';
      heading.append(applicant, status);
      const details = document.createElement('div');
      details.className = 'reviewer-detail-grid';
      [[ 'Cupo actual', money(request.previousLimit) ], [ 'Cupo solicitado', money(request.requestedLimit) ], [ 'Aumento solicitado', money(Math.max(0, request.requestedLimit - request.previousLimit)) ], [ 'Fecha', shortDateTime(request.date) ]].forEach(([label, value]) => {
        const cell = document.createElement('div'); cell.className = 'reviewer-detail-cell';
        const caption = document.createElement('span'); caption.textContent = label;
        const content = document.createElement('strong'); content.textContent = value;
        cell.append(caption, content); details.append(cell);
      });
      card.append(heading, details);
      if (request.reviewerNote) { const note = document.createElement('p'); note.className='reviewer-existing-note'; note.textContent=`Nota del analista: ${request.reviewerNote}`; card.append(note); }
      if ((request.status || 'En revisión') === 'En revisión') {
        const actions = document.createElement('div'); actions.className = 'reviewer-card-actions';
        const approve = document.createElement('button'); approve.type='button'; approve.className='button button-primary reviewer-approve-button'; approve.dataset.limitRequestId=request.id; approve.dataset.limitRequestDecision='Aprobado'; approve.textContent='Aprobar aumento';
        const reject = document.createElement('button'); reject.type='button'; reject.className='button button-secondary reviewer-reject-button'; reject.dataset.limitRequestId=request.id; reject.dataset.limitRequestDecision='Rechazado'; reject.textContent='Rechazar solicitud';
        actions.append(approve, reject); card.append(actions);
      }
      reviewerLimitRequestsList.append(card);
    });
  }
