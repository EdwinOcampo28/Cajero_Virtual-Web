  document.addEventListener('keydown', (event) => {
    if (!appDialogOverlay.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishAppDialog(false);
      } else if (event.key === 'Tab') {
        const focusable = Array.from(appDialogCard.querySelectorAll('button:not([hidden]), textarea:not([hidden])'))
          .filter((element) => !element.disabled && element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (event.key === 'Escape') {
      if (!modalOverlay.hidden) closeModal();
      sidebar.classList.remove('open');
    }
  });

  // Keep each account's daily withdrawal counter aligned with the local calendar.
  for (let id = 1; id <= 3; id += 1) resetDailyWithdrawalIfNeeded(db.accounts[id]);
  saveDatabase();
