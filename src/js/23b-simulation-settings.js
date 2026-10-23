  const SIMULATION_INTERVAL_CONTROLS = [
    { key: 'creditRequestIntervalSeconds', input: '#simulationCreditRequestIntervalInput', unit: '#simulationCreditRequestIntervalUnit', label: 'solicitudes de crédito' },
    { key: 'automaticCreditApprovalDelaySeconds', input: '#simulationCreditApprovalDelayInput', unit: '#simulationCreditApprovalDelayUnit', label: 'aprobación automática de créditos' },
    { key: 'limitIncreaseRequestIntervalSeconds', input: '#simulationLimitIncreaseRequestIntervalInput', unit: '#simulationLimitIncreaseRequestIntervalUnit', label: 'solicitudes de aumento de cupo' },
    { key: 'automaticLimitIncreaseApprovalDelaySeconds', input: '#simulationLimitIncreaseApprovalDelayInput', unit: '#simulationLimitIncreaseApprovalDelayUnit', label: 'aprobación automática de aumentos de cupo' },
    { key: 'paymentInterval6Seconds', input: '#simulationPayment6IntervalInput', unit: '#simulationPayment6IntervalUnit', label: 'cuotas de créditos a 6 plazos' },
    { key: 'paymentInterval12Seconds', input: '#simulationPayment12IntervalInput', unit: '#simulationPayment12IntervalUnit', label: 'cuotas de créditos a 12 plazos' },
    { key: 'treasuryDistributionIntervalSeconds', input: '#simulationTreasuryDistributionIntervalInput', unit: '#simulationTreasuryDistributionIntervalUnit', label: 'repartos de Tesorería' },
    { key: 'automaticTransferIntervalSeconds', input: '#simulationAutomaticTransferIntervalInput', unit: '#simulationAutomaticTransferIntervalUnit', label: 'transferencias automáticas' },
    { key: 'automaticWithdrawalIntervalSeconds', input: '#simulationAutomaticWithdrawalIntervalInput', unit: '#simulationAutomaticWithdrawalIntervalUnit', label: 'retiros automáticos' }
  ];
  const SIMULATION_MAX_INTERVAL_SECONDS = 31536000;

  function updateSimulationIntervalInputLimit(control) {
    const input = $(control.input);
    const unit = $(control.unit);
    if (!input || !unit) return;
    const factor = unit.value === 'minutes' ? 60 : 1;
    input.min = String(1 / factor);
    input.max = String(SIMULATION_MAX_INTERVAL_SECONDS / factor);
    input.step = 'any';
  }

  function renderSimulationIntervalControl(control, seconds) {
    const input = $(control.input);
    const unit = $(control.unit);
    const displayMinutes = seconds % 60 === 0;
    if (unit) {
      unit.value = displayMinutes ? 'minutes' : 'seconds';
      unit.dataset.previousUnit = unit.value;
    }
    if (input) input.value = String(displayMinutes ? seconds / 60 : seconds);
    updateSimulationIntervalInputLimit(control);
  }

  function convertSimulationIntervalUnit(control) {
    const input = $(control.input);
    const unit = $(control.unit);
    if (!input || !unit) return;
    const oldUnit = unit.dataset.previousUnit || unit.value;
    const newUnit = unit.value;
    const oldFactor = oldUnit === 'minutes' ? 60 : 1;
    const newFactor = newUnit === 'minutes' ? 60 : 1;
    const currentValue = Number(input.value);
    if (Number.isFinite(currentValue)) input.value = String(currentValue * oldFactor / newFactor);
    unit.dataset.previousUnit = newUnit;
    updateSimulationIntervalInputLimit(control);
  }

  function renderSimulationSettingsPanel() {
    const form = $('#simulationSettingsForm');
    if (!form || !db) return;
    const paused = db.simulationAutomation?.paused === true;
    const pauseButton = $('#toggleSimulationAutomationButton');
    const pauseState = $('#simulationAutomationState');
    if (pauseButton) {
      pauseButton.textContent = paused ? 'Reanudar automatización' : 'Pausar automatización';
      pauseButton.setAttribute('aria-pressed', String(paused));
      pauseButton.classList.toggle('button-secondary', paused);
      pauseButton.classList.toggle('button-primary', !paused);
    }
    if (pauseState) {
      pauseState.textContent = paused ? 'Automatización pausada' : 'Automatización activa';
      pauseState.dataset.paused = String(paused);
    }
    if (form.dataset.dirty === 'true' || form.contains(document.activeElement)) return;
    const settings = simulationSettingsFor(db);
    $('#simulationMonthlyRateInput').value = String(settings.monthlyInterestRate * 100);
    $('#simulationTreasuryRateInput').value = String(settings.treasuryTimerRate);

    SIMULATION_INTERVAL_CONTROLS.forEach((control) => renderSimulationIntervalControl(control, settings[control.key]));
    $('#simulationCreditMinimumInput').value = String(settings.automaticCreditMinimumAmount);
    $('#simulationCreditMaximumInput').value = String(settings.automaticCreditMaximumAmount);
    $('#simulationAdvanceMinimumInput').value = String(settings.automaticAdvanceMinimumAmount);
    $('#simulationAdvanceMaximumInput').value = String(settings.automaticAdvanceMaximumAmount);
    $('#simulationAdvanceModeSelect').value = settings.automaticAdvanceMode;
    updateSimulationAdvanceAmountFields();
    $('#simulationCreditTermSelect').value = String(settings.automaticCreditTermMonths);
    $('#simulationLimitIncreaseApprovalSelect').value = String(settings.automaticLimitIncreaseApprovalEnabled);
  }

  function markSimulationSettingsDirty() {
    const form = $('#simulationSettingsForm');
    if (form) form.dataset.dirty = 'true';
  }

  function updateSimulationAdvanceAmountFields() {
    const useRange = $('#simulationAdvanceModeSelect')?.value === 'range';
    ['#simulationAdvanceMinimumInput', '#simulationAdvanceMaximumInput'].forEach((selector) => {
      const input = $(selector);
      if (input) input.disabled = !useRange;
    });
  }

  function saveSimulationSettings(event) {
    event.preventDefault();
    if (!reviewerSession || !db) return;
    const status = $('#simulationSettingsStatus');
    const values = {
      monthlyInterestRate: Number($('#simulationMonthlyRateInput').value) / 100,
      treasuryTimerIncomeCap: Number.MAX_SAFE_INTEGER,
      treasuryTimerRate: Number($('#simulationTreasuryRateInput').value),
      automaticLimitIncreaseApprovalEnabled: $('#simulationLimitIncreaseApprovalSelect').value === 'true',

      automaticCreditMinimumAmount: Number($('#simulationCreditMinimumInput').value),
      automaticCreditMaximumAmount: Number($('#simulationCreditMaximumInput').value),
      automaticAdvanceMinimumAmount: Number($('#simulationAdvanceMinimumInput').value),
      automaticAdvanceMaximumAmount: Number($('#simulationAdvanceMaximumInput').value),
      automaticAdvanceMode: $('#simulationAdvanceModeSelect').value,
      automaticCreditTermMonths: Number($('#simulationCreditTermSelect').value)
    };
    const fail = (message, selector) => {
      status.textContent = message;
      status.classList.add('error-message');
      $(selector).focus();
    };
    status.classList.remove('error-message');
    if (!Number.isFinite(values.monthlyInterestRate) || values.monthlyInterestRate < 0 || values.monthlyInterestRate > 1) {
      fail('La tasa debe estar entre 0 % y 100 % mensual.', '#simulationMonthlyRateInput');
      return;
    }
    if (!['true', 'false'].includes($('#simulationLimitIncreaseApprovalSelect').value)) {
      fail('Selecciona si los aumentos de cupo se aprueban automáticamente o quedan para revisión.', '#simulationLimitIncreaseApprovalSelect');
      return;
    }
    if (!Number.isSafeInteger(values.treasuryTimerRate) || values.treasuryTimerRate < 1) {
      fail('El cronómetro debe sumar al menos $1 entero por segundo.', '#simulationTreasuryRateInput');
      return;
    }
    for (const control of SIMULATION_INTERVAL_CONTROLS) {
      const rawValue = Number($(control.input).value);
      const multiplier = $(control.unit).value === 'minutes' ? 60 : 1;
      const seconds = Math.round(rawValue * multiplier);
      if (!Number.isFinite(rawValue) || rawValue <= 0 || !Number.isSafeInteger(seconds) || seconds < 1 || seconds > SIMULATION_MAX_INTERVAL_SECONDS) {
        fail('El intervalo de ' + control.label + ' debe ser de 1 segundo a 1 año.', control.input);
        return;
      }
      values[control.key] = seconds;
    }
    const amountFields = [
      ['automaticCreditMinimumAmount', '#simulationCreditMinimumInput', 'monto mínimo del crédito'],
      ['automaticCreditMaximumAmount', '#simulationCreditMaximumInput', 'monto máximo del crédito'],
      ['automaticAdvanceMinimumAmount', '#simulationAdvanceMinimumInput', 'monto mínimo del avance'],
      ['automaticAdvanceMaximumAmount', '#simulationAdvanceMaximumInput', 'monto máximo del avance']
    ];
    for (const [key, selector, label] of amountFields) {
      const amount = values[key];
      if (!Number.isSafeInteger(amount) || amount < MIN_CREDIT_AMOUNT || amount > MAX_CREDIT_AMOUNT || amount % MIN_CREDIT_AMOUNT !== 0) {
        fail('El ' + label + ' debe estar entre $100.000 y $100.000.000, en incrementos de $100.000.', selector);
        return;
      }
    }
    if (values.automaticCreditMinimumAmount > values.automaticCreditMaximumAmount) {
      fail('El monto mínimo del crédito no puede superar el máximo.', '#simulationCreditMinimumInput');
      return;
    }
    if (values.automaticAdvanceMinimumAmount > values.automaticAdvanceMaximumAmount) {
      fail('El monto mínimo del avance no puede superar el máximo.', '#simulationAdvanceMinimumInput');
      return;
    }
    if (!['credit_amount', 'range'].includes(values.automaticAdvanceMode)) {
      fail('Elige avance completo o un rango personalizado.', '#simulationAdvanceModeSelect');
      return;
    }
    if (values.automaticAdvanceMinimumAmount > values.automaticCreditMinimumAmount
      || values.automaticAdvanceMaximumAmount > values.automaticCreditMaximumAmount) {
      fail('Los montos de avance deben quedar dentro del rango de los créditos.', '#simulationAdvanceMinimumInput');
      return;
    }
    if (![0, ...VALID_CREDIT_TERMS].includes(values.automaticCreditTermMonths)) {
      fail('Elige un plazo aleatorio, 6 cuotas o 12 cuotas.', '#simulationCreditTermSelect');
      return;
    }
    const transactionRevision = captureDatabaseRevision();
    if (!isDatabaseRevisionCurrent(transactionRevision)) {
      abortStaleFinancialOperation();
      return;
    }
    if (typeof catchUpAutomaticEventsBeforeOperation === 'function' && !catchUpAutomaticEventsBeforeOperation()) return;
    accrueWithdrawalTreasury(db);
    const updatedAtMs = Date.now();
    const updatedAt = new Date(updatedAtMs).toISOString();
    db.simulationSettings = { ...simulationSettingsFor(db), ...values };
    db.simulationAutomation.nextCreditRequestAt = new Date(updatedAtMs + values.creditRequestIntervalSeconds * 1000).toISOString();
    db.simulationAutomation.nextLimitIncreaseRequestAt = new Date(updatedAtMs + values.limitIncreaseRequestIntervalSeconds * 1000).toISOString();
    db.simulationAutomation.nextTreasuryDistributionAt = new Date(updatedAtMs + values.treasuryDistributionIntervalSeconds * 1000).toISOString();
    db.simulationAutomation.nextAutomaticTransferAt = new Date(updatedAtMs + values.automaticTransferIntervalSeconds * 1000).toISOString();
    db.simulationAutomation.nextAutomaticWithdrawalAt = new Date(updatedAtMs + values.automaticWithdrawalIntervalSeconds * 1000).toISOString();
    (Array.isArray(db.limitIncreaseRequests) ? db.limitIncreaseRequests : []).forEach((request) => {
      if ((request.status || 'En revisión') !== 'En revisión') return;
      if (values.automaticLimitIncreaseApprovalEnabled) request.autoApprovalAt = new Date(updatedAtMs + values.automaticLimitIncreaseApprovalDelaySeconds * 1000).toISOString();
      else request.autoApprovalAt = null;
    });
    (Array.isArray(db.creditApplications) ? db.creditApplications : []).forEach((application) => {
      if (application?.automaticSimulation !== true || (application.status || 'En revisión') !== 'En revisión') return;
      application.autoApprovalAt = new Date(updatedAtMs + values.automaticCreditApprovalDelaySeconds * 1000).toISOString();
    });
    for (const loan of (Array.isArray(db.loans) ? db.loans : [])) {
      if (loan?.status !== 'Activo' || Number(loan.outstandingPrincipal) <= 0) continue;
      loan.automaticPaymentIntervalSeconds = automaticPaymentIntervalForTerm(loan.termMonths);
      loan.nextAutomaticPaymentAt = new Date(updatedAtMs + loan.automaticPaymentIntervalSeconds * 1000).toISOString();
    }
    db.withdrawalTreasury.lastAccruedAt = updatedAt;
    recordAuditEvent('Configuración de simulación actualizada', {
      category: 'sistema', source: 'Analista',
      description: 'Se actualizaron intervalos, montos, plazos y valores del cronómetro.',
      details: { ...values }
    });
    if (!saveDatabase()) {
      renderSimulationSettingsPanel();
      return;
    }
    $('#simulationSettingsForm').dataset.dirty = 'false';
    renderSimulationSettingsPanel();
    if (typeof renderFinancialAuditPanel === 'function') renderFinancialAuditPanel();
    if (typeof renderMonthlyFinancialReport === 'function') renderMonthlyFinancialReport();
    status.textContent = 'Configuración guardada. Los próximos eventos y pagos ya usan estos valores.';
    showToast('Configuración de simulación actualizada.');
  }

  SIMULATION_INTERVAL_CONTROLS.forEach((control) => {
    $(control.input)?.addEventListener('input', markSimulationSettingsDirty);
    $(control.unit)?.addEventListener('change', () => {
      convertSimulationIntervalUnit(control);
      markSimulationSettingsDirty();
    });
  });
  $('#simulationSettingsForm')?.addEventListener('input', markSimulationSettingsDirty);
  $('#simulationSettingsForm')?.addEventListener('change', markSimulationSettingsDirty);
  $('#simulationAdvanceModeSelect')?.addEventListener('change', updateSimulationAdvanceAmountFields);
  $('#simulationSettingsForm')?.addEventListener('submit', saveSimulationSettings);
