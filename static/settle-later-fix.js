(function () {
  // Wait for all scripts to load
  window.addEventListener("load", function () {
    // Enhanced proceed checkout handler with proper refund validation
    const originalProceedCheckoutBtn = document.getElementById(
      "proceed-checkout-btn"
    );

    if (originalProceedCheckoutBtn) {
      // Remove all existing event listeners
      const newProceedBtn = originalProceedCheckoutBtn.cloneNode(true);
      originalProceedCheckoutBtn.parentNode.replaceChild(
        newProceedBtn,
        originalProceedCheckoutBtn
      );

      // Add enhanced event listener with refund validation
      newProceedBtn.addEventListener("click", async function () {
        console.log("Enhanced proceed checkout clicked");

        // Prevent multiple calls
        if (typeof checkoutInProgress !== "undefined" && checkoutInProgress) {
          console.log("Checkout already in progress, ignoring proceed click");
          return;
        }

        if (typeof checkoutInProgress !== "undefined") {
          checkoutInProgress = true;
        }

        // Disable button and show loading state
        this.disabled = true;
        this.innerHTML =
          '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

        const roomNumberElement = document.getElementById(
          "checkout-room-number"
        );
        if (!roomNumberElement) {
          showNotification("Room number element not found", "error");
          console.error("Room number element not found during checkout");
          this.resetButton();
          return;
        }

        const roomNumber = roomNumberElement.textContent;
        const balance = rooms[roomNumber].balance;

        // Check if settle later is enabled
        const settleLaterEnabled =
          document.getElementById("settle-later-checkbox")?.checked || false;
        const settlementNotes =
          document.getElementById("settlement-notes")?.value || "";

        console.log(`Balance: ${balance}, Settle Later: ${settleLaterEnabled}`);

        // *** ENHANCED BALANCE VALIDATION ***

        // 1. STRICT BLOCKING for positive balance without settle later
        if (balance > 0 && !settleLaterEnabled) {
          console.log(
            "Checkout blocked - positive balance without settle later"
          );
          showNotification(
            `Cannot checkout with pending balance of ₹${balance}. Please clear all dues first or use 'Settle Later' option.`,
            "error"
          );
          this.resetButton();
          this.closeConfirmationModal();
          return;
        }

        // 2. STRICT BLOCKING for negative balance (refunds) - NO EXCEPTIONS
        if (balance < 0) {
          console.log("Checkout blocked - refund pending");
          showNotification(
            `Cannot checkout with pending refund of ₹${Math.abs(
              balance
            )}. Please process the refund first.`,
            "error"
          );
          this.resetButton();
          this.closeConfirmationModal();
          return;
        }

        // *** END OF ENHANCED VALIDATION ***

        // Get refund method if there's a negative balance (shouldn't reach here due to validation above)
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
            this.closeConfirmationModal();
            const checkoutModal = document.getElementById("checkout-modal");
            if (checkoutModal) {
              checkoutModal.classList.remove("show");
            }

            await fetchData();

            // Show appropriate success message
            if (settleLaterEnabled && balance > 0) {
              showNotification(
                `Checkout completed with 'Settle Later' option. Payment of ₹${balance} added to pending settlements.`,
                "success"
              );
            }
          } else {
            console.error("Checkout failed:", result.message);
            showNotification(
              result.message || "Error during checkout",
              "error"
            );
          }
        } catch (error) {
          console.error("Error during checkout:", error);
          showNotification(`Error during checkout: ${error.message}`, "error");
        } finally {
          this.resetButton();
        }
      });

      // Add helper methods to the button element
      newProceedBtn.resetButton = function () {
        if (typeof checkoutInProgress !== "undefined") {
          checkoutInProgress = false;
        }
        this.disabled = false;
        this.innerHTML = "Yes, Checkout";
      };

      newProceedBtn.closeConfirmationModal = function () {
        const checkoutConfirmModal = document.getElementById(
          "checkout-confirm-modal"
        );
        if (checkoutConfirmModal) {
          checkoutConfirmModal.classList.remove("show");
        }
      };
    }

    console.log("Enhanced checkout validation applied successfully!");
  });
})();

// Additional validation for the main checkout button (confirm-checkout-btn)
(function () {
  window.addEventListener("load", function () {
    const confirmCheckoutBtn = document.getElementById("confirm-checkout-btn");

    if (confirmCheckoutBtn) {
      // Remove existing listeners and add enhanced one
      const newBtn = confirmCheckoutBtn.cloneNode(true);
      confirmCheckoutBtn.parentNode.replaceChild(newBtn, confirmCheckoutBtn);

      newBtn.addEventListener("click", function (event) {
        event.preventDefault();

        const roomNumberElement = document.getElementById(
          "checkout-room-number"
        );
        if (!roomNumberElement) {
          showNotification("Room number element not found", "error");
          return;
        }

        const roomNumber = roomNumberElement.textContent;
        const balance = rooms[roomNumber].balance;

        // Pre-validation before showing confirmation modal
        if (balance < 0) {
          showNotification(
            `Cannot proceed to checkout with pending refund of ₹${Math.abs(
              balance
            )}. Please process the refund first.`,
            "error"
          );
          return;
        }

        // Continue with normal confirmation modal display
        const guestNameElement = document.getElementById("checkout-guest-name");
        const guestName = guestNameElement
          ? guestNameElement.textContent
          : "Unknown";

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
        if (confirmGuestElement) confirmGuestElement.textContent = guestName;

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
            const settlementNotes = document.getElementById("settlement-notes");
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
          console.log("Confirmation modal displayed with enhanced validation");
        }
      });
    }
  });
})();
