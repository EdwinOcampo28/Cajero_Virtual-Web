  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    login(Number(accountSelect.value), pinInput.value.trim());
  });

  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
    pinInput.setAttribute('aria-invalid', 'false');
    loginError.hidden = true;
  });

  togglePin.addEventListener('click', () => {
    const revealing = pinInput.type === 'password';
    pinInput.type = revealing ? 'text' : 'password';
    togglePin.textContent = revealing ? 'Ocultar' : 'Ver';
    togglePin.setAttribute('aria-label', revealing ? 'Ocultar PIN' : 'Mostrar PIN');
    pinInput.focus();
  });

  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  document.querySelectorAll('[data-go-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.goView)));
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.action)));
  $('#profileButton').addEventListener('click', async () => {
    const confirmed = await showAppDialog({
      type: 'confirm',
      title: 'Cerrar sesión',
      message: '¿Deseas salir de tu cuenta de ahorros? Puedes volver a ingresar con tu número de cuenta y PIN.',
      eyebrow: 'SESIÓN DE CLIENTE',
      icon: '↗',
      confirmText: 'Cerrar sesión'
    });
    if (confirmed) logout();
  });
  $('#mobileMenuButton').addEventListener('click', () => sidebar.classList.toggle('open'));
  document.querySelectorAll('[data-reset-data]').forEach((button) => button.addEventListener('click', resetDemoData));
