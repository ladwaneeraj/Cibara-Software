// expense.js - Add this file to your project

// Global variables for expense management
let expenseType = "transaction"; // 'transaction' or 'report'

// Initialize expense functionality
function initializeExpense() {
  // Add expense button in transactions tab
  const addExpenseBtn = document.getElementById("add-expense-btn");
  if (addExpenseBtn) {
    addExpenseBtn.addEventListener("click", () => {
      showExpenseModal("transaction");
    });
  }

  // Add report expense button in reports tab
  const addReportExpenseBtn = document.getElementById("add-report-expense-btn");
  if (addReportExpenseBtn) {
    addReportExpenseBtn.addEventListener("click", () => {
      showExpenseModal("report");
    });
  }

  // Expense form submission
  const expenseForm = document.getElementById("expense-form");
  if (expenseForm) {
    expenseForm.addEventListener("submit", submitExpense);
  }

  // Payment method selection for expense
  const expensePaymentBtns = document.querySelectorAll(
    "#expense-form .payment-btn"
  );
  expensePaymentBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      expensePaymentBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");

      const paymentMethod = this.getAttribute("data-payment");
      document.getElementById("expense-payment-method").value = paymentMethod;
    });
  });

  // Close expense modal
  const closeExpenseBtn = document.querySelector("#expense-modal .close-btn");
  if (closeExpenseBtn) {
    closeExpenseBtn.addEventListener("click", () => {
      const expenseModal = document.getElementById("expense-modal");
      if (expenseModal) {
        expenseModal.classList.remove("show");
      }
    });
  }
}

// Show expense modal with appropriate type
function showExpenseModal(type) {
  const expenseModal = document.getElementById("expense-modal");
  if (!expenseModal) {
    debugLog("Expense modal not found");
    return;
  }

  // Reset form first
  const expenseForm = document.getElementById("expense-form");
  if (expenseForm) {
    expenseForm.reset();
  }

  // Set default date to today AFTER form reset
  const expenseDateInput = document.getElementById("expense-date");
  if (expenseDateInput) {
    const today = new Date();
    // Format date as YYYY-MM-DD for the date input
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, "0");

    const formattedDate = `${year}-${month}-${day}`;
    expenseDateInput.value = formattedDate;

    console.log("Set default expense date to today:", formattedDate);
  }

  // Set payment method to cash by default
  document.querySelectorAll("#expense-form .payment-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const cashBtn = document.querySelector("#expense-form .payment-btn.cash");
  if (cashBtn) {
    cashBtn.classList.add("active");
  }

  const paymentMethodInput = document.getElementById("expense-payment-method");
  if (paymentMethodInput) {
    paymentMethodInput.value = "cash";
  }

  // Set expense type (transaction or report)
  expenseType = type;
  const expenseTypeInput = document.getElementById("expense-type");
  if (expenseTypeInput) {
    expenseTypeInput.value = type;
  }

  // Update modal title based on type
  const modalTitle = expenseModal.querySelector(".modal-header h2");
  if (modalTitle) {
    modalTitle.textContent =
      type === "transaction" ? "Add Daily Expense" : "Add Report Expense";
  }

  // Show the modal
  expenseModal.classList.add("show");
}

// Submit expense form
async function submitExpense(e) {
  e.preventDefault();

  const expenseDateInput = document.getElementById("expense-date");
  const expenseCategoryInput = document.getElementById("expense-category");
  const expenseDescriptionInput = document.getElementById(
    "expense-description"
  );
  const expenseAmountInput = document.getElementById("expense-amount");
  const expensePaymentMethodInput = document.getElementById(
    "expense-payment-method"
  );
  const expenseTypeInput = document.getElementById("expense-type");

  if (
    !expenseDateInput ||
    !expenseCategoryInput ||
    !expenseDescriptionInput ||
    !expenseAmountInput ||
    !expensePaymentMethodInput ||
    !expenseTypeInput
  ) {
    showNotification("Required form fields are missing", "error");
    return;
  }

  const date = expenseDateInput.value;
  const category = expenseCategoryInput.value;
  const description = expenseDescriptionInput.value;
  const amount = parseInt(expenseAmountInput.value);
  const paymentMethod = expensePaymentMethodInput.value;
  const type = expenseTypeInput.value;

  if (
    !date ||
    !category ||
    !description ||
    isNaN(amount) ||
    amount <= 0 ||
    !paymentMethod ||
    !type
  ) {
    showNotification("Please fill all fields with valid values", "error");
    return;
  }

  // Disable submit button and show loading state
  const submitBtn = e.target.querySelector("button[type=submit]");
  if (submitBtn) {
    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';
  }

  try {
    console.log("Submitting expense:", {
      date,
      category,
      description,
      amount,
      payment_method: paymentMethod,
      type,
    });

    const response = await fetch("/add_expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        category,
        description,
        amount,
        payment_method: paymentMethod,
        type,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Expense response:", result);

    if (result.success) {
      // Close the modal
      const expenseModal = document.getElementById("expense-modal");
      if (expenseModal) {
        expenseModal.classList.remove("show");
      }

      // Refresh data
      await fetchData();

      // If this was a report expense and we're on the reports tab, regenerate the report
      if (
        type === "report" &&
        document.getElementById("reports-tab") &&
        !document.getElementById("reports-tab").classList.contains("hidden")
      ) {
        generateReport();
      }

      showNotification(
        result.message || "Expense added successfully",
        "success"
      );
    } else {
      showNotification(result.message || "Error adding expense", "error");
    }
  } catch (error) {
    console.error("Error adding expense:", error);
    showNotification(`Error adding expense: ${error.message}`, "error");
  } finally {
    // Re-enable submit button
    const submitBtn = e.target.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Add Expense";
    }
  }
}

// Integration with existing renderLogs function
function updateRenderLogs(originalRenderLogs) {
  return function () {
    if (!transactionLog) {
      debugLog("Transaction log element not found");
      return;
    }

    // Get today's date and previous dates
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const dayBeforeYesterdayStr = dayBeforeYesterday
      .toISOString()
      .split("T")[0];

    // Filter logs for the past 2 days + today
    const recentDates = [todayStr, yesterdayStr, dayBeforeYesterdayStr];

    // Filter logs for the recent dates
    const recentCashLogs = logs.cash.filter((log) =>
      recentDates.includes(log.date)
    );
    const recentOnlineLogs = logs.online.filter((log) =>
      recentDates.includes(log.date)
    );
    const recentRefundLogs = (logs.refunds || []).filter((log) =>
      recentDates.includes(log.date)
    );

    // Add expenses to the logs
    const recentExpenseLogs = (logs.expenses || []).filter(
      (log) =>
        recentDates.includes(log.date) && log.expense_type === "transaction" // Only include transaction expenses in daily logs
    );

    // Combine and sort by date and time (most recent first)
    const allRecentLogs = [
      ...recentCashLogs,
      ...recentOnlineLogs,
      ...recentRefundLogs,
      ...recentExpenseLogs,
    ].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time || "00:00"}`);
      const dateB = new Date(`${b.date} ${b.time || "00:00"}`);
      return dateB - dateA;
    });

    // Update totals
    if (cashTotal) cashTotal.textContent = "₹" + totals.cash;
    if (onlineTotal) onlineTotal.textContent = "₹" + totals.online;
    if (refundTotal) refundTotal.textContent = "₹" + (totals.refunds || 0);

    // Update expense total
    const expenseElement = document.getElementById("today-expense");
    if (expenseElement) {
      expenseElement.textContent = "₹" + (totals.expenses || 0);
    }

    if (totalRevenue)
      totalRevenue.textContent =
        "₹" + (totals.cash + totals.online - (totals.refunds || 0));

    // Render logs
    if (allRecentLogs.length === 0) {
      transactionLog.innerHTML = `<div class="empty-state" style="padding: 2rem;">
        <i class="fas fa-receipt fa-3x"></i>
        <p>No transactions in the past 3 days</p>
      </div>`;
      return;
    }

    // Group logs by date
    const logsByDate = {};
    allRecentLogs.forEach((log) => {
      if (!logsByDate[log.date]) {
        logsByDate[log.date] = [];
      }
      logsByDate[log.date].push(log);
    });

    let logsHTML = "";

    // Format date for display
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      const options = { weekday: "long", month: "short", day: "numeric" };
      return date.toLocaleDateString("en-US", options);
    }

    // Add section for each date
    Object.keys(logsByDate)
      .sort((a, b) => new Date(b) - new Date(a)) // Sort dates in descending order
      .forEach((date) => {
        // Add date header
        let dateDisplay = formatDate(date);

        // Mark today, yesterday
        if (date === todayStr) {
          dateDisplay = "Today (" + dateDisplay + ")";
        } else if (date === yesterdayStr) {
          dateDisplay = "Yesterday (" + dateDisplay + ")";
        }

        logsHTML += `<div class="log-date-header">${dateDisplay}</div>`;

        // Add logs for this date
        logsByDate[date].forEach((log) => {
          let type = "Unknown";
          let color = "";

          if (recentCashLogs.includes(log)) {
            type = "Cash Payment";
          } else if (recentOnlineLogs.includes(log)) {
            type = "Online Payment";
          } else if (recentRefundLogs.includes(log)) {
            type = "Refund";
            color = 'style="color: var(--danger)"';
          } else if (recentExpenseLogs.includes(log)) {
            type = `Expense: ${log.category}`;
            color = 'style="color: var(--danger)"';
          }

          // Add room shift indicator if applicable
          const shiftInfo = log.room_shifted
            ? `<span class="room-shifted-badge">Shifted: ${log.old_room} → ${log.room}</span>`
            : "";

          // Format differently for expenses vs other logs
          if (recentExpenseLogs.includes(log)) {
            logsHTML += `
              <div class="log-item transaction-expense">
                <div class="log-details">
                  <div class="log-title">
                    ${log.description}
                    <span class="expense-category-badge">${log.category}</span>
                  </div>
                  <div class="log-subtitle">${type} (${
              log.payment_method
            }) at ${log.time || "N/A"}</div>
                </div>
                <div class="log-amount" ${color}>₹${log.amount}</div>
              </div>
            `;
          } else {
            logsHTML += `
              <div class="log-item">
                <div class="log-details">
                  <div class="log-title">Room ${log.room} - ${
              log.name
            }${shiftInfo}</div>
                  <div class="log-subtitle">${type} at ${
              log.time || "N/A"
            }</div>
                </div>
                <div class="log-amount" ${color}>₹${log.amount}</div>
              </div>
            `;
          }
        });
      });

    transactionLog.innerHTML = logsHTML;
  };
}

// Update stats to include expenses
function updateStatsWithExpenses(originalUpdateStats) {
  return function () {
    // Call the original updateStats function first
    originalUpdateStats();

    // Add expense calculations
    const today = new Date().toISOString().split("T")[0];

    // Get today's expenses (transaction type only)
    const todayExpenseLogs = (logs.expenses || []).filter(
      (log) => log.date === today && log.expense_type === "transaction"
    );

    // Calculate expenses by payment method
    const todayCashExpenses = todayExpenseLogs
      .filter((log) => log.payment_method === "cash")
      .reduce((sum, log) => sum + log.amount, 0);

    const todayOnlineExpenses = todayExpenseLogs
      .filter((log) => log.payment_method === "online")
      .reduce((sum, log) => sum + log.amount, 0);

    // Total expenses for display
    const todayTotalExpenses = todayCashExpenses + todayOnlineExpenses;

    // Update expense display
    const todayExpenseElement = document.getElementById("today-expense");
    if (todayExpenseElement) {
      todayExpenseElement.textContent = "₹" + todayTotalExpenses;
    }

    // Re-calculate net cash and online totals after expenses
    const todayCashElement = document.getElementById("today-cash");
    const todayOnlineElement = document.getElementById("today-online");

    if (todayCashElement) {
      const currentCash =
        parseInt(todayCashElement.textContent.replace("₹", "")) || 0;
      todayCashElement.textContent = "₹" + (currentCash - todayCashExpenses);
    }

    if (todayOnlineElement) {
      const currentOnline =
        parseInt(todayOnlineElement.textContent.replace("₹", "")) || 0;
      todayOnlineElement.textContent =
        "₹" + (currentOnline - todayOnlineExpenses);
    }

    // Update total revenue with expenses deducted
    const todayRevenueElement = document.getElementById("today-revenue");
    if (todayRevenueElement) {
      const currentRevenue =
        parseInt(todayRevenueElement.textContent.replace("₹", "")) || 0;
      todayRevenueElement.textContent =
        "₹" + (currentRevenue - todayTotalExpenses);
    }
  };
}

// Enhanced report generation to include expenses with better date handling
function updateReportGeneration(originalGenerateReport) {
  return async function () {
    // Get dates from input fields
    const startDate = document.getElementById("start-date")?.value;
    const endDate = document.getElementById("end-date")?.value;
    const reportContent = document.getElementById("report-content");

    if (!startDate || !endDate) {
      showNotification("Please select both start and end dates", "error");
      return;
    }

    if (!reportContent) {
      debugLog("Report content element not found");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showNotification("Start date must be before end date", "error");
      return;
    }

    console.log(`Generating report from ${startDate} to ${endDate}`);

    // Show loading indicator
    const loadingIndicator = reportContent.querySelector(".loading-indicator");
    const emptyState = reportContent.querySelector(".empty-state");

    if (emptyState) emptyState.classList.add("hidden");
    if (loadingIndicator) loadingIndicator.classList.remove("hidden");

    try {
      const response = await fetch("/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Report data received:", data);

      if (data.success) {
        // Log expense data for debugging
        if (data.expense_logs) {
          console.log(
            `Found ${data.expense_logs.length} expenses in date range`
          );

          // Check expense types
          const transactionExpenses = data.expense_logs.filter(
            (log) => log.expense_type === "transaction"
          );
          const reportExpenses = data.expense_logs.filter(
            (log) => log.expense_type === "report"
          );

          console.log(`Transaction expenses: ${transactionExpenses.length}`);
          console.log(`Report expenses: ${reportExpenses.length}`);

          // Log each expense date for debugging
          data.expense_logs.forEach((expense, index) => {
            console.log(
              `Expense ${index + 1}: Date=${expense.date}, Type=${
                expense.expense_type
              }, Description=${expense.description}`
            );
          });
        } else {
          console.log("No expense logs found in report data");
        }

        // Call modified render function with expense data
        renderReportDataWithExpenses(data);
      } else {
        showNotification(data.message || "Error generating report", "error");
        if (emptyState) {
          emptyState.classList.remove("hidden");
          emptyState.innerHTML = `
            <i class="fas fa-exclamation-circle fa-3x"></i>
            <p>Error generating report. Please try again.</p>
          `;
        }
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      showNotification(`Error generating report: ${error.message}`, "error");
      if (emptyState) {
        emptyState.classList.remove("hidden");
        emptyState.innerHTML = `
          <i class="fas fa-exclamation-circle fa-3x"></i>
          <p>Error generating report. Please try again.</p>
        `;
      }
    } finally {
      if (loadingIndicator) loadingIndicator.classList.add("hidden");
    }
  };
}

// Render report data with expenses
function renderReportDataWithExpenses(data) {
  const reportContent = document.getElementById("report-content");
  if (!reportContent) {
    debugLog("Report content element not found");
    return;
  }

  // Format date range for display
  const startDate = new Date(document.getElementById("start-date").value);
  const endDate = new Date(document.getElementById("end-date").value);

  const formatDate = (date) => {
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const dateRangeText =
    formatDate(startDate) === formatDate(endDate)
      ? `${formatDate(startDate)}`
      : `${formatDate(startDate)} to ${formatDate(endDate)}`;

  // Main revenue summary including expenses
  let html = `
    <div class="summary-card">
      <div class="summary-title">Revenue Report (${dateRangeText})</div>
      <div class="summary-row">
        <div class="summary-label">Cash Payments</div>
        <div class="summary-value">₹${data.cash_total}</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">Online Payments</div>
        <div class="summary-value">₹${data.online_total}</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">Add-ons & Services</div>
        <div class="summary-value">₹${data.addon_total}</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">Refunds</div>
        <div class="summary-value">₹${data.refund_total}</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">Daily Expenses</div>
        <div class="summary-value" style="color: var(--danger);">₹${
          data.transaction_expense_total || 0
        }</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">Report Expenses</div>
        <div class="summary-value" style="color: var(--danger);">₹${
          data.report_expense_total || 0
        }</div>
      </div>
      <div class="summary-row total-row">
        <div class="summary-label">Total Net Revenue</div>
        <div class="summary-value">₹${data.total_revenue}</div>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-title">Expense Summary</div>
      <div class="summary-row">
        <div class="summary-label">Total Expenses</div>
        <div class="summary-value" style="color: var(--danger);">₹${
          data.expense_total || 0
        }</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">Daily Operations</div>
        <div class="summary-value">₹${data.transaction_expense_total || 0}</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">Report-Only</div>
        <div class="summary-value">₹${data.report_expense_total || 0}</div>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-title">Occupancy Statistics</div>
      <div class="summary-row">
        <div class="summary-label">Total Check-ins</div>
        <div class="summary-value">${data.checkins}</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">Total Renewals</div>
        <div class="summary-value">${data.renewals || 0}</div>
      </div>
    </div>
  `;

  // Add expenses section - Debug and fix for report expenses
  if (data.expense_logs && data.expense_logs.length > 0) {
    console.log("Expense logs found:", data.expense_logs.length);
    console.log(
      "Report expenses:",
      data.expense_logs.filter((log) => log.expense_type === "report").length
    );

    html += `
      <div class="logs-container" style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 1rem">Expenses</h3>
        <div>
    `;

    // Group expenses by category for summary
    const expensesByCategory = {};
    data.expense_logs.forEach((expense) => {
      const category = expense.category || "others";
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = {
          count: 0,
          total: 0,
          items: [],
        };
      }

      expensesByCategory[category].count++;
      expensesByCategory[category].total += expense.amount;
      expensesByCategory[category].items.push(expense);
    });

    // Render category summary
    html += `<div class="expense-categories-summary">`;

    Object.keys(expensesByCategory).forEach((category) => {
      const categoryData = expensesByCategory[category];
      html += `
        <div class="expense-category-item">
          <div class="expense-category-name">${category} (${categoryData.count})</div>
          <div class="expense-category-amount">₹${categoryData.total}</div>
        </div>
      `;
    });

    html += `</div>`;

    // Render individual expense logs
    data.expense_logs.forEach((log) => {
      // Format category for display
      const categoryDisplay =
        (log.category || "others").charAt(0).toUpperCase() +
        (log.category || "others").slice(1);

      // Different styling for transaction vs report expenses
      const expenseTypeClass =
        log.expense_type === "transaction"
          ? "transaction-expense"
          : "report-expense";

      // Add expense type indicator
      const expenseTypeLabel =
        log.expense_type === "transaction" ? "Daily Expense" : "Report Expense";

      html += `
        <div class="log-item ${expenseTypeClass}">
          <div class="log-details">
            <div class="log-title">
              ${log.description} 
              <span class="expense-category-badge">${categoryDisplay}</span>
              <span class="expense-type-badge ${log.payment_method}">${
        log.payment_method
      }</span>
              <span class="expense-indicator ${
                log.expense_type
              }">${expenseTypeLabel}</span>
            </div>
            <div class="log-subtitle">Expense on ${log.date} at ${
        log.time || "N/A"
      }</div>
          </div>
          <div class="log-amount" style="color: var(--danger);">₹${
            log.amount
          }</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="logs-container" style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 1rem">Expenses</h3>
        <div class="empty-state expenses" style="padding: 1.5rem;">
          <i class="fas fa-file-invoice-dollar fa-3x"></i>
          <p>No expenses in this period</p>
        </div>
      </div>
    `;
  }

  // Complete with other sections (cash, online, refunds, etc.)
  html += `
    <div class="logs-container" style="margin-top: 1.5rem;">
      <h3 style="margin-bottom: 1rem">Cash Payments</h3>
      <div>
  `;

  if (!data.cash_logs || data.cash_logs.length === 0) {
    html += '<div class="log-item">No cash payments in this period</div>';
  } else {
    data.cash_logs.forEach((log) => {
      html += `
        <div class="log-item">
          <div class="log-details">
            <div class="log-title">Room ${log.room} - ${log.name} ${
        log.item ? `(${log.item})` : ""
      }</div>
            <div class="log-subtitle">Cash payment on ${log.date} at ${
        log.time || "N/A"
      }</div>
          </div>
          <div class="log-amount">₹${log.amount}</div>
        </div>
      `;
    });
  }

  html += `
      </div>
    </div>
  `;

  // Online payments section
  html += `
    <div class="logs-container" style="margin-top: 1.5rem;">
      <h3 style="margin-bottom: 1rem">Online Payments</h3>
      <div>
  `;

  if (!data.online_logs || data.online_logs.length === 0) {
    html += '<div class="log-item">No online payments in this period</div>';
  } else {
    data.online_logs.forEach((log) => {
      html += `
        <div class="log-item">
          <div class="log-details">
            <div class="log-title">Room ${log.room} - ${log.name} ${
        log.item ? `(${log.item})` : ""
      }</div>
            <div class="log-subtitle">Online payment on ${log.date} at ${
        log.time || "N/A"
      }</div>
          </div>
          <div class="log-amount">₹${log.amount}</div>
        </div>
      `;
    });
  }

  html += `
      </div>
    </div>
  `;

  // Add remaining sections as needed for refunds, add-ons, etc.

  reportContent.innerHTML = html;
}

// Initialize on document load
document.addEventListener("DOMContentLoaded", function () {
  // Override the original functions with our enhanced versions
  if (typeof renderLogs === "function") {
    window.renderLogs = updateRenderLogs(renderLogs);
  }

  if (typeof updateStats === "function") {
    window.updateStats = updateStatsWithExpenses(updateStats);
  }

  if (typeof generateReport === "function") {
    window.generateReport = updateReportGeneration(generateReport);
  }

  // Initialize expense system
  initializeExpense();
});
