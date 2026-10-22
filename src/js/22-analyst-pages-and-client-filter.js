  // Navegación por secciones y filtro global por cliente del panel del analista.
  function populateReviewerClientFilter() {
    const filter = $('#reviewerClientFilter');
    if (!filter || !Array.isArray(db?.accounts)) return;
    const previouslySelected = filter.value || 'all';
    const options = [new Option('Todos los clientes', 'all')];
    db.accounts.slice(1).filter(Boolean).forEach((account) => {
      options.push(new Option(`${account.name} · ${String(account.accountNumber || '').replace(/\s/g, '').slice(-4)}`, String(account.id)));
    });
    filter.replaceChildren(...options);
    filter.value = options.some((option) => option.value === previouslySelected) ? previouslySelected : 'all';
  }

  function setReviewerActivePage(pageName) {
    if (!reviewerSession || !reviewerView) return;
    const pages = reviewerView.querySelectorAll('[data-reviewer-page]');
    const tabs = reviewerView.querySelectorAll('[data-reviewer-tab]');
    const knownPage = Array.from(pages).some((page) => page.dataset.reviewerPage === pageName);
    const target = knownPage ? pageName : 'overview';
    pages.forEach((page) => {
      const active = page.dataset.reviewerPage === target;
      page.hidden = !active;
      page.classList.toggle('is-active', active);
    });
    tabs.forEach((tab) => {
      const active = tab.dataset.reviewerTab === target;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    if (target === 'tools') {
      if (typeof renderFinancialAuditPanel === 'function') renderFinancialAuditPanel();
      if (typeof renderMonthlyFinancialReport === 'function') renderMonthlyFinancialReport();
    }
    if (target === 'events' && typeof renderAuditLog === 'function') renderAuditLog();
  }

  function setReviewerRequestTab(tabName) {
    if (!reviewerView) return;
    const panels = reviewerView.querySelectorAll('[data-reviewer-request-panel]');
    const tabs = reviewerView.querySelectorAll('[data-reviewer-request-tab]');
    const knownTab = Array.from(panels).some((panel) => panel.dataset.reviewerRequestPanel === tabName);
    const target = knownTab ? tabName : 'credits';
    panels.forEach((panel) => {
      const active = panel.dataset.reviewerRequestPanel === target;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    tabs.forEach((tab) => {
      const active = tab.dataset.reviewerRequestTab === target;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
  }

  const reviewerModuleNav = reviewerView?.querySelector('.reviewer-module-nav');
  if (reviewerModuleNav) {
    reviewerModuleNav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-reviewer-tab]');
      if (!button) return;
      setReviewerActivePage(button.dataset.reviewerTab);
    });
  }

  const reviewerRequestNav = reviewerView?.querySelector('.reviewer-request-nav');
  if (reviewerRequestNav) {
    reviewerRequestNav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-reviewer-request-tab]');
      if (button) setReviewerRequestTab(button.dataset.reviewerRequestTab);
    });
  }

  const reviewerClientFilter = $('#reviewerClientFilter');
  populateReviewerClientFilter();
  if (reviewerClientFilter) {
    reviewerClientFilter.addEventListener('change', () => {
      if (!reviewerSession) return;
      renderReviewerDashboard();
      const activeTab = reviewerView.querySelector('[data-reviewer-tab][aria-current="page"]');
      if (activeTab?.dataset.reviewerTab === 'events' && typeof renderAuditLog === 'function') renderAuditLog();
    });
  }

  // El filtro se inicializa desde la base actual; al entrar, loginReviewer vuelve a abrir el resumen.
