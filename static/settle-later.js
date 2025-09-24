// Global variables
let pendingSettlements = [];
let currentSettlementFilter = "pending";
let activeSettlementId = null;
let settlementPaymentMethod = "cash";

// Initialize the settle later functionality
function initSettleLater() {
  // 1. Initialize event listeners for settle later checkbox in checkout confirmation
  const settleLaterCheckbox = document.getElementById("settle-later-checkbox");
  const settlementNotesContainer = document.getElementById(
    "settlement-notes-container"
  );

  if (settleLaterCheckbox && settlementNotesContainer) {
    settleLaterCheckbox.addEventListener("change", function () {
      settlementNotesContainer.style.display = this.checked ? "block" : "none";
    });
  }

  // 2. Modify the proceed-checkout-btn click handler
  const originalProceedCheckoutBtn = document.getElementById(
    "proceed-checkout-btn"
  );

  if (originalProceedCheckoutBtn) {
    // Save the original onclick handler if it exists
    const originalClickHandler = originalProceedCheckoutBtn.onclick;

    // Replace with new handler that includes "settle later" logic
    originalProceedCheckoutBtn.onclick = async function () {
      console.log("Proceed checkout clicked with settle later handler");

      // Disable button and show loading state
      this.disabled = true;
      this.innerHTML =
        '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

      const roomNumberElement = document.getElementById("checkout-room-number");
      if (!roomNumberElement) {
        showNotification("Room number element not found", "error");
        console.error("Room number element not found during checkout");
        return;
      }

      const roomNumber = roomNumberElement.textContent;
      const balance = rooms[roomNumber].balance;

      // Check if settle later is enabled
      const settleLaterEnabled =
        document.getElementById("settle-later-checkbox")?.checked || false;
      const settlementNotes =
        document.getElementById("settlement-notes")?.value || "";

      // Get refund method if there's a negative balance
      const refundMethod =
        balance < 0
          ? document.querySelector(".refund-container .payment-btn.active")
              ?.id === "refund-cash-btn"
            ? "cash"
            : "online"
          : null;

      try {
        console.log("Sending checkout request to server");
        const response = await fetch("/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room: roomNumber,
            final_checkout: true,
            refund_method: refundMethod,
            settle_later: settleLaterEnabled,
            settlement_notes: settlementNotes,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          console.log("Checkout successful");
          // Close both modals
          const checkoutConfirmModal = document.getElementById(
            "checkout-confirm-modal"
          );
          if (checkoutConfirmModal) {
            checkoutConfirmModal.classList.remove("show");
          }

          const checkoutModal = document.getElementById("checkout-modal");
          if (checkoutModal) {
            checkoutModal.classList.remove("show");
          }

          await fetchData();

          // If settled later, let the user know
          if (settleLaterEnabled && balance > 0) {
          } else {
            showNotification("Checkout successful!", "success");
          }
        } else {
          console.error("Checkout failed:", result.message);
          showNotification(result.message || "Error during checkout", "error");
        }
      } catch (error) {
        console.error("Error during checkout:", error);
        showNotification(`Error during checkout: ${error.message}`, "error");
      } finally {
        // Re-enable button
        this.disabled = false;
        this.innerHTML = "Yes, Checkout";
      }
    };
  }

  // 3. Initialize the quick actions button for pending settlements
  const quickSettlementsBtn = document.getElementById("quick-settlements-btn");
  if (quickSettlementsBtn) {
    quickSettlementsBtn.addEventListener("click", function () {
      showPendingSettlementsModal();

      // Close quick actions menu
      const quickActionMenu = document.querySelector(".quick-action-menu");
      if (quickActionMenu) {
        quickActionMenu.classList.remove("show");
      }
    });
  }

  // 4. Initialize filter buttons in pending settlements modal
  const settlementFilterBtns = document.querySelectorAll(
    "#pending-settlements-modal .filter-btn"
  );
  if (settlementFilterBtns.length > 0) {
    settlementFilterBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        // Update active filter
        settlementFilterBtns.forEach((b) => b.classList.remove("active"));
        this.classList.add("active");

        // Update filter and refresh display
        currentSettlementFilter = this.dataset.filter;
        renderPendingSettlements();
      });
    });
  }

  // 5. Initialize payment method buttons in collect settlement modal
  const settlementPaymentBtns = document.querySelectorAll(
    "#collect-settlement-modal .payment-btn"
  );
  if (settlementPaymentBtns.length > 0) {
    settlementPaymentBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        // Update active payment method
        settlementPaymentBtns.forEach((b) => b.classList.remove("active"));
        this.classList.add("active");

        // Update payment method
        settlementPaymentMethod = this.dataset.payment;
        document.getElementById("settlement-payment-method").value =
          settlementPaymentMethod;
      });
    });
  }

  // 6. Initialize the collect payment button
  const collectPaymentBtn = document.getElementById("collect-payment-btn");
  if (collectPaymentBtn) {
    collectPaymentBtn.addEventListener("click", collectSettlementPayment);
  }

  // 7. Initialize the cancel settlement button
  const cancelSettlementBtn = document.getElementById("cancel-settlement-btn");
  if (cancelSettlementBtn) {
    cancelSettlementBtn.addEventListener(
      "click",
      showCancelSettlementConfirmation
    );
  }

  // 8. Initialize close buttons for all settlement modals
  document
    .querySelectorAll(
      "#pending-settlements-modal .close-btn, #collect-settlement-modal .close-btn"
    )
    .forEach((btn) => {
      btn.addEventListener("click", function () {
        const modal = this.closest(".modal-backdrop");
        if (modal) {
          modal.classList.remove("show");
        }
      });
    });

  // 9. Initialize discount features
  initDiscountFeatures();

  console.log("Settle Later feature initialized");
}

// Initialize discount features
function initDiscountFeatures() {
  const discountAmountInput = document.getElementById(
    "settlement-discount-amount"
  );
  const discountReasonContainer = document.getElementById(
    "settlement-discount-reason-container"
  );
  const discountReasonSelect = document.getElementById(
    "settlement-discount-reason"
  );
  const otherReasonContainer = document.getElementById(
    "settlement-other-reason-container"
  );

  if (discountAmountInput && discountReasonContainer) {
    discountAmountInput.addEventListener("input", function () {
      if (parseInt(this.value) > 0) {
        discountReasonContainer.style.display = "block";
      } else {
        discountReasonContainer.style.display = "none";
      }
    });
  }

  if (discountReasonSelect && otherReasonContainer) {
    discountReasonSelect.addEventListener("change", function () {
      if (this.value === "Other") {
        otherReasonContainer.style.display = "block";
      } else {
        otherReasonContainer.style.display = "none";
      }
    });
  }
}

// Modify setupCheckoutConfirmation function to handle balance display in the confirmation
function enhanceCheckoutConfirmation() {
  // Override the original function if it exists
  if (typeof setupCheckoutConfirmation === "function") {
    console.log("Enhancing checkout confirmation function");

    const originalSetupCheckoutConfirmation = setupCheckoutConfirmation;

    window.setupCheckoutConfirmation = function () {
      // Call the original function first
      originalSetupCheckoutConfirmation();

      // Add our enhancements to show balance in confirmation modal
      const confirmCheckoutBtn = document.getElementById(
        "confirm-checkout-btn"
      );

      if (confirmCheckoutBtn) {
        // Override the click event handler
        confirmCheckoutBtn.addEventListener(
          "click",
          function (event) {
            // Prevent default action if any
            event.preventDefault();

            // Stop other event handlers
            event.stopImmediatePropagation();

            const roomNumberElement = document.getElementById(
              "checkout-room-number"
            );
            const guestNameElement = document.getElementById(
              "checkout-guest-name"
            );

            if (!roomNumberElement) {
              showNotification("Room number element not found", "error");
              console.error("Room number element not found");
              return;
            }

            const roomNumber = roomNumberElement.textContent;
            const guestName = guestNameElement
              ? guestNameElement.textContent
              : "Unknown";
            const balance = rooms[roomNumber].balance;

            // Set the room and guest name in the confirmation modal
            const confirmRoomElement = document.getElementById(
              "confirm-checkout-room"
            );
            const confirmGuestElement = document.getElementById(
              "confirm-checkout-guest"
            );
            const confirmBalanceElement = document.getElementById(
              "confirm-checkout-balance"
            );
            const balanceContainer = document.getElementById(
              "checkout-balance-container"
            );

            if (confirmRoomElement) confirmRoomElement.textContent = roomNumber;
            if (confirmGuestElement)
              confirmGuestElement.textContent = guestName;

            // Show balance information if there's a positive balance
            if (balanceContainer && confirmBalanceElement) {
              if (balance > 0) {
                confirmBalanceElement.textContent = balance;
                balanceContainer.style.display = "block";

                // Reset the settle later checkbox
                const settleLaterCheckbox = document.getElementById(
                  "settle-later-checkbox"
                );
                if (settleLaterCheckbox) {
                  settleLaterCheckbox.checked = false;
                }

                // Hide the notes container
                const settlementNotesContainer = document.getElementById(
                  "settlement-notes-container"
                );
                if (settlementNotesContainer) {
                  settlementNotesContainer.style.display = "none";
                }

                // Clear the notes field
                const settlementNotes =
                  document.getElementById("settlement-notes");
                if (settlementNotes) {
                  settlementNotes.value = "";
                }
              } else {
                balanceContainer.style.display = "none";
              }
            }

            // Show the confirmation modal
            const checkoutConfirmModal = document.getElementById(
              "checkout-confirm-modal"
            );
            if (checkoutConfirmModal) {
              checkoutConfirmModal.classList.add("show");
              console.log("Confirmation modal displayed");
            } else {
              console.error("Confirmation modal element not found");
              showNotification("Error: Confirmation modal not found", "error");
            }
          },
          true
        ); // Use capture to override other handlers
      }
    };
  }
}

// Fetch pending settlements from the server
async function fetchPendingSettlements() {
  try {
    const response = await fetch("/get_pending_settlements");
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      pendingSettlements = result.settlements || [];
      return true;
    } else {
      console.error("Failed to fetch pending settlements:", result.message);
      return false;
    }
  } catch (error) {
    console.error("Error fetching pending settlements:", error);
    showNotification(
      `Error fetching pending settlements: ${error.message}`,
      "error"
    );
    return false;
  }
}

// Show the pending settlements modal
async function showPendingSettlementsModal() {
  const modal = document.getElementById("pending-settlements-modal");
  if (!modal) {
    console.error("Pending settlements modal not found");
    return;
  }

  // Show the modal
  modal.classList.add("show");

  // Set default filter to pending
  currentSettlementFilter = "pending";

  // Set active filter button
  document
    .querySelectorAll("#pending-settlements-modal .filter-btn")
    .forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.filter === currentSettlementFilter) {
        btn.classList.add("active");
      }
    });

  // Show loading indicator
  const settlementsList = document.getElementById("settlements-list");
  if (settlementsList) {
    settlementsList.innerHTML = `
      <div class="loading-indicator">
        <span class="loader"></span>
        <p>Loading pending settlements...</p>
      </div>
    `;
  }

  // Fetch and render settlements
  await fetchPendingSettlements();
  renderPendingSettlements();
}

// Show the collect settlement modal
function showCollectSettlementModal(settlementId) {
  // Find the settlement
  const settlement = pendingSettlements.find((s) => s.id === settlementId);
  if (!settlement) {
    showNotification("Settlement not found", "error");
    return;
  }

  // Set the active settlement ID
  activeSettlementId = settlementId;

  // Get modal elements
  const modal = document.getElementById("collect-settlement-modal");
  const guestNameEl = document.getElementById("settlement-guest-name");
  const mobileEl = document.getElementById("settlement-mobile-number");
  const mobileLinkEl = document.getElementById("settlement-guest-mobile");
  const checkoutDateEl = document.getElementById("settlement-checkout-date");
  const roomEl = document.getElementById("settlement-room");
  const amountEl = document.getElementById("settlement-amount");
  const notesEl = document.getElementById("settlement-notes");
  const photoContainerEl = document.getElementById(
    "settlement-photo-container"
  );
  const photoEl = document.getElementById("settlement-guest-photo");

  // Get payment and discount inputs
  const paymentAmountInput = document.getElementById(
    "settlement-payment-amount"
  );
  const discountAmountInput = document.getElementById(
    "settlement-discount-amount"
  );
  const discountReasonContainer = document.getElementById(
    "settlement-discount-reason-container"
  );

  // Update modal content
  if (guestNameEl) guestNameEl.textContent = settlement.guest_name;
  if (mobileEl) mobileEl.textContent = settlement.guest_mobile;
  if (mobileLinkEl) mobileLinkEl.href = `tel:${settlement.guest_mobile}`;
  if (checkoutDateEl) checkoutDateEl.textContent = settlement.checkout_date;
  if (roomEl) roomEl.textContent = settlement.room;
  if (amountEl) amountEl.textContent = `₹${settlement.amount}`;
  if (notesEl) notesEl.textContent = settlement.notes || "-";

  // Reset payment and discount inputs
  if (paymentAmountInput) {
    paymentAmountInput.value = settlement.amount;
    paymentAmountInput.max = settlement.amount;
  }

  if (discountAmountInput) {
    discountAmountInput.value = "0";
    discountAmountInput.max = settlement.amount;
  }

  if (discountReasonContainer) {
    discountReasonContainer.style.display = "none";
  }

  // Display guest photo if available
  if (photoContainerEl && photoEl) {
    if (settlement.photo) {
      photoEl.src = settlement.photo;
      photoContainerEl.style.display = "block";
    } else {
      photoContainerEl.style.display = "none";
    }
  }

  // Reset payment method to cash
  settlementPaymentMethod = "cash";
  document
    .querySelectorAll("#collect-settlement-modal .payment-btn")
    .forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.payment === "cash") {
        btn.classList.add("active");
      }
    });

  if (document.getElementById("settlement-payment-method")) {
    document.getElementById("settlement-payment-method").value = "cash";
  }

  // Show the modal
  if (modal) {
    modal.classList.add("show");
  }
}

// Process settlement payment collection
async function collectSettlementPayment() {
  if (!activeSettlementId) {
    showNotification("No active settlement selected", "error");
    return;
  }

  // Find the settlement
  const settlement = pendingSettlements.find(
    (s) => s.id === activeSettlementId
  );
  if (!settlement) {
    showNotification("Settlement not found", "error");
    return;
  }

  // Get payment amount
  const paymentAmountInput = document.getElementById(
    "settlement-payment-amount"
  );
  let paymentAmount = 0;
  if (paymentAmountInput && paymentAmountInput.value) {
    paymentAmount = parseInt(paymentAmountInput.value);
  }

  // Get discount amount and reason
  const discountAmountInput = document.getElementById(
    "settlement-discount-amount"
  );
  const discountReasonSelect = document.getElementById(
    "settlement-discount-reason"
  );
  const otherReasonInput = document.getElementById(
    "settlement-other-discount-reason"
  );

  let discountAmount = 0;
  let discountReason = "";

  if (discountAmountInput && parseInt(discountAmountInput.value) > 0) {
    discountAmount = parseInt(discountAmountInput.value);

    if (discountReasonSelect) {
      if (
        discountReasonSelect.value === "Other" &&
        otherReasonInput &&
        otherReasonInput.value
      ) {
        discountReason = otherReasonInput.value;
      } else {
        discountReason = discountReasonSelect.value;
      }
    }
  }

  // Validation
  if (discountAmount > settlement.amount) {
    showNotification(
      `Discount amount (₹${discountAmount}) exceeds settlement amount (₹${settlement.amount})`,
      "error"
    );
    return;
  }

  const effectiveAmount = settlement.amount - discountAmount;

  if (paymentAmount > effectiveAmount) {
    showNotification(
      `Payment amount (₹${paymentAmount}) exceeds settlement amount after discount (₹${effectiveAmount})`,
      "error"
    );
    return;
  }

  // Get the button and disable it
  const collectBtn = document.getElementById("collect-payment-btn");
  if (!collectBtn) {
    showNotification("Collect payment button not found", "error");
    return;
  }

  // Show loading state
  collectBtn.disabled = true;
  collectBtn.innerHTML =
    '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

  try {
    // Call API to collect payment
    const response = await fetch("/collect_settlement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settlement_id: activeSettlementId,
        payment_mode: settlementPaymentMethod,
        payment_amount: paymentAmount,
        discount_amount: discountAmount,
        discount_reason: discountReason,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Refresh settlements data
      await fetchPendingSettlements();

      // Close the collect modal
      const modal = document.getElementById("collect-settlement-modal");
      if (modal) {
        modal.classList.remove("show");
      }

      // Refresh the settlements display
      renderPendingSettlements();

      // Show success message
      showNotification(
        result.message || "Payment collected successfully",
        "success"
      );
    } else {
      showNotification(result.message || "Failed to collect payment", "error");
    }
  } catch (error) {
    console.error("Error collecting payment:", error);
    showNotification(`Error collecting payment: ${error.message}`, "error");
  } finally {
    // Restore button state
    collectBtn.disabled = false;
    collectBtn.innerHTML = "Collect Payment";
  }
}

// Show confirmation before cancelling a settlement
function showCancelSettlementConfirmation() {
  if (!activeSettlementId) {
    showNotification("No active settlement selected", "error");
    return;
  }

  // Find the settlement
  const settlement = pendingSettlements.find(
    (s) => s.id === activeSettlementId
  );
  if (!settlement) {
    showNotification("Settlement not found", "error");
    return;
  }

  // Ask for confirmation
  if (
    confirm(
      `Are you sure you want to cancel the pending payment of ₹${settlement.amount} from ${settlement.guest_name}?`
    )
  ) {
    cancelSettlement();
  }
}

// Cancel a settlement
async function cancelSettlement() {
  if (!activeSettlementId) {
    showNotification("No active settlement selected", "error");
    return;
  }

  // Get the button and disable it
  const cancelBtn = document.getElementById("cancel-settlement-btn");
  if (!cancelBtn) {
    showNotification("Cancel settlement button not found", "error");
    return;
  }

  // Show loading state
  cancelBtn.disabled = true;
  cancelBtn.innerHTML =
    '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

  try {
    // Ask for reason in a simple prompt
    const reason = prompt(
      "Please enter a reason for cancelling this settlement:"
    );

    if (reason === null) {
      // User clicked cancel on the prompt
      throw new Error("Cancellation aborted by user");
    }

    // Call API to cancel settlement
    const response = await fetch("/cancel_settlement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settlement_id: activeSettlementId,
        reason: reason || "No reason provided",
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Refresh settlements data
      await fetchPendingSettlements();

      // Close the collect modal
      const modal = document.getElementById("collect-settlement-modal");
      if (modal) {
        modal.classList.remove("show");
      }

      // Refresh the settlements display
      renderPendingSettlements();

      // Show success message
      showNotification(
        result.message || "Settlement cancelled successfully",
        "success"
      );
    } else {
      showNotification(
        result.message || "Failed to cancel settlement",
        "error"
      );
    }
  } catch (error) {
    console.error("Error cancelling settlement:", error);

    // Don't show notification if user cancelled the prompt
    if (error.message !== "Cancellation aborted by user") {
      showNotification(
        `Error cancelling settlement: ${error.message}`,
        "error"
      );
    }
  } finally {
    // Restore button state
    cancelBtn.disabled = false;
    cancelBtn.innerHTML = "Cancel Settlement";
  }
}

// Update dashboard to show pending settlements count
function updateDashboardWithSettlements() {
  const quickSettlementsBtn = document.getElementById("quick-settlements-btn");
  if (!quickSettlementsBtn) return;

  // Count pending settlements
  const pendingCount = pendingSettlements.filter(
    (s) => s.status === "pending" || s.status === "partial"
  ).length;

  if (pendingCount > 0) {
    quickSettlementsBtn.innerHTML = `
      <i class="fas fa-money-bill-wave"></i>
      <span>Pending Payments <span style="background-color: var(--warning); padding: 2px 6px; border-radius: 50%; margin-left: 5px; font-size: 0.7rem;">${pendingCount}</span></span>
    `;
  } else {
    quickSettlementsBtn.innerHTML = `
      <i class="fas fa-money-bill-wave"></i>
      <span>Pending Payments</span>
    `;
  }
}

// Add pending settlements amount to dashboard
function updateStatsWithSettlements() {
  // First, make sure we have a function to override
  if (typeof updateStats === "function") {
    const originalUpdateStats = updateStats;

    window.updateStats = function () {
      // Call the original function
      originalUpdateStats();

      // Add pending settlements total to the stats
      const pendingSettlementsTotal = pendingSettlements
        .filter((s) => s.status === "pending" || s.status === "partial")
        .reduce((total, s) => total + (s.amount || 0), 0);

      // Update the pending balance with pending settlements
      if (pendingBalance) {
        const currentBalance =
          parseInt(pendingBalance.textContent.replace("₹", "")) || 0;
        const totalWithSettlements = currentBalance + pendingSettlementsTotal;
        pendingBalance.textContent = "₹" + totalWithSettlements;
      }

      // Update the dashboard badge for pending settlements
      updateDashboardWithSettlements();
    };
  }
}

// Initialize during DOMContentLoaded
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(() => {
    initSettleLater();
    enhanceCheckoutConfirmation();

    // Fetch pending settlements on startup
    fetchPendingSettlements().then(() => {
      updateStatsWithSettlements();
      updateDashboardWithSettlements();
    });
  }, 1000);
});
// Render the pending settlements list
function renderPendingSettlements() {
  const settlementsList = document.getElementById("settlements-list");
  if (!settlementsList) {
    console.error("Settlements list element not found");
    return;
  }

  if (pendingSettlements.length === 0) {
    settlementsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-money-bill-wave fa-3x"></i>
        <p>No pending settlements found</p>
      </div>
    `;
    return;
  }

  // Filter settlements based on current filter
  let filteredSettlements = pendingSettlements;

  if (currentSettlementFilter !== "all") {
    filteredSettlements = pendingSettlements.filter(
      (s) => s.status === currentSettlementFilter
    );
  }

  if (filteredSettlements.length === 0) {
    settlementsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-filter fa-3x"></i>
        <p>No settlements found matching the current filter</p>
      </div>
    `;
    return;
  }

  // Sort by checkout date (most recent first)
  filteredSettlements.sort((a, b) => {
    const dateA = new Date(`${a.checkout_date} ${a.checkout_time || "00:00"}`);
    const dateB = new Date(`${b.checkout_date} ${b.checkout_time || "00:00"}`);
    return dateB - dateA;
  });

  // Generate HTML
  let html = "";

  filteredSettlements.forEach((settlement) => {
    // Get status badge
    let statusBadge = "";

    switch (settlement.status) {
      case "pending":
        statusBadge = `<span class="status-badge" style="background-color: var(--warning);">Pending</span>`;
        break;
      case "partial": // New status for partial payments
        statusBadge = `<span class="status-badge" style="background-color: var(--primary);">Partial</span>`;
        break;
      case "paid":
        statusBadge = `<span class="status-badge" style="background-color: var(--success);">Paid</span>`;
        break;
      case "cancelled":
        statusBadge = `<span class="status-badge" style="background-color: var(--danger);">Cancelled</span>`;
        break;
      default:
        statusBadge = `<span class="status-badge" style="background-color: var(--gray);">${settlement.status}</span>`;
    }

    // Create item HTML
    html += `
      <div class="settlement-item" data-id="${settlement.id}" data-status="${
      settlement.status
    }">
        <div class="settlement-header">
          <div class="settlement-guest">
            <strong>${settlement.guest_name}</strong>
            <a href="tel:${settlement.guest_mobile}" class="call-link">
              <i class="fas fa-phone"></i> ${settlement.guest_mobile}
            </a>
          </div>
          <div class="settlement-badges">
            ${statusBadge}
          </div>
        </div>
        <div class="settlement-details">
          <div class="settlement-info">
            <div><strong>Room:</strong> ${settlement.room}</div>
            <div><strong>Checkout:</strong> ${settlement.checkout_date}</div>
            <div><strong>Amount:</strong> ₹${settlement.amount}</div>
          </div>
          <div class="settlement-actions">
            ${
              settlement.status === "pending" || settlement.status === "partial"
                ? `<button class="action-btn btn-sm btn-success collect-btn" data-id="${settlement.id}">
                  <i class="fas fa-money-bill-wave"></i> Collect
                </button>`
                : settlement.status === "paid"
                ? `<div class="settlement-paid-info">
                  Paid on ${settlement.payment_date || "N/A"} via 
                  <span class="payment-badge ${settlement.payment_mode}">${
                    settlement.payment_mode || "unknown"
                  }</span>
                </div>`
                : `<div class="settlement-cancelled-info">
                  Cancelled on ${settlement.cancel_date || "N/A"}
                </div>`
            }
          </div>
        </div>
        ${
          // Show partial payments if they exist
          settlement.payments && settlement.payments.length > 0
            ? `<div class="settlement-payments">
                <div class="settlement-payments-title">Previous Payments</div>
                ${settlement.payments
                  .map(
                    (payment) => `
                  <div class="settlement-payment-item">
                    ₹${payment.amount} paid on ${payment.date} via 
                    <span class="payment-badge ${payment.mode}">${payment.mode}</span>
                  </div>
                `
                  )
                  .join("")}
              </div>`
            : ""
        }
        ${
          // Show discount if applied
          settlement.discount_amount > 0
            ? `<div class="settlement-discount">
                <div class="settlement-discount-title">Discount Applied</div>
                <div class="settlement-discount-info">
                  ₹${settlement.discount_amount} discount (${
                settlement.discount_reason || "No reason provided"
              })
                </div>
              </div>`
            : ""
        }
        ${
          settlement.notes
            ? `<div class="settlement-notes">
              <i class="fas fa-sticky-note"></i> ${settlement.notes}
            </div>`
            : ""
        }
      </div>
    `;
  });

  settlementsList.innerHTML = html;

  // Add click handlers for collect buttons
  document.querySelectorAll(".collect-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const settlementId = this.dataset.id;
      showCollectSettlementModal(settlementId);
    });
  });
}
