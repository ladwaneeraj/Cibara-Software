// transaction-tracking.js - Enhanced Transaction Tracking System

class TransactionTracker {
  constructor() {
    this.dailyCounters = this.loadDailyCounters();
    this.todayDate = new Date().toISOString().split("T")[0];
    this.initializeTodayCounter();
  }

  // Load daily counters from localStorage
  loadDailyCounters() {
    try {
      const stored = localStorage.getItem("lodge_daily_counters");
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error loading daily counters:", error);
      return {};
    }
  }

  // Save daily counters to localStorage
  saveDailyCounters() {
    try {
      localStorage.setItem(
        "lodge_daily_counters",
        JSON.stringify(this.dailyCounters)
      );
    } catch (error) {
      console.error("Error saving daily counters:", error);
    }
  }

  // Initialize today's counter if it doesn't exist
  initializeTodayCounter() {
    if (!this.dailyCounters[this.todayDate]) {
      this.dailyCounters[this.todayDate] = 0;
      this.saveDailyCounters();
    }
  }

  // Get next serial number for fresh check-in
  getNextSerialNumber() {
    this.dailyCounters[this.todayDate] =
      (this.dailyCounters[this.todayDate] || 0) + 1;
    this.saveDailyCounters();
    return this.dailyCounters[this.todayDate];
  }

  // Get serial number for a specific date (for existing check-ins)
  getSerialNumberForDate(date, roomNumber) {
    // Check if this room has a serial number for this date
    const key = `${date}_${roomNumber}`;
    const stored = localStorage.getItem(`serial_${key}`);

    if (stored) {
      return parseInt(stored);
    }

    // If not found, this might be an old entry - return null
    return null;
  }

  // Store serial number for a specific room and date
  storeSerialNumber(date, roomNumber, serialNumber) {
    const key = `${date}_${roomNumber}`;
    localStorage.setItem(`serial_${key}`, serialNumber.toString());
  }

  // Clean up old counters (keep only last 30 days)
  cleanupOldCounters() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0];

    for (const date in this.dailyCounters) {
      if (date < cutoffDate) {
        delete this.dailyCounters[date];
      }
    }
    this.saveDailyCounters();
  }

  // Determine transaction type and return appropriate tag
  getTransactionTag(log, logType) {
    const tags = [];

    // Check for booking transactions
    if (
      log.booking_id ||
      log.type === "booking_advance" ||
      log.type === "booking_payment" ||
      log.type === "booking_final_payment"
    ) {
      tags.push({
        text: "BOOKING",
        class: "transaction-tag booking-tag",
        color: "#6f42c1",
      });
    }

    // Check for renewal/continue transactions
    if (log.room && this.isRenewalTransaction(log)) {
      tags.push({
        text: "CONTINUE",
        class: "transaction-tag continue-tag",
        color: "#28a745",
      });
    }

    // Check for service/add-on transactions
    if (log.item) {
      tags.push({
        text: "SERVICE",
        class: "transaction-tag service-tag",
        color: "#ffc107",
      });
    }

    // Check for refund transactions
    if (logType === "refunds") {
      tags.push({
        text: "REFUND",
        class: "transaction-tag refund-tag",
        color: "#dc3545",
      });
    }

    return tags;
  }

  // Check if transaction is from a renewal
  isRenewalTransaction(log) {
    // Check if this payment happened after the original check-in
    if (!log.room || !rooms[log.room]) return false;

    const room = rooms[log.room];
    if (!room.checkin_time || !room.guest) return false;

    try {
      const checkinDate = new Date(room.checkin_time);
      const logDateTime = new Date(`${log.date} ${log.time || "00:00"}`);

      // If payment is more than 23 hours after check-in, it's likely a renewal
      const timeDiff = logDateTime - checkinDate;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      return hoursDiff > 23;
    } catch (error) {
      console.error("Error checking renewal status:", error);
      return false;
    }
  }

  // Get serial number for display in logs
  getDisplaySerialNumber(log) {
    if (!log.room || !log.date) return null;

    // First check if we have a stored serial number
    const storedSerial = this.getSerialNumberForDate(log.date, log.room);
    if (storedSerial) return storedSerial;

    // For today's fresh check-ins, we might need to assign a number
    if (log.date === this.todayDate && this.isFreshCheckin(log)) {
      // This should already be handled during check-in, but as fallback
      return null;
    }

    return null;
  }

  // Check if this is a fresh check-in transaction
  isFreshCheckin(log) {
    if (!log.room || !rooms[log.room]) return false;

    const room = rooms[log.room];
    if (!room.checkin_time) return false;

    try {
      const checkinDate = new Date(room.checkin_time)
        .toISOString()
        .split("T")[0];
      const logDate = log.date;

      // Fresh check-in if the log date matches the check-in date
      return checkinDate === logDate;
    } catch (error) {
      return false;
    }
  }

  // Process check-in and assign serial number
  processCheckin(roomNumber, checkinDate = null) {
    const date = checkinDate || this.todayDate;

    // Only assign serial numbers for today's check-ins
    if (date === this.todayDate) {
      const serialNumber = this.getNextSerialNumber();
      this.storeSerialNumber(date, roomNumber, serialNumber);

      console.log(
        `Assigned serial number ${serialNumber} to room ${roomNumber} for ${date}`
      );
      return serialNumber;
    }

    return null;
  }

  // Initialize the system
  initialize() {
    this.cleanupOldCounters();
    console.log("Transaction Tracker initialized");
    console.log(`Today's counter: ${this.dailyCounters[this.todayDate] || 0}`);
  }
}

// Transaction Log Management Functions
class TransactionLogManager {
  constructor(transactionTracker) {
    this.transactionTracker = transactionTracker;
  }

  // Render enhanced transaction logs
  renderEnhancedLogs() {
    const transactionLog = document.getElementById("transaction-log");
    if (!transactionLog) {
      console.log("Transaction log element not found");
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

    // Filter logs for the recent dates with null checks
    const recentCashLogs = (logs.cash || []).filter((log) =>
      recentDates.includes(log.date)
    );
    const recentOnlineLogs = (logs.online || []).filter((log) =>
      recentDates.includes(log.date)
    );
    const recentRefundLogs = (logs.refunds || []).filter((log) =>
      recentDates.includes(log.date)
    );

    // Make sure discounts array exists and is filtered properly
    const discountLogs = logs.discounts || [];
    const recentDiscountLogs = discountLogs.filter((log) =>
      recentDates.includes(log.date)
    );

    // Add expenses logs - filter to only show transaction expenses
    const expensesLogs = logs.expenses || [];
    const recentExpenseLogs = expensesLogs.filter(
      (log) =>
        recentDates.includes(log.date) && log.expense_type === "transaction"
    );

    // Combine and sort by date and time (most recent first)
    const allRecentLogs = [
      ...recentCashLogs.map((log) => ({ ...log, logType: "cash" })),
      ...recentOnlineLogs.map((log) => ({ ...log, logType: "online" })),
      ...recentRefundLogs.map((log) => ({ ...log, logType: "refunds" })),
      ...recentDiscountLogs.map((log) => ({ ...log, logType: "discounts" })),
      ...recentExpenseLogs.map((log) => ({ ...log, logType: "expenses" })),
    ].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time || "00:00"}`);
      const dateB = new Date(`${b.date} ${b.time || "00:00"}`);
      return dateB - dateA;
    });

    // Update totals
    const cashTotal = document.getElementById("cash-total");
    const onlineTotal = document.getElementById("online-total");
    const refundTotal = document.getElementById("refund-total");
    const totalRevenue = document.getElementById("total-revenue");

    if (cashTotal) cashTotal.textContent = "₹" + totals.cash;
    if (onlineTotal) onlineTotal.textContent = "₹" + totals.online;
    if (refundTotal) refundTotal.textContent = "₹" + (totals.refunds || 0);
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

        // Add logs for this date using enhanced rendering
        logsByDate[date].forEach((log) => {
          logsHTML += this.renderEnhancedLogItem(log, log.logType);
        });
      });

    transactionLog.innerHTML = logsHTML;
  }

  // Render enhanced log item
  renderEnhancedLogItem(log, logType) {
    const tags = this.getTransactionTags(log, logType);
    const serialNumber = this.getLogSerialNumber(log);

    let type = "Unknown";
    let color = "";
    let additionalInfo = "";

    // Determine log type and styling based on priority
    if (logType === "refunds") {
      type = "Refund";
      color = 'style="color: var(--danger)"';
    } else if (logType === "expenses") {
      type = log.description || "Expense";
      color = 'style="color: var(--danger)"';
      additionalInfo = "";
    } else if (log.item || log.transaction_type === "service") {
      type = `Add-on: ${log.item}`;
    } else if (logType === "discounts") {
      type = "Discount";
      color = 'style="color: var(--success)"';
      additionalInfo = log.reason ? ` (${log.reason})` : "";
    } else if (logType === "cash") {
      if (log.payment_method === "pay_later" || log.amount === 0) {
        type = "Pay Later";
        color = 'style="color: var(--warning)"';
      } else {
        type = "Cash Payment";
      }
    } else if (logType === "online") {
      type = "Online Payment";
    }

    // Build tags HTML
    let tagsHtml = "";
    if (tags.length > 0) {
      tagsHtml = tags
        .map(
          (tag) =>
            `<span class="${tag.class}" style="background-color: ${tag.color}">${tag.text}</span>`
        )
        .join(" ");
    }

    // Build serial number display
    let serialHtml = "";
    if (serialNumber) {
      serialHtml = `<span class="serial-number">#${serialNumber}</span>`;
    }

    // Add room shift indicator if applicable
    const shiftInfo = log.room_shifted
      ? `<span class="room-shifted-badge">Shifted: ${log.old_room} → ${log.room}</span>`
      : "";

    // Special handling for zero amount transactions
    let amountDisplay = `₹${log.amount}`;
    if (
      log.amount === 0 &&
      (log.payment_method === "pay_later" || log.is_fresh_checkin)
    ) {
      amountDisplay = "₹0";
      color = 'style="color: var(--warning)"';
    }

    // For expenses, show simpler format
    let titleContent = "";
    if (logType === "expenses") {
      titleContent = log.description || "Expense";
    } else {
      titleContent = `Room ${log.room} - ${log.name}`;
    }

    return `
      <div class="log-item">
        <div class="log-details">
          <div class="log-title">
            ${serialHtml}
            ${titleContent}
            ${shiftInfo}
          </div>
          <div class="log-subtitle">
            ${type}${additionalInfo} at ${log.time || "N/A"}
            ${tagsHtml}
          </div>
        </div>
        <div class="log-amount" ${color}>${amountDisplay}</div>
      </div>
    `;
  }

  // Get transaction tags for a log entry
  getTransactionTags(log, logType) {
    const tags = [];

    // PRIORITY 1: Refund (highest priority - overrides everything)
    if (
      logType === "refunds" ||
      log.transaction_type === "refund" ||
      log.transaction_type === "checkout_refund"
    ) {
      tags.push({
        text: "REFUND",
        class: "transaction-tag refund-tag",
        color: "#dc3545",
      });
      return tags; // Return early - refunds don't get other tags
    }

    // PRIORITY 2: Expenses (but don't add tags for cleaner display)
    if (logType === "expenses") {
      return tags; // Return empty tags for expenses - cleaner display
    }

    // PRIORITY 3: Service/Add-on (third priority - overrides continue)
    if (log.item || log.transaction_type === "service") {
      tags.push({
        text: "SERVICE",
        class: "transaction-tag service-tag",
        color: "#ffc107",
      });
      return tags; // Return early - services don't get other tags
    }

    // PRIORITY 4: Booking transactions
    if (
      log.booking_id ||
      log.type === "booking_advance" ||
      log.type === "booking_payment" ||
      log.type === "booking_final_payment"
    ) {
      tags.push({
        text: "BOOKING",
        class: "transaction-tag booking-tag",
        color: "#6f42c1",
      });
      return tags; // Return early - bookings don't get other tags
    }

    // PRIORITY 5: Pay Later
    if (
      log.payment_method === "pay_later" ||
      (log.amount === 0 && log.is_fresh_checkin)
    ) {
      tags.push({
        text: "PAY LATER",
        class: "transaction-tag pay-later-tag",
        color: "#fd7e14",
      });
      return tags; // Return early
    }

    // PRIORITY 6: Continue/Renewal (only if none of the above)
    let isRenewal = false;

    // Method 1: Direct flags
    if (log.is_renewal === true || log.transaction_type === "renewal_payment") {
      isRenewal = true;
    }

    // Method 2: Date comparison (only for non-service, non-refund transactions)
    if (
      !isRenewal &&
      log.room &&
      log.date &&
      rooms[log.room] &&
      rooms[log.room].checkin_time
    ) {
      try {
        const checkinDate = rooms[log.room].checkin_time.split(" ")[0];
        const logDate = log.date;

        if (checkinDate !== logDate) {
          isRenewal = true;
        }
      } catch (error) {
        // Ignore error
      }
    }

    // Add CONTINUE tag only if it's a renewal
    if (isRenewal) {
      tags.push({
        text: "CONTINUE",
        class: "transaction-tag continue-tag",
        color: "#28a745",
      });
    }

    return tags;
  }

  // Check if transaction is renewal based on timing
  isRenewalBasedOnTiming(log) {
    if (!log.room || !log.date || !rooms[log.room]) {
      return false;
    }

    const room = rooms[log.room];
    if (!room.checkin_time || !room.guest) {
      return false;
    }

    try {
      // Parse check-in date
      const checkinDate = new Date(room.checkin_time.split(" ")[0]);
      const logDate = new Date(log.date);

      // If payment is on a different date than check-in, it's likely a renewal
      const daysDiff = Math.floor(
        (logDate - checkinDate) / (1000 * 60 * 60 * 24)
      );

      // If payment is 1 or more days after check-in, it's a renewal
      return daysDiff >= 1;
    } catch (error) {
      console.error("Error checking renewal timing:", error);
      return false;
    }
  }

  // Get log serial number for display
  getLogSerialNumber(log) {
    // Rule 1: Only show serial for fresh check-ins on the same day
    if (!log.is_fresh_checkin && log.transaction_type !== "fresh_checkin") {
      return null;
    }

    // Rule 2: Never show serial for services, refunds, or renewals
    if (
      log.item ||
      log.transaction_type === "service" ||
      log.transaction_type === "refund" ||
      log.is_renewal ||
      log.transaction_type === "renewal_payment"
    ) {
      return null;
    }

    // Rule 3: Only show serial if we have one
    if (log.serial_number) {
      return log.serial_number;
    }

    return null;
  }

  // Update payment logs in checkout modal
  updatePaymentLogs(roomNumber) {
    const paymentLogsContainer = document.getElementById(
      "checkout-payment-logs"
    );
    if (!paymentLogsContainer) {
      console.log("Payment logs container not found");
      return;
    }

    // Show loading indicator
    paymentLogsContainer.innerHTML = `<div class="loading-indicator"><span class="loader"></span></div>`;

    // Get all payments for this room and current occupancy only
    const roomInfo = rooms[roomNumber];
    if (!roomInfo || !roomInfo.guest || !roomInfo.checkin_time) {
      paymentLogsContainer.innerHTML =
        '<div class="log-item">No payments recorded</div>';
      return;
    }

    setTimeout(() => {
      // Get current check-in time to filter logs for current occupancy only
      const currentCheckinTime = new Date(roomInfo.checkin_time);

      // Filter payments for current guest only, and after current check-in
      const cashPayments = logs.cash.filter((log) => {
        // Must match room and guest name
        if (log.room !== roomNumber || log.name !== roomInfo.guest.name) {
          return false;
        }

        // If log has date/time information, make sure it's after check-in
        if (log.date && log.time) {
          const logTime = new Date(`${log.date} ${log.time}`);
          return logTime >= currentCheckinTime;
        }

        // If no date/time info, include by default
        return true;
      });

      const onlinePayments = logs.online.filter((log) => {
        // Similar filtering logic as cash payments
        if (log.room !== roomNumber || log.name !== roomInfo.guest.name) {
          return false;
        }

        if (log.date && log.time) {
          const logTime = new Date(`${log.date} ${log.time}`);
          return logTime >= currentCheckinTime;
        }

        return true;
      });

      const refundPayments = (logs.refunds || []).filter((log) => {
        // Similar filtering logic
        if (log.room !== roomNumber || log.name !== roomInfo.guest.name) {
          return false;
        }

        if (log.date && log.time) {
          const logTime = new Date(`${log.date} ${log.time}`);
          return logTime >= currentCheckinTime;
        }

        return true;
      });

      // Filter add-ons based on check-in time
      const addOnPayments = (logs.add_ons || []).filter((log) => {
        // Similar filtering logic
        if (log.room !== roomNumber) {
          return false;
        }

        if (log.date && log.time) {
          const logTime = new Date(`${log.date} ${log.time}`);
          return logTime >= currentCheckinTime;
        }

        return true;
      });

      // Add discount logs
      const discountLogs = (logs.discounts || []).filter((log) => {
        if (log.room !== roomNumber || log.name !== roomInfo.guest.name) {
          return false;
        }

        if (log.date && log.time) {
          const logTime = new Date(`${log.date} ${log.time}`);
          return logTime >= currentCheckinTime;
        }

        return true;
      });

      // Create a map to track processed transactions to avoid duplicates
      const processedTransactions = new Map();

      // Combine all payments and sort by time (most recent first)
      const allPayments = [
        ...cashPayments,
        ...onlinePayments,
        ...refundPayments,
        ...addOnPayments,
        ...discountLogs,
      ].sort((a, b) => {
        const dateA = a.date
          ? new Date(`${a.date} ${a.time || "00:00"}`)
          : new Date(0);
        const dateB = b.date
          ? new Date(`${b.date} ${b.time || "00:00"}`)
          : new Date(0);
        return dateB - dateA; // Most recent first
      });

      if (allPayments.length === 0) {
        paymentLogsContainer.innerHTML =
          '<div class="log-item">No payments recorded</div>';
        return;
      }

      let logsHtml = "";
      allPayments.forEach((payment) => {
        let paymentType,
          colorStyle = "",
          amountText = "",
          paymentMethod = "";

        // Create a unique key for this transaction to avoid duplicates
        // Use timestamp, amount and item (if exists) to identify unique transactions
        const transactionKey = `${payment.date}-${payment.time}-${
          payment.amount || payment.price
        }-${payment.item || ""}-${payment.reason || ""}`;

        // Skip if we've already processed this transaction
        if (processedTransactions.has(transactionKey)) {
          return;
        }

        processedTransactions.set(transactionKey, true);

        if (cashPayments.includes(payment)) {
          // Check if this is a service payment (has an item property)
          if (payment.item) {
            paymentType = `Add-on: ${payment.item}`;
            colorStyle = "style='color: var(--warning)'";
            paymentMethod = `<span class="service-payment-badge cash">cash</span>`;
            amountText = `₹${payment.amount}`;
          } else {
            paymentType = "Cash Payment";
            amountText = `₹${payment.amount}`;
          }
        } else if (onlinePayments.includes(payment)) {
          // Check if this is a service payment (has an item property)
          if (payment.item) {
            paymentType = `Add-on: ${payment.item}`;
            colorStyle = "style='color: var(--warning)'";
            paymentMethod = `<span class="service-payment-badge online">online</span>`;
            amountText = `₹${payment.amount}`;
          } else {
            paymentType = "Online Payment";
            amountText = `₹${payment.amount}`;
          }
        } else if (refundPayments.includes(payment)) {
          paymentType = "Refund";
          colorStyle = "style='color: var(--danger)'";
          amountText = `₹${payment.amount}`;
        } else if (addOnPayments.includes(payment)) {
          paymentType = `Add-on: ${payment.item}`;
          colorStyle = "style='color: var(--warning)'";
          amountText = `₹${payment.price}`;

          // Add payment method badge for balance add-ons
          if (payment.payment_method) {
            const badgeClass = payment.payment_method;
            paymentMethod = `<span class="service-payment-badge ${badgeClass}">${payment.payment_method}</span>`;
          } else {
            paymentMethod = `<span class="service-payment-badge balance">balance</span>`;
          }
        } else if (discountLogs.includes(payment)) {
          // Add discount information
          paymentType = `Discount: ${payment.reason || ""}`;
          colorStyle = "style='color: var(--success)'";
          amountText = `₹${payment.amount}`;
        }

        logsHtml += `
          <div class="log-item">
            <div class="log-details">
              <div class="log-title">${paymentType}${paymentMethod}</div>
              <div class="log-subtitle">${payment.time || "N/A"} on ${
          payment.date || "N/A"
        }</div>
            </div>
            <div class="log-amount" ${colorStyle}>${amountText}</div>
          </div>
        `;
      });

      paymentLogsContainer.innerHTML = logsHtml;
    }, 300);
  }
}

// CSS styles for transaction tags
const transactionTrackingStyles = `
    .transaction-tag {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.7rem;
        font-weight: bold;
        color: white;
        margin-left: 5px;
        text-transform: uppercase;
    }

    .booking-tag {
        background-color: #6f42c1;
    }

    .continue-tag {
        background-color: #28a745;
    }

    .service-tag {
        background-color: #ffc107;
        color: #333;
    }

    .refund-tag {
        background-color: #dc3545;
    }

    .expense-tag {
        background-color: #e74c3c;
    }

    .pay-later-tag {
        background-color: #fd7e14;
    }

    .serial-number {
        display: inline-block;
        background-color: #007bff;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.7rem;
        font-weight: bold;
        margin-right: 8px;
    }

    .room-shifted-badge {
        background-color: #17a2b8;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.7rem;
        margin-left: 5px;
    }

    .log-title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
    }

    .log-subtitle {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 3px;
    }

    .service-payment-badge {
        display: inline-block;
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 0.6rem;
        font-weight: bold;
        text-transform: uppercase;
        margin-left: 5px;
    }

    .service-payment-badge.cash {
        background-color: #28a745;
        color: white;
    }

    .service-payment-badge.online {
        background-color: #007bff;
        color: white;
    }

    .service-payment-badge.balance {
        background-color: #6c757d;
        color: white;
    }

    .log-date-header {
        font-weight: bold;
        color: var(--primary);
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--border);
        margin-bottom: 0.5rem;
        text-align: left;
    }

    .log-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0.75rem;
        border-bottom: 1px solid var(--border);
        background: var(--card-bg);
        margin-bottom: 0.25rem;
        border-radius: 8px;
    }

    .log-details {
        flex: 1;
        min-width: 0;
    }

    .log-amount {
        font-weight: bold;
        white-space: nowrap;
        margin-left: 1rem;
    }

    @media (max-width: 576px) {
        .transaction-tag,
        .serial-number,
        .service-payment-badge {
            font-size: 0.65rem;
            padding: 1px 4px;
        }
        
        .log-title,
        .log-subtitle {
            gap: 3px;
        }

        .log-item {
            padding: 0.5rem;
        }
    }
`;

// Add styles to the page
function addTransactionTrackingStyles() {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = transactionTrackingStyles;
  document.head.appendChild(styleSheet);
}

// Global instances
let transactionTracker;
let transactionLogManager;

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  transactionTracker = new TransactionTracker();
  transactionLogManager = new TransactionLogManager(transactionTracker);

  transactionTracker.initialize();
  addTransactionTrackingStyles();

  console.log("Transaction tracking and log management system initialized");
});

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TransactionTracker,
    TransactionLogManager,
    transactionTracker,
    transactionLogManager,
  };
}

// Global functions for backward compatibility
window.renderEnhancedLogs = function () {
  if (transactionLogManager) {
    transactionLogManager.renderEnhancedLogs();
  }
};

window.updatePaymentLogs = function (roomNumber) {
  if (transactionLogManager) {
    transactionLogManager.updatePaymentLogs(roomNumber);
  }
};
