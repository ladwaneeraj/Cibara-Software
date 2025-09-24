function setupChartDefaults() {
  // Disable animations globally
  Chart.defaults.animation = false;
  Chart.defaults.animations = {
    colors: false,
    numbers: false,
  };
  Chart.defaults.transitions = {
    active: {
      animation: {
        duration: 0,
      },
    },
    resize: {
      animation: {
        duration: 0,
      },
    },
  };

  // Set default options for all charts
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.plugins.tooltip.animation = false;
  Chart.defaults.plugins.tooltip.animationDuration = 0;
}

// Initialize analytics components
function initializeAnalytics() {
  // Setup chart defaults
  setupChartDefaults();

  // Setup view toggle buttons
  const viewButtons = document.querySelectorAll(".view-btn");
  if (viewButtons.length) {
    viewButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        // Update active button
        viewButtons.forEach((b) => b.classList.remove("active"));
        this.classList.add("active");

        // Show corresponding view
        const viewToShow = this.dataset.view;
        const views = document.querySelectorAll(".view-content");
        views.forEach((view) => {
          view.classList.add("hidden");
        });

        const targetView = document.getElementById(`${viewToShow}-view`);
        if (targetView) {
          targetView.classList.remove("hidden");
        }
      });
    });
  }

  // Initialize date pickers with default values (current month)
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");

  if (startDateInput && endDateInput) {
    startDateInput.valueAsDate = startOfMonth;
    endDateInput.valueAsDate = today;
  }

  // Initialize analytics view with empty chart containers
  initializeAnalyticsView();
}

// Generate all analytics charts and summary cards
async function generateAnalytics(reportData) {
  if (!reportData) {
    console.error("No report data available for analytics");
    return;
  }

  // Update summary cards
  updateSummaryCards(reportData);

  // Generate all charts
  generateRevenueExpenseChart(reportData);
  generateTopRoomsChart(reportData);
  generatePaymentMethodsChart(reportData);
  generateExpenseCategoriesChart(reportData);
  generateDailyRevenueChart(reportData);
  generateTopServicesChart(reportData);
}

// Update summary cards with data - FIXED NET REVENUE CALCULATION
function updateSummaryCards(data) {
  const summaryContainer = document.getElementById("analytics-summary");
  if (!summaryContainer) return;

  const cashTotal = data.cash_total || 0;
  const onlineTotal = data.online_total || 0;
  const totalIncome = cashTotal + onlineTotal;

  // FIXED: Include both transaction and report expenses
  const totalExpense = data.expense_total || 0; // This includes both daily and report expenses

  // FIXED: Net revenue = Total Income - Total Expenses
  const netRevenue = totalIncome - totalExpense;

  const checkins = data.checkins || 0;
  const renewals = data.renewals || 0;

  // Calculate occupancy rate (example calculation - modify as needed)
  // This is a placeholder - you should use actual data from your backend
  const totalRooms = 30; // Assumption - replace with actual value
  const occupancyRate = Math.round((checkins / totalRooms) * 100);

  summaryContainer.innerHTML = `
    <div class="analytics-card">
      <div class="analytics-card-header">Total Income</div>
      <div class="analytics-card-value">₹${totalIncome}</div>
      <div class="analytics-card-footer">
        <span>Cash: ₹${cashTotal}</span>
        <span>Online: ₹${onlineTotal}</span>
      </div>
    </div>
    
    <div class="analytics-card">
      <div class="analytics-card-header">Total Expenses</div>
      <div class="analytics-card-value">₹${totalExpense}</div>
      <div class="analytics-card-footer">
        <span>Categories: ${
          (data.expense_logs || []).length > 0
            ? Object.keys(
                (data.expense_logs || []).reduce((acc, log) => {
                  acc[log.category] = true;
                  return acc;
                }, {})
              ).length
            : 0
        }</span>
      </div>
    </div>
    
    <div class="analytics-card highlighted">
      <div class="analytics-card-header">Net Revenue</div>
      <div class="analytics-card-value">₹${netRevenue}</div>
      <div class="analytics-card-footer">
        <span>Income: ₹${totalIncome}</span>
        <span>Expenses: ₹${totalExpense}</span>
      </div>
    </div>
    
    <div class="analytics-card">
      <div class="analytics-card-header">Check-ins</div>
      <div class="analytics-card-value">${checkins}</div>
      <div class="analytics-card-footer">
        <span>Renewals: ${renewals}</span>
      </div>
    </div>
  `;
}

// Revenue & Expense Chart (Line Chart)
function generateRevenueExpenseChart(data) {
  const chartCanvas = document.getElementById("revenue-expense-chart");
  if (!chartCanvas) return;

  // Clear any existing chart
  if (chartCanvas.chart) {
    chartCanvas.chart.destroy();
  }

  // Create datasets based on dates
  const dates = [
    ...new Set([
      ...(data.cash_logs || []).map((log) => log.date),
      ...(data.online_logs || []).map((log) => log.date),
      ...(data.expense_logs || []).map((log) => log.date),
    ]),
  ].sort();

  // Calculate daily totals
  const revenueData = dates.map((date) => {
    const cashTotal = (data.cash_logs || [])
      .filter((log) => log.date === date)
      .reduce((sum, log) => sum + log.amount, 0);

    const onlineTotal = (data.online_logs || [])
      .filter((log) => log.date === date)
      .reduce((sum, log) => sum + log.amount, 0);

    return cashTotal + onlineTotal;
  });

  const expenseData = dates.map((date) => {
    return (data.expense_logs || [])
      .filter((log) => log.date === date)
      .reduce((sum, log) => sum + log.amount, 0);
  });

  // Format dates for display
  const formattedDates = dates.map((date) => {
    const [year, month, day] = date.split("-");
    return `${day}/${month}`;
  });

  // Create chart
  const ctx = chartCanvas.getContext("2d");
  chartCanvas.chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: formattedDates,
      datasets: [
        {
          label: "Revenue",
          data: revenueData,
          borderColor: "#4361ee",
          backgroundColor: "rgba(67, 97, 238, 0.1)",
          tension: 0.3,
          fill: true,
        },
        {
          label: "Expenses",
          data: expenseData,
          borderColor: "#e63946",
          backgroundColor: "rgba(230, 57, 70, 0.1)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      hover: {
        animationDuration: 0,
      },
      responsiveAnimationDuration: 0,
      onResize: null,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ₹${context.raw}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "₹" + value;
            },
          },
        },
      },
    },
  });
}

// Top 10 Rooms Chart (Bar Chart)
function generateTopRoomsChart(data) {
  const chartCanvas = document.getElementById("top-rooms-chart");
  if (!chartCanvas) return;

  // Clear any existing chart
  if (chartCanvas.chart) {
    chartCanvas.chart.destroy();
  }

  // Combine all room logs
  const allRoomLogs = [...(data.cash_logs || []), ...(data.online_logs || [])];

  // Calculate revenue per room
  const roomRevenue = {};
  allRoomLogs.forEach((log) => {
    if (!roomRevenue[log.room]) {
      roomRevenue[log.room] = 0;
    }
    roomRevenue[log.room] += log.amount;
  });

  // Sort rooms by revenue and get top 10
  const topRooms = Object.entries(roomRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const roomNumbers = topRooms.map((room) => `Room ${room[0]}`);
  const roomValues = topRooms.map((room) => room[1]);

  // Create chart
  const ctx = chartCanvas.getContext("2d");
  chartCanvas.chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: roomNumbers,
      datasets: [
        {
          label: "Revenue",
          data: roomValues,
          backgroundColor: "rgba(67, 97, 238, 0.7)",
          borderColor: "#4361ee",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      hover: {
        animationDuration: 0,
      },
      responsiveAnimationDuration: 0,
      onResize: null,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `Revenue: ₹${context.raw}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "₹" + value;
            },
          },
        },
      },
    },
  });
}

// Payment Methods Chart (Pie Chart)
function generatePaymentMethodsChart(data) {
  const chartCanvas = document.getElementById("payment-methods-chart");
  if (!chartCanvas) return;

  // Clear any existing chart
  if (chartCanvas.chart) {
    chartCanvas.chart.destroy();
  }

  // Calculate totals by payment method
  const cashTotal = (data.cash_logs || []).reduce(
    (sum, log) => sum + log.amount,
    0
  );
  const onlineTotal = (data.online_logs || []).reduce(
    (sum, log) => sum + log.amount,
    0
  );

  // Create chart
  const ctx = chartCanvas.getContext("2d");
  chartCanvas.chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Cash", "Online"],
      datasets: [
        {
          data: [cashTotal, onlineTotal],
          backgroundColor: [
            "rgba(39, 174, 96, 0.7)",
            "rgba(41, 128, 185, 0.7)",
          ],
          borderColor: ["#27ae60", "#2980b9"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      hover: {
        animationDuration: 0,
      },
      responsiveAnimationDuration: 0,
      onResize: null,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const total = cashTotal + onlineTotal;
              const percentage = ((context.raw / total) * 100).toFixed(1);
              return `${context.label}: ₹${context.raw} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

// Expense Categories Chart (Pie Chart)
function generateExpenseCategoriesChart(data) {
  const chartCanvas = document.getElementById("expense-categories-chart");
  if (!chartCanvas) return;

  // Clear any existing chart
  if (chartCanvas.chart) {
    chartCanvas.chart.destroy();
  }

  // Group expenses by category
  const expenseCategories = {};
  (data.expense_logs || []).forEach((log) => {
    const category = log.category || "Other";
    if (!expenseCategories[category]) {
      expenseCategories[category] = 0;
    }
    expenseCategories[category] += log.amount;
  });

  // Sort categories by amount
  const sortedCategories = Object.entries(expenseCategories).sort(
    (a, b) => b[1] - a[1]
  );

  const categoryLabels = sortedCategories.map(
    (cat) => cat[0].charAt(0).toUpperCase() + cat[0].slice(1)
  );
  const categoryValues = sortedCategories.map((cat) => cat[1]);

  // Generate colors
  const backgroundColors = [
    "rgba(230, 57, 70, 0.7)",
    "rgba(241, 196, 15, 0.7)",
    "rgba(142, 68, 173, 0.7)",
    "rgba(231, 76, 60, 0.7)",
    "rgba(26, 188, 156, 0.7)",
    "rgba(52, 152, 219, 0.7)",
    "rgba(155, 89, 182, 0.7)",
    "rgba(52, 73, 94, 0.7)",
  ];

  const borderColors = [
    "#e63946",
    "#f1c40f",
    "#8e44ad",
    "#e74c3c",
    "#1abc9c",
    "#3498db",
    "#9b59b6",
    "#34495e",
  ];

  // Create chart
  const ctx = chartCanvas.getContext("2d");
  chartCanvas.chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: categoryLabels,
      datasets: [
        {
          data: categoryValues,
          backgroundColor: backgroundColors.slice(0, categoryValues.length),
          borderColor: borderColors.slice(0, categoryValues.length),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      hover: {
        animationDuration: 0,
      },
      responsiveAnimationDuration: 0,
      onResize: null,
      plugins: {
        legend: {
          position: "right",
          labels: {
            boxWidth: 12,
            padding: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const total = categoryValues.reduce((a, b) => a + b, 0);
              const percentage = ((context.raw / total) * 100).toFixed(1);
              return `${context.label}: ₹${context.raw} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

// Daily Revenue Breakdown (Bar Chart) - NEW CHART
function generateDailyRevenueChart(data) {
  const chartCanvas = document.getElementById("daily-revenue-chart");
  if (!chartCanvas) return;

  // Clear any existing chart
  if (chartCanvas.chart) {
    chartCanvas.chart.destroy();
  }

  // Create datasets based on dates
  const dates = [
    ...new Set([
      ...(data.cash_logs || []).map((log) => log.date),
      ...(data.online_logs || []).map((log) => log.date),
    ]),
  ].sort();

  // Calculate daily totals by payment method
  const cashData = dates.map((date) => {
    return (data.cash_logs || [])
      .filter((log) => log.date === date)
      .reduce((sum, log) => sum + log.amount, 0);
  });

  const onlineData = dates.map((date) => {
    return (data.online_logs || [])
      .filter((log) => log.date === date)
      .reduce((sum, log) => sum + log.amount, 0);
  });

  // Format dates for display
  const formattedDates = dates.map((date) => {
    const [year, month, day] = date.split("-");
    return `${day}/${month}`;
  });

  // Create chart
  const ctx = chartCanvas.getContext("2d");
  chartCanvas.chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: formattedDates,
      datasets: [
        {
          label: "Cash",
          data: cashData,
          backgroundColor: "rgba(39, 174, 96, 0.7)",
          borderColor: "#27ae60",
          borderWidth: 1,
        },
        {
          label: "Online",
          data: onlineData,
          backgroundColor: "rgba(41, 128, 185, 0.7)",
          borderColor: "#2980b9",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      hover: {
        animationDuration: 0,
      },
      responsiveAnimationDuration: 0,
      onResize: null,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ₹${context.raw}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "₹" + value;
            },
          },
        },
      },
    },
  });
}

// Top Services/Add-ons Chart (Horizontal Bar) - NEW CHART
function generateTopServicesChart(data) {
  const chartCanvas = document.getElementById("top-services-chart");
  if (!chartCanvas) return;

  // Clear any existing chart
  if (chartCanvas.chart) {
    chartCanvas.chart.destroy();
  }

  // Group add-ons by type
  const serviceRevenue = {};
  (data.addon_logs || []).forEach((log) => {
    const serviceName = log.item || "Other";
    if (!serviceRevenue[serviceName]) {
      serviceRevenue[serviceName] = 0;
    }
    serviceRevenue[serviceName] += log.price;
  });

  // Sort services by revenue and get top 8
  const topServices = Object.entries(serviceRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const serviceNames = topServices.map((service) => service[0]);
  const serviceValues = topServices.map((service) => service[1]);

  // Create chart
  const ctx = chartCanvas.getContext("2d");
  chartCanvas.chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: serviceNames,
      datasets: [
        {
          label: "Revenue",
          data: serviceValues,
          backgroundColor: "rgba(255, 159, 28, 0.7)",
          borderColor: "#ff9f1c",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      hover: {
        animationDuration: 0,
      },
      responsiveAnimationDuration: 0,
      onResize: null,
      indexAxis: "y",
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `Revenue: ₹${context.raw}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "₹" + value;
            },
          },
        },
      },
    },
  });
}

// Create HTML for analytics widgets
function initializeAnalyticsView() {
  const analyticsView = document.getElementById("analytics-view");
  if (!analyticsView) return;

  analyticsView.innerHTML = `
    <!-- Summary Cards -->
    <div class="analytics-summary" id="analytics-summary">
      <!-- Cards will be populated dynamically -->
      <div class="analytics-card">
        <div class="analytics-card-header">Total Income</div>
        <div class="analytics-card-value">₹0</div>
        <div class="analytics-card-footer">
          <span>Cash: ₹0</span>
          <span>Online: ₹0</span>
        </div>
      </div>
      
      <div class="analytics-card">
        <div class="analytics-card-header">Total Expenses</div>
        <div class="analytics-card-value">₹0</div>
        <div class="analytics-card-footer">
          <span>Categories: 0</span>
        </div>
      </div>
      
      <div class="analytics-card highlighted">
        <div class="analytics-card-header">Net Revenue</div>
        <div class="analytics-card-value">₹0</div>
        <div class="analytics-card-footer">
          <span>Income: ₹0</span>
          <span>Expenses: ₹0</span>
        </div>
      </div>
      
      <div class="analytics-card">
        <div class="analytics-card-header">Check-ins</div>
        <div class="analytics-card-value">0</div>
        <div class="analytics-card-footer">
          <span>Renewals: 0</span>
        </div>
      </div>
    </div>

    <div class="analytics-row">
      <!-- Revenue & Expense Chart -->
      <div class="analytics-widget">
        <div class="widget-header">
          <h3>Revenue & Expenses</h3>
        </div>
        <div class="widget-content">
          <canvas id="revenue-expense-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="analytics-row">
      <!-- Daily Revenue Breakdown -->
      <div class="analytics-widget">
        <div class="widget-header">
          <h3>Daily Revenue by Payment Method</h3>
        </div>
        <div class="widget-content">
          <canvas id="daily-revenue-chart"></canvas>
        </div>
      </div>
    </div>

    <div class="analytics-row">
      <!-- Top 10 Rooms Chart -->
      <div class="analytics-widget">
        <div class="widget-header">
          <h3>Top 10 Rooms</h3>
        </div>
        <div class="widget-content">
          <canvas id="top-rooms-chart"></canvas>
        </div>
      </div>
      
      <!-- Top Services/Add-ons Chart -->
      <div class="analytics-widget">
        <div class="widget-header">
          <h3>Top Services by Revenue</h3>
        </div>
        <div class="widget-content">
          <canvas id="top-services-chart"></canvas>
        </div>
      </div>
    </div>
    
    <div class="analytics-row">
      <!-- Payment Methods Chart -->
      <div class="analytics-widget">
        <div class="widget-header">
          <h3>Payment Methods</h3>
        </div>
        <div class="widget-content">
          <canvas id="payment-methods-chart"></canvas>
        </div>
      </div>
      
      <!-- Expense Categories Chart -->
      <div class="analytics-widget">
        <div class="widget-header">
          <h3>Expense Categories</h3>
        </div>
        <div class="widget-content">
          <canvas id="expense-categories-chart"></canvas>
        </div>
      </div>
    </div>
  `;
}

// Helper function to format date to DD-MM-YYYY HH:MM - MOVED TO GLOBAL SCOPE FOR EXCEL EXPORT
function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return "N/A";

  try {
    const [year, month, day] = dateStr.split("-");
    const formattedDate = `${day}-${month}-${year}`;

    if (timeStr) {
      return `${formattedDate} ${timeStr}`;
    } else {
      return formattedDate;
    }
  } catch (e) {
    return dateStr;
  }
}

// Updated report generation to support both analytics and detailed reports
async function generateEnhancedReport() {
  const startDate = document.getElementById("start-date")?.value;
  const endDate = document.getElementById("end-date")?.value;

  if (!startDate || !endDate) {
    showNotification("Please select both start and end dates", "error");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showNotification("Start date must be before end date", "error");
    return;
  }

  // Show loading indicators
  const analyticsView = document.getElementById("analytics-view");
  const reportsView = document.getElementById("reports-view");
  const reportContent = document.getElementById("report-content");

  if (analyticsView) {
    analyticsView.innerHTML = `
      <div class="loading-indicator" style="padding: 3rem;">
        <span class="loader"></span>
        <p>Generating analytics...</p>
      </div>
    `;
  }

  if (reportContent) {
    const loadingIndicator = reportContent.querySelector(".loading-indicator");
    const emptyState = reportContent.querySelector(".empty-state");

    if (emptyState) emptyState.classList.add("hidden");
    if (loadingIndicator) loadingIndicator.classList.remove("hidden");
  }

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

    if (data.success) {
      // Store the data globally for Excel export
      window.reportData = data;

      // Update date range in the report summary
      updateReportDateRange(startDate, endDate);

      // Update the report summary values
      updateReportSummary(data);

      // Generate charts for analytics view
      initializeAnalyticsView(); // Reset charts first
      generateAnalytics(data);

      // Render detailed reports for reports view
      renderCompactReportData(data);
    } else {
      showNotification(data.message || "Error generating report", "error");
    }
  } catch (error) {
    console.error("Error fetching report:", error);
    showNotification(`Error generating report: ${error.message}`, "error");

    // Restore views on error
    if (analyticsView) {
      initializeAnalyticsView();
    }

    if (reportContent) {
      const loadingIndicator =
        reportContent.querySelector(".loading-indicator");
      const emptyState = reportContent.querySelector(".empty-state");

      if (loadingIndicator) loadingIndicator.classList.add("hidden");
      if (emptyState) {
        emptyState.classList.remove("hidden");
        emptyState.innerHTML = `
          <i class="fas fa-exclamation-circle fa-3x"></i>
          <p>Error generating report. Please try again.</p>
        `;
      }
    }
  }
}

// Update report date range display
function updateReportDateRange(startDate, endDate) {
  const dateRangeElement = document.getElementById("report-date-range");
  if (!dateRangeElement) return;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formattedStart = formatDate(startDate);
  const formattedEnd = formatDate(endDate);

  dateRangeElement.textContent =
    formattedStart === formattedEnd
      ? `(${formattedStart})`
      : `(${formattedStart} to ${formattedEnd})`;
}

// Update report summary values
function updateReportSummary(data) {
  // Update summary values
  document.getElementById("report-cash-total").textContent = `₹${
    data.cash_total || 0
  }`;
  document.getElementById("report-online-total").textContent = `₹${
    data.online_total || 0
  }`;
  document.getElementById("report-refund-total").textContent = `₹${
    data.refund_total || 0
  }`;
  document.getElementById("report-expense-total").textContent = `₹${
    data.expense_total || 0
  }`;

  // FIXED: Calculate net revenue properly (Income - Expenses)
  const totalIncome = (data.cash_total || 0) + (data.online_total || 0);
  const totalExpense = data.expense_total || 0;
  const netRevenue = totalIncome - totalExpense;

  document.getElementById("report-net-revenue").textContent = `₹${netRevenue}`;
}

// Excel Export Function - FIXED: Removed duplicate formatDateTime function
function exportToExcel() {
  if (!window.reportData) {
    showNotification("No report data available for export", "error");
    return;
  }

  // Check if XLSX is available
  if (typeof XLSX === "undefined") {
    showNotification(
      "Excel export library not loaded. Please refresh the page and try again.",
      "error"
    );
    return;
  }

  try {
    const data = window.reportData;
    const startDate = document.getElementById("start-date")?.value || "N/A";
    const endDate = document.getElementById("end-date")?.value || "N/A";

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ["LODGE MANAGEMENT REPORT"],
      [`Report Period: ${startDate} to ${endDate}`],
      [""],
      ["REVENUE SUMMARY"],
      ["Cash Payments", data.cash_total || 0],
      ["Online Payments", data.online_total || 0],
      ["Total Income", (data.cash_total || 0) + (data.online_total || 0)],
      [""],
      ["EXPENSE SUMMARY"],
      ["Total Expenses", data.expense_total || 0],
      [""],
      ["NET SUMMARY"],
      [
        "Net Revenue",
        (data.cash_total || 0) +
          (data.online_total || 0) -
          (data.expense_total || 0),
      ],
      ["Total Refunds", data.refund_total || 0],
      ["Check-ins", data.checkins || 0],
      ["Renewals", data.renewals || 0],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // Cash Payments Sheet
    if (data.cash_logs && data.cash_logs.length > 0) {
      const cashData = [
        ["Room", "Guest Name", "Amount", "Date", "Time", "Item"],
      ];
      data.cash_logs.forEach((log) => {
        cashData.push([
          log.room || "N/A",
          log.name || "N/A",
          log.amount || 0,
          formatDateTime(log.date, null),
          log.time || "N/A",
          log.item || "",
        ]);
      });
      const cashSheet = XLSX.utils.aoa_to_sheet(cashData);
      XLSX.utils.book_append_sheet(workbook, cashSheet, "Cash Payments");
    }

    // Online Payments Sheet
    if (data.online_logs && data.online_logs.length > 0) {
      const onlineData = [
        ["Room", "Guest Name", "Amount", "Date", "Time", "Item"],
      ];
      data.online_logs.forEach((log) => {
        onlineData.push([
          log.room || "N/A",
          log.name || "N/A",
          log.amount || 0,
          formatDateTime(log.date, null),
          log.time || "N/A",
          log.item || "",
        ]);
      });
      const onlineSheet = XLSX.utils.aoa_to_sheet(onlineData);
      XLSX.utils.book_append_sheet(workbook, onlineSheet, "Online Payments");
    }

    // Expenses Sheet - SORTED BY FORM TIME (OLDEST FIRST, LATEST LAST)
    if (data.expense_logs && data.expense_logs.length > 0) {
      // Sort expenses by date and time from the form - OLDEST FIRST
      const sortedExpenses = [...data.expense_logs].sort((a, b) => {
        const dateTimeA = new Date(`${a.date} ${a.time || "00:00"}`);
        const dateTimeB = new Date(`${b.date} ${b.time || "00:00"}`);
        return dateTimeA - dateTimeB; // Oldest first, latest last
      });

      const expenseData = [
        [
          "Date",
          "Time",
          "Category",
          "Description",
          "Amount",
          "Payment Method",
          "Type",
        ],
      ];
      sortedExpenses.forEach((log) => {
        expenseData.push([
          formatDateTime(log.date, null),
          log.time || "N/A",
          (log.category || "other").charAt(0).toUpperCase() +
            (log.category || "other").slice(1),
          log.description || "N/A",
          log.amount || 0,
          (log.payment_method || "cash").toUpperCase(),
          (log.expense_type || "transaction").charAt(0).toUpperCase() +
            (log.expense_type || "transaction").slice(1),
        ]);
      });
      const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData);
      XLSX.utils.book_append_sheet(workbook, expenseSheet, "Expenses");
    }

    // Refunds Sheet
    if (data.refund_logs && data.refund_logs.length > 0) {
      const refundData = [
        [
          "Room",
          "Guest Name",
          "Amount",
          "Date",
          "Time",
          "Payment Mode",
          "Note",
        ],
      ];
      data.refund_logs.forEach((log) => {
        refundData.push([
          log.room || "N/A",
          log.name || "N/A",
          log.amount || 0,
          log.date || "N/A",
          log.time || "N/A",
          log.payment_mode || "cash",
          log.note || "",
        ]);
      });
      const refundSheet = XLSX.utils.aoa_to_sheet(refundData);
      XLSX.utils.book_append_sheet(workbook, refundSheet, "Refunds");
    }

    // Generate filename with current date
    const now = new Date();
    const filename = `Lodge_Report_${startDate}_to_${endDate}_${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.xlsx`;

    // Save the file
    XLSX.writeFile(workbook, filename);

    showNotification("Excel report exported successfully!", "success");
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    showNotification("Error exporting to Excel: " + error.message, "error");
  }
}

// UPDATED: Render compact report data with collapsible sections (CLOSED BY DEFAULT) and no add-ons
function renderCompactReportData(data) {
  const reportContent = document.getElementById("report-content");
  if (!reportContent) return;

  // Hide loading indicator
  const loadingIndicator = reportContent.querySelector(".loading-indicator");
  if (loadingIndicator) loadingIndicator.classList.add("hidden");

  // Remove empty state if it exists
  const emptyState = reportContent.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  // Start building HTML with Excel export button
  let html = `
    <div style="margin-bottom: 1rem; text-align: right;">
      <button onclick="exportToExcel()" class="action-btn btn-success btn-sm">
        <i class="fas fa-file-excel"></i> Export to Excel
      </button>
    </div>
  `;

  // Cash Payments logs - COLLAPSIBLE AND CLOSED BY DEFAULT
  let cashTotal = 0;
  html += `
    <div class="logs-container transaction-section">
      <h3 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="toggleSection('cash-section')">
        Cash Payments 
        <i class="fas fa-chevron-right" id="cash-section-icon"></i>
      </h3>
      <div class="transaction-logs" id="cash-section" style="display: none;">
  `;

  if (!data.cash_logs || data.cash_logs.length === 0) {
    html += '<div class="log-item">No cash payments in this period</div>';
  } else {
    data.cash_logs.forEach((log) => {
      cashTotal += log.amount;
      html += `
        <div class="log-item">
          <div class="log-details">
            <div class="log-title">Room ${log.room} - ${log.name} ${
        log.item ? `<span class="transaction-item">(${log.item})</span>` : ""
      }</div>
            <div class="log-subtitle">${log.date} ${log.time || ""}</div>
          </div>
          <div class="log-amount">₹${log.amount}</div>
        </div>
      `;
    });

    // Add section total
    html += `
      <div class="log-item section-total">
        <div class="log-details">
          <div class="log-title">Total Cash Payments</div>
        </div>
        <div class="log-amount">₹${cashTotal}</div>
      </div>
    `;
  }

  html += `</div></div>`;

  // Online Payments logs - COLLAPSIBLE AND CLOSED BY DEFAULT
  let onlineTotal = 0;
  html += `
    <div class="logs-container transaction-section">
      <h3 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="toggleSection('online-section')">
        Online Payments 
        <i class="fas fa-chevron-right" id="online-section-icon"></i>
      </h3>
      <div class="transaction-logs" id="online-section" style="display: none;">
  `;

  if (!data.online_logs || data.online_logs.length === 0) {
    html += '<div class="log-item">No online payments in this period</div>';
  } else {
    data.online_logs.forEach((log) => {
      onlineTotal += log.amount;
      html += `
        <div class="log-item">
          <div class="log-details">
            <div class="log-title">Room ${log.room} - ${log.name} ${
        log.item ? `<span class="transaction-item">(${log.item})</span>` : ""
      }</div>
            <div class="log-subtitle">${log.date} ${log.time || ""}</div>
          </div>
          <div class="log-amount">₹${log.amount}</div>
        </div>
      `;
    });

    // Add section total
    html += `
      <div class="log-item section-total">
        <div class="log-details">
          <div class="log-title">Total Online Payments</div>
        </div>
        <div class="log-amount">₹${onlineTotal}</div>
      </div>
    `;
  }

  html += `</div></div>`;

  // Expenses - COLLAPSIBLE AND CLOSED BY DEFAULT, SORTED BY FORM TIME (OLDEST FIRST)
  let expenseTotal = 0;
  html += `
    <div class="logs-container transaction-section">
      <h3 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="toggleSection('expense-section')">
        Expenses 
        <i class="fas fa-chevron-right" id="expense-section-icon"></i>
      </h3>
      <div class="transaction-logs" id="expense-section" style="display: none;">
  `;

  if (!data.expense_logs || data.expense_logs.length === 0) {
    html += '<div class="log-item">No expenses in this period</div>';
  } else {
    // FIXED: Sort expenses by form date and time - OLDEST FIRST, LATEST LAST
    const sortedExpenses = [...data.expense_logs].sort((a, b) => {
      const dateTimeA = new Date(`${a.date} ${a.time || "00:00"}`);
      const dateTimeB = new Date(`${b.date} ${b.time || "00:00"}`);
      return dateTimeA - dateTimeB; // Oldest first, latest last
    });

    sortedExpenses.forEach((log) => {
      expenseTotal += log.amount;
      const categoryDisplay =
        log.category.charAt(0).toUpperCase() + log.category.slice(1);

      html += `
        <div class="log-item ${
          log.expense_type === "transaction"
            ? "transaction-expense"
            : "report-expense"
        }">
          <div class="log-details">
            <div class="log-title">
              ${log.description} 
              <span class="expense-category-badge">${categoryDisplay}</span>
            </div>
            <div class="log-subtitle">${formatDateTime(
              log.date,
              log.time
            )}</div>
          </div>
          <div class="log-amount">₹${log.amount}</div>
        </div>
      `;
    });

    // Add section total
    html += `
      <div class="log-item section-total">
        <div class="log-details">
          <div class="log-title">Total Expenses</div>
        </div>
        <div class="log-amount">₹${expenseTotal}</div>
      </div>
    `;
  }

  html += `</div></div>`;

  // Refunds - COLLAPSIBLE AND CLOSED BY DEFAULT
  let refundTotal = 0;
  html += `
    <div class="logs-container transaction-section">
      <h3 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="toggleSection('refund-section')">
        Refunds 
        <i class="fas fa-chevron-right" id="refund-section-icon"></i>
      </h3>
      <div class="transaction-logs" id="refund-section" style="display: none;">
  `;

  if (!data.refund_logs || data.refund_logs.length === 0) {
    html += '<div class="log-item">No refunds in this period</div>';
  } else {
    data.refund_logs.forEach((log) => {
      refundTotal += log.amount;
      html += `
        <div class="log-item">
          <div class="log-details">
            <div class="log-title">Room ${log.room} - ${log.name}</div>
            <div class="log-subtitle">${log.date} ${log.time || ""}</div>
          </div>
          <div class="log-amount" style="color: var(--danger);">₹${
            log.amount
          }</div>
        </div>
      `;
    });

    // Add section total
    html += `
      <div class="log-item section-total">
        <div class="log-details">
          <div class="log-title">Total Refunds</div>
        </div>
        <div class="log-amount" style="color: var(--danger);">₹${refundTotal}</div>
      </div>
    `;
  }

  html += `</div></div>`;

  // NOTE: ADD-ONS SECTION REMOVED AS REQUESTED

  // Grand total summary
  const totalIncome = cashTotal + onlineTotal;
  const totalExpenses = expenseTotal;
  const netRevenue = totalIncome - totalExpenses; // FIXED: Subtract expenses from income

  html += `
    <div class="logs-container grand-total-section">
      <h3>Grand Total</h3>
      <div class="transaction-logs">
        <div class="log-item">
          <div class="log-details">
            <div class="log-title">Total Income (Cash + Online)</div>
          </div>
          <div class="log-amount">₹${totalIncome}</div>
        </div>
        <div class="log-item">
          <div class="log-details">
            <div class="log-title">Total Expenses</div>
          </div>
          <div class="log-amount" style="color: var(--danger);">₹${totalExpenses}</div>
        </div>
        <div class="log-item">
          <div class="log-details">
            <div class="log-title">Total Refunds</div>
          </div>
          <div class="log-amount" style="color: var(--danger);">₹${refundTotal}</div>
        </div>
        <div class="log-item grand-total">
          <div class="log-details">
            <div class="log-title">Net Revenue</div>
          </div>
          <div class="log-amount">₹${netRevenue}</div>
        </div>
      </div>
    </div>
  `;

  // Set the HTML content
  reportContent.innerHTML = html;
}

// Function to toggle collapsible sections
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const icon = document.getElementById(sectionId + "-icon");

  if (section && icon) {
    if (section.style.display === "none") {
      section.style.display = "block";
      icon.className = "fas fa-chevron-down";
    } else {
      section.style.display = "none";
      icon.className = "fas fa-chevron-right";
    }
  }
}

// Initialize Analytics on document load
document.addEventListener("DOMContentLoaded", function () {
  // Set up chart defaults to prevent resizing
  setupChartDefaults();

  // Initialize analytics components
  initializeAnalytics();

  // Override the apply report filter button
  const applyReportFilterBtn = document.getElementById("apply-report-filter");
  if (applyReportFilterBtn) {
    applyReportFilterBtn.addEventListener("click", generateEnhancedReport);

    // Force the analytics view to show first when loading reports
    applyReportFilterBtn.addEventListener("click", function () {
      const analyticsBtn = document.querySelector(
        '.view-btn[data-view="analytics"]'
      );
      if (analyticsBtn) {
        analyticsBtn.click();
      }
    });
  }

  // Make toggleSection function global
  window.toggleSection = toggleSection;
  window.exportToExcel = exportToExcel;
});
