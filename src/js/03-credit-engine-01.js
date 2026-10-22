  function calculateCreditEstimate(principal, months) {
    const amount = Math.round(Number(principal) || 0);
    const term = Math.max(1, Math.round(Number(months) || 1));
    if (amount <= 0) return { monthlyPayment: 0, totalPayable: 0, totalInterest: 0 };
    const rate = ILLUSTRATIVE_MONTHLY_RATE;
    const monthlyPayment = Math.round(amount * rate / (1 - Math.pow(1 + rate, -term)));
    let balance = amount;
    let totalPayable = 0;
    let totalInterest = 0;
    let count = 0;
    while (balance > 0 && count < term + 5) {
      const interest = Math.round(balance * rate);
      const isFinalPayment = count + 1 >= term;
      const payment = isFinalPayment ? balance + interest : Math.min(monthlyPayment, balance + interest);
      const principalPaid = isFinalPayment ? balance : Math.min(balance, Math.max(0, payment - interest));
      if (principalPaid <= 0) break;
      balance = Math.max(0, balance - principalPaid);
      totalPayable += payment;
      totalInterest += interest;
      count += 1;
    }
    return { monthlyPayment, totalPayable, totalInterest, actualMonths: count };
  }

  function addMonthsToDate(dateLike, months) {
    const source = typeof dateLike === 'string' ? dateLike.slice(0, 10) : localDateKey(dateLike);
    const [year, month, day] = source.split('-').map(Number);
    const base = new Date(year, month - 1, 1);
    base.setMonth(base.getMonth() + months);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(day, lastDay));
    return localDateKey(base);
  }

  function createLoanFromApplication(application) {
    const estimate = calculateCreditEstimate(application.amount, application.termMonths);
    const disbursedAt = new Date().toISOString();
    return {
      id: createId(),
      applicationId: application.id,
      accountId: application.accountId,
      principalOriginal: roundMoney(application.amount),
      originalDisbursedTotal: roundMoney(application.amount),
      reborrowedCapitalTotal: 0,
      outstandingPrincipal: roundMoney(application.amount),
      monthlyRate: Number.isFinite(application.monthlyRate) ? application.monthlyRate : ILLUSTRATIVE_MONTHLY_RATE,
      termMonths: Number(application.termMonths) || 60,
      monthlyPayment: roundMoney(estimate.monthlyPayment),
      installmentsPaid: 0,
      applicationIds: application.id ? [application.id] : [],
      nextDueDate: addMonthsToDate(disbursedAt, 1),
      disbursedAt,
      status: 'Activo',
      payments: []
    };
  }

  function nextInstallmentFor(loan) {
    const balance = Math.max(0, roundMoney(loan.outstandingPrincipal));
    if (balance <= 0) return { paymentAmount: 0, interest: 0, principal: 0, dueDate: loan.nextDueDate, installmentNumber: loan.installmentsPaid + 1 };
    const interest = Math.round(balance * loan.monthlyRate);
    const installmentNumber = Math.max(0, Number(loan.installmentsPaid) || 0) + 1;
    const isFinalInstallment = installmentNumber >= Math.max(1, Number(loan.termMonths) || 1);
    const paymentAmount = isFinalInstallment
      ? roundMoney(balance + interest)
      : Math.min(roundMoney(loan.monthlyPayment), balance + interest);
    const principal = isFinalInstallment ? balance : Math.min(balance, Math.max(0, paymentAmount - interest));
    return { paymentAmount, interest, principal, dueDate: loan.nextDueDate, installmentNumber };
  }
