  function showToast(message, kind = 'success') {
    const toast = $('#toast');
    $('#toastMessage').textContent = message;
    $('#toastIcon').textContent = kind === 'error' ? '!' : '✓';
    toast.classList.toggle('error', kind === 'error');
    toast.hidden = false;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3800);
  }

  function capitalize(text) {
    return text.charAt(0).toLocaleUpperCase('es-CO') + text.slice(1);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
