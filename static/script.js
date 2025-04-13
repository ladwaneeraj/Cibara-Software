// Global variables
let rooms = {};

// Camera functionality
function initCamera() {
  const cameraBtn = document.getElementById("camera-btn");
  const cameraContainer = document.getElementById("camera-container");
  const cameraFeed = document.getElementById("camera-feed");
  const captureBtn = document.getElementById("capture-photo-btn");
  const cancelCameraBtn = document.getElementById("cancel-camera-btn");
  const photoPreviewContainer = document.getElementById(
    "photo-preview-container"
  );
  const photoPreview = document.getElementById("photo-preview");
  const retakePhotoBtn = document.getElementById("retake-photo-btn");
  const fileInput = document.getElementById("guest-photo");

  if (!cameraBtn || !fileInput) {
    debugLog("Camera elements not found");
    return;
  }

  // File input change event
  fileInput.addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        if (photoPreview && photoPreviewContainer) {
          photoPreview.src = e.target.result;
          photoPreviewContainer.style.display = "block";
          capturedPhotoData = e.target.result;
        }

        // Upload the photo to server
        uploadPhoto(file);
      };
      reader.readAsDataURL(file);
    }
  });

  // Camera button click event
  cameraBtn.addEventListener("click", async function () {
    try {
      // Close camera first if it's already open
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      if (cameraFeed && cameraContainer) {
        cameraFeed.srcObject = mediaStream;
        cameraContainer.style.display = "block";
        if (photoPreviewContainer) {
          photoPreviewContainer.style.display = "none";
        }
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      showNotification(
        "Error accessing camera. Please check permissions.",
        "error"
      );
    }
  });

  // Capture photo button click event
  if (captureBtn) {
    captureBtn.addEventListener("click", function () {
      if (!cameraFeed) {
        debugLog("Camera feed element not found");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = cameraFeed.videoWidth;
      canvas.height = cameraFeed.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);

      capturedPhotoData = canvas.toDataURL("image/jpeg");

      if (photoPreview && photoPreviewContainer && cameraContainer) {
        photoPreview.src = capturedPhotoData;
        photoPreviewContainer.style.display = "block";
        cameraContainer.style.display = "none";
      }

      // Convert data URL to Blob
      const byteString = atob(capturedPhotoData.split(",")[1]);
      const mimeString = capturedPhotoData
        .split(",")[0]
        .split(":")[1]
        .split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });

      // Create a File from the Blob
      const file = new File([blob], "camera-capture.jpg", {
        type: "image/jpeg",
      });

      // Upload the photo
      uploadPhoto(file);

      // Stop camera stream
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
    });
  }

  // Cancel camera button click event
  if (cancelCameraBtn) {
    cancelCameraBtn.addEventListener("click", function () {
      if (cameraContainer) {
        cameraContainer.style.display = "none";
      }

      // Stop camera stream
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
    });
  }

  // Retake photo button click event
  if (retakePhotoBtn) {
    retakePhotoBtn.addEventListener("click", function () {
      if (photoPreviewContainer) {
        photoPreviewContainer.style.display = "none";
      }
      capturedPhotoData = null;
      uploadedPhotoUrl = null;

      // Clear file input
      if (fileInput) {
        fileInput.value = "";
      }
    });
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", function () {
  debugLog("DOM loaded, initializing...");

  // Check for key elements
  if (!roomsGrid) debugLog("WARNING: roomsGrid element missing");
  if (!checkinModal) debugLog("WARNING: checkinModal element missing");
  if (!checkoutModal) debugLog("WARNING: checkoutModal element missing");
  if (!serviceForm) debugLog("WARNING: serviceForm element missing");

  // Initialize camera functionality
  initCamera();

  // Initialize service buttons
  initServiceButtons();

  // Fetch initial data
  fetchData();

  // Bottom navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const tabName = item.dataset.tab;
      debugLog(`Tab clicked: ${tabName}`);

      // Update nav items
      document.querySelectorAll(".nav-item").forEach((navItem) => {
        navItem.classList.remove("active");
      });
      item.classList.add("active");

      // Update tabs content
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.add("hidden");
      });

      const tabContent = document.getElementById(`${tabName}-tab`);
      if (tabContent) {
        tabContent.classList.remove("hidden");
      } else {
        debugLog(`Tab content for ${tabName} not found`);
      }
    });
  });

  // Filters
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      debugLog(`Filter changed to: ${currentFilter}`);
      renderRooms();
    });
  });

  // Floor filters
  document.querySelectorAll(".floor-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".floor-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFloor = btn.dataset.floor;
      debugLog(`Floor filter changed to: ${currentFloor}`);
      renderRooms();
    });
  });

  // Search functionality
  if (roomSearch) {
    roomSearch.addEventListener("input", (e) => {
      searchTerm = e.target.value.toLowerCase();
      renderRooms();
    });
  }

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.innerHTML =
        '<span class="loader" style="width: 20px; height: 20px;"></span>';
      fetchData().then(() => {
        setTimeout(() => {
          refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }, 500);
      });
    });
  }

  // Add Room button
  if (addRoomBtn) {
    addRoomBtn.addEventListener("click", () => {
      showAddRoomModal();
    });
  }

  // Handle payment method selection for check-in
  document.querySelectorAll(".payment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (
        btn.parentElement &&
        btn.parentElement.classList.contains("payment-options")
      ) {
        const paymentOptions = btn.parentElement;
        paymentOptions
          .querySelectorAll(".payment-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (btn.dataset.payment) {
          activePaymentMethod = btn.dataset.payment;
          const paymentMethodInput = document.getElementById("payment-method");
          if (paymentMethodInput) {
            paymentMethodInput.value = activePaymentMethod;
          }
        }
      }
    });
  });

  // Check-in form validation and submission
  const checkinForm = document.getElementById("checkin-form");
  if (checkinForm) {
    checkinForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const roomNumberElement = document.getElementById("checkin-room-number");
      if (!roomNumberElement) {
        showNotification("Error: Room number element not found", "error");
        return;
      }

      const roomNumber = roomNumberElement.textContent;
      const guestName = document.getElementById("guest-name")?.value;
      const guestMobile = document.getElementById("guest-mobile")?.value;
      const roomPrice = document.getElementById("room-price")?.value;
      const guestCount = document.getElementById("guest-count")?.value;
      const amountPaid = parseInt(
        document.getElementById("amount-paid")?.value || "0"
      );
      const paymentMethod = document.getElementById("payment-method")?.value;

      if (!guestName || !guestMobile || !roomPrice || !guestCount) {
        showNotification("Please fill all required fields", "error");
        return;
      }

      // Don't allow amount paid > 0 when payment method is "balance"
      if (amountPaid > 0 && paymentMethod === "balance") {
        showNotification(
          'Cannot select "Pay Later" when amount is provided. Please select Cash or Online payment method.',
          "error"
        );
        return;
      }

      // Disable submit button and show loading state
      const submitBtn = e.target.querySelector("button[type=submit]");
      if (!submitBtn) {
        showNotification("Submit button not found", "error");
        return;
      }

      const originalContent = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

      try {
        const response = await fetch("/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room: roomNumber,
            name: guestName,
            mobile: guestMobile,
            price: roomPrice,
            guests: guestCount,
            payment: paymentMethod,
            amountPaid: amountPaid,
            photoPath: uploadedPhotoUrl,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          checkinModal.classList.remove("show");
          await fetchData();
          showNotification(result.message || "Check-in successful!", "success");
        } else {
          showNotification(result.message || "Error during check-in", "error");
        }
      } catch (error) {
        console.error("Error during check-in:", error);
        showNotification(`Error during check-in: ${error.message}`, "error");
      } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Complete Check-in";
      }
    });
  } else {
    debugLog("Check-in form not found");
  }

  // Cancel checkout
  const cancelCheckoutBtn = document.getElementById("cancel-checkout-btn");
  if (cancelCheckoutBtn) {
    cancelCheckoutBtn.addEventListener("click", () => {
      checkoutModal.classList.remove("show");
    });
  }

  // Edit check-in time button
  const editCheckinTimeBtn = document.getElementById("edit-checkin-time");
  if (editCheckinTimeBtn) {
    editCheckinTimeBtn.addEventListener("click", () => {
      const roomNumber = document.getElementById(
        "checkout-room-number"
      )?.textContent;
      const currentTime = document.getElementById(
        "checkout-checkin-time"
      )?.textContent;
      if (roomNumber) {
        showEditTimeModal(roomNumber, currentTime);
      }
    });
  }

  // Apply report filter
  const applyReportFilterBtn = document.getElementById("apply-report-filter");
  if (applyReportFilterBtn) {
    applyReportFilterBtn.addEventListener("click", generateReport);
  }

  // Renew all button
  const renewAllBtn = document.getElementById("renew-all-btn");
  if (renewAllBtn) {
    renewAllBtn.addEventListener("click", async function () {
      const dueRoomElements = document.querySelectorAll(".renewal-item");
      if (dueRoomElements.length === 0) return;

      this.disabled = true;
      this.innerHTML =
        '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

      const dueRooms = Array.from(dueRoomElements).map((el) => el.dataset.room);

      let successCount = 0;
      let failCount = 0;

      for (const room of dueRooms) {
        try {
          const roomElement = document.querySelector(
            `.renewal-item[data-room="${room}"]`
          );
          if (!roomElement) continue;

          const buttonElement = roomElement.querySelector(".renew-single-btn");
          if (!buttonElement) continue;

          // Skip already processed rooms
          if (buttonElement.innerHTML === "Renewed" || buttonElement.disabled) {
            continue;
          }

          // Update button UI
          buttonElement.disabled = true;
          buttonElement.innerHTML =
            '<span class="loader" style="width: 10px; height: 10px;"></span>';

          // Try to renew the room
          const success = await triggerRentRenewal(room);

          if (success) {
            successCount++;
            // Update UI to show this room is processed
            roomElement.style.backgroundColor = "#e8f4e5";
            buttonElement.innerHTML = "Renewed";
          } else {
            failCount++;
            buttonElement.disabled = false;
            buttonElement.innerHTML = "Retry";
          }
        } catch (error) {
          console.error(`Error renewing room ${room}:`, error);
          failCount++;
        }
      }

      this.disabled = false;
      this.innerHTML = "Renew All Due Rooms";

      if (successCount > 0) {
        showNotification(
          `Successfully renewed ${successCount} room${
            successCount !== 1 ? "s" : ""
          }`,
          "success"
        );
      }

      if (failCount > 0) {
        showNotification(
          `Failed to renew ${failCount} room${failCount !== 1 ? "s" : ""}`,
          "warning"
        );
      }

      // Close modal if all rooms are successfully processed
      if (failCount === 0) {
        setTimeout(() => {
          if (rentRenewalModal) {
            rentRenewalModal.classList.remove("show");
          }
        }, 1500);
      }
    });
  }

  // Close modals
  document.querySelectorAll(".close-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal-backdrop").forEach((modal) => {
        modal.classList.remove("show");
      });

      // Stop camera stream if active
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
    });
  });

  // Quick action button toggle
  const quickActionBtn = document.getElementById("quick-action-toggle");
  const quickActionMenu = document.querySelector(".quick-action-menu");

  if (quickActionBtn && quickActionMenu) {
    quickActionBtn.addEventListener("click", function () {
      quickActionMenu.classList.toggle("show");
    });

    // Close menu when clicking outside
    document.addEventListener("click", function (event) {
      if (!event.target.closest(".quick-actions-container")) {
        quickActionMenu.classList.remove("show");
      }
    });
  }

  // Quick renewals button
  const quickRenewBtn = document.getElementById("quick-renew-btn");
  if (quickRenewBtn) {
    quickRenewBtn.addEventListener("click", function () {
      showRenewalModal();
      if (quickActionMenu) {
        quickActionMenu.classList.remove("show");
      }
    });
  }

  // Add Room form submission
  const addRoomForm = document.getElementById("add-room-form");
  if (addRoomForm) {
    addRoomForm.addEventListener("submit", addRoom);
  }

  // Set default dates for report
  const today = new Date().toISOString().split("T")[0];
  if (document.getElementById("start-date")) {
    document.getElementById("start-date").value = today;
  }
  if (document.getElementById("end-date")) {
    document.getElementById("end-date").value = today;
  }

  debugLog("Initialization complete");
});

// This function will be called when the DOM is fully loaded
function setupCheckoutConfirmation() {
  const confirmCheckoutBtn = document.getElementById("confirm-checkout-btn");

  if (!confirmCheckoutBtn) {
    console.error("Checkout button not found!");
    return;
  }

  // Add the event listener to the checkout button
  confirmCheckoutBtn.addEventListener("click", function (event) {
    // Prevent default action if any
    event.preventDefault();

    const roomNumberElement = document.getElementById("checkout-room-number");
    const guestNameElement = document.getElementById("checkout-guest-name");

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

    // If balance is positive, show warning and don't proceed
    if (balance > 0) {
      showNotification("Please clear the balance before checkout", "error");
      console.log("Checkout blocked - positive balance");
      return;
    }

    // Set the room and guest name in the confirmation modal
    const confirmRoomElement = document.getElementById("confirm-checkout-room");
    const confirmGuestElement = document.getElementById(
      "confirm-checkout-guest"
    );

    if (confirmRoomElement) confirmRoomElement.textContent = roomNumber;
    if (confirmGuestElement) confirmGuestElement.textContent = guestName;

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
  });

  // Handle the cancel button in the confirmation modal
  const cancelConfirmBtn = document.getElementById(
    "cancel-confirm-checkout-btn"
  );
  if (cancelConfirmBtn) {
    cancelConfirmBtn.addEventListener("click", function () {
      console.log("Cancel confirmation clicked");
      const checkoutConfirmModal = document.getElementById(
        "checkout-confirm-modal"
      );
      if (checkoutConfirmModal) {
        checkoutConfirmModal.classList.remove("show");
      }
    });
  }

  // Handle the close button in the confirmation modal
  const confirmModalCloseBtn = document.querySelector(
    "#checkout-confirm-modal .close-btn"
  );
  if (confirmModalCloseBtn) {
    confirmModalCloseBtn.addEventListener("click", function () {
      console.log("Close confirmation modal clicked");
      const checkoutConfirmModal = document.getElementById(
        "checkout-confirm-modal"
      );
      if (checkoutConfirmModal) {
        checkoutConfirmModal.classList.remove("show");
      }
    });
  }

  // Handle the proceed button in the confirmation modal
  const proceedCheckoutBtn = document.getElementById("proceed-checkout-btn");
  if (proceedCheckoutBtn) {
    proceedCheckoutBtn.addEventListener("click", async function () {
      console.log("Proceed checkout clicked");

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
          showNotification("Checkout successful!", "success");
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
    });
  } else {
    console.error("Proceed checkout button not found");
  }
}

// Call this function when the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Delay the setup slightly to ensure all elements are ready
  setTimeout(setupCheckoutConfirmation, 500);

  // Modify updateStats function to subtract refunds from today's totals
  if (typeof updateStats === "function") {
    const originalUpdateStats = updateStats;

    window.updateStats = function () {
      let vacant = 0;
      let occupied = 0;
      let balance = 0;
      let renewalsDue = 0;

      Object.values(rooms).forEach((room) => {
        if (room.status === "vacant") {
          vacant++;
        } else if (room.status === "occupied") {
          occupied++;
          if (room.balance > 0) {
            balance += room.balance;
          }

          // Check if room is due for renewal
          const renewalStatus = getRoomRenewalStatus(room);
          if (renewalStatus && renewalStatus.canRenew) {
            renewalsDue++;
          }
        }
      });

      if (vacantCount) vacantCount.textContent = vacant;
      if (occupiedCount) occupiedCount.textContent = occupied;
      if (pendingBalance) pendingBalance.textContent = "₹" + balance;

      // Calculate today's revenue with cash/online split and subtract refunds
      const today = new Date().toISOString().split("T")[0];

      // Get today's transactions
      const todayCashLogs = logs.cash.filter((log) => log.date === today);
      const todayOnlineLogs = logs.online.filter((log) => log.date === today);
      const todayRefundLogs = (logs.refunds || []).filter(
        (log) => log.date === today
      );

      // Calculate totals
      const todayCashTotal = todayCashLogs.reduce(
        (sum, log) => sum + log.amount,
        0
      );
      const todayOnlineTotal = todayOnlineLogs.reduce(
        (sum, log) => sum + log.amount,
        0
      );

      // Calculate refunds by payment method
      const todayCashRefunds = todayRefundLogs
        .filter((log) => log.payment_mode === "cash" || !log.payment_mode) // Include undefined payment_mode as cash for backwards compatibility
        .reduce((sum, log) => sum + log.amount, 0);

      const todayOnlineRefunds = todayRefundLogs
        .filter((log) => log.payment_mode === "online")
        .reduce((sum, log) => sum + log.amount, 0);

      // Calculate net amounts (subtracting refunds)
      const netCashTotal = todayCashTotal - todayCashRefunds;
      const netOnlineTotal = todayOnlineTotal - todayOnlineRefunds;
      const todayTotal = netCashTotal + netOnlineTotal;

      // Update the dashboard with separate cash/online totals
      const todayCashElement = document.getElementById("today-cash");
      const todayOnlineElement = document.getElementById("today-online");

      if (todayCashElement) todayCashElement.textContent = "₹" + netCashTotal;
      if (todayOnlineElement)
        todayOnlineElement.textContent = "₹" + netOnlineTotal;
      if (todayRevenue) todayRevenue.textContent = "₹" + todayTotal;

      // Update quick action renewal badge
      const quickRenewBtn = document.getElementById("quick-renew-btn");
      if (quickRenewBtn && renewalsDue > 0) {
        quickRenewBtn.innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>Renewals Due <span style="background-color: var(--danger); padding: 2px 6px; border-radius: 50%; margin-left: 5px; font-size: 0.7rem;">${renewalsDue}</span></span>
          `;
      } else if (quickRenewBtn) {
        quickRenewBtn.innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>Renewals Due</span>
          `;
      }
    };
  }
});

// Upload photo to server
async function uploadPhoto(file) {
  try {
    const formData = new FormData();
    formData.append("photo", file);

    const response = await fetch("/upload_photo", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      uploadedPhotoUrl = result.path;
    } else {
      showNotification(result.message || "Error uploading photo", "error");
    }
  } catch (error) {
    console.error("Error uploading photo:", error);
    showNotification(`Error uploading photo: ${error.message}`, "error");
  }
}
let logs = {
  cash: [],
  online: [],
  balance: [],
  add_ons: [],
  refunds: [],
  renewals: [],
};
let totals = { cash: 0, online: 0, balance: 0, refunds: 0 };
let activePaymentMethod = "cash";
let currentFilter = "all";
let currentFloor = "all";
let searchTerm = "";
let capturedPhotoData = null; // For storing camera photo
let uploadedPhotoUrl = null; // For storing uploaded photo URL
let mediaStream = null; // For camera access
let selectedService = null; // For tracking selected service
let servicePaymentMethod = "cash"; // Default payment method for services

// DOM Elements - with null checks
const roomsGrid = document.getElementById("rooms-grid");
const vacantCount = document.getElementById("vacant-count");
const occupiedCount = document.getElementById("occupied-count");
const pendingBalance = document.getElementById("pending-balance");
const todayRevenue = document.getElementById("today-revenue");
const cashTotal = document.getElementById("cash-total");
const onlineTotal = document.getElementById("online-total");
const refundTotal = document.getElementById("refund-total");
const totalRevenue = document.getElementById("total-revenue");
const transactionLog = document.getElementById("transaction-log");
const roomSearch = document.getElementById("room-search");
const refreshBtn = document.getElementById("refresh-btn");
const settingsBtn = document.getElementById("settings-btn");
const paymentOrRefundSection = document.getElementById(
  "payment-or-refund-section"
);
const notificationContainer = document.getElementById("notification-container");
const addRoomBtn = document.getElementById("add-room-btn");

// Initialize modals
const checkinModal = document.getElementById("checkin-modal");
const checkoutModal = document.getElementById("checkout-modal");
const editTimeModal = document.getElementById("edit-time-modal");
const rentRenewalModal = document.getElementById("rent-renewal-modal");
const roomDetailsModal = document.getElementById("room-details-modal");
const addRoomModal = document.getElementById("add-room-modal");

// Service form elements
const serviceForm = document.getElementById("service-form");
const serviceName = document.getElementById("service-name");
const servicePrice = document.getElementById("service-price");
const servicePaymentMethodInput = document.getElementById(
  "service-payment-method"
);

// Debug log function
function debugLog(message) {
  console.log("[DEBUG] " + message);
}

// Notification system
function showNotification(message, type = "info", duration = 5000) {
  if (!notificationContainer) {
    debugLog("Notification container not found");
    console.error(message);
    return null;
  }

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  // Create icon based on notification type
  let icon = "";
  switch (type) {
    case "success":
      icon = '<i class="fas fa-check-circle"></i>';
      break;
    case "error":
      icon = '<i class="fas fa-exclamation-circle"></i>';
      break;
    case "warning":
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    default:
      icon = '<i class="fas fa-info-circle"></i>';
  }

  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-content">
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-dismiss">&times;</button>
    <div class="notification-progress">
      <div class="notification-progress-bar"></div>
    </div>
  `;

  // Add notification to container
  notificationContainer.appendChild(notification);

  // Set up dismiss button
  const dismissBtn = notification.querySelector(".notification-dismiss");
  dismissBtn.addEventListener("click", () => {
    closeNotification(notification);
  });

  // Auto-close after duration
  setTimeout(() => {
    closeNotification(notification);
  }, duration);

  return notification;
}

function closeNotification(notification) {
  if (!notificationContainer) return;
  if (!notification || !notification.classList) return;

  if (!notification.classList.contains("closing")) {
    notification.classList.add("closing");
    setTimeout(() => {
      if (notificationContainer.contains(notification)) {
        notificationContainer.removeChild(notification);
      }
    }, 300);
  }
}

// Render rooms in grid
// Update room timer logic to show 2 hours prior to checkout
function renderRooms() {
  if (!roomsGrid) {
    debugLog("roomsGrid element not found");
    return;
  }

  roomsGrid.innerHTML = "";
  let roomCount = 0;

  Object.entries(rooms).forEach(([roomNumber, info]) => {
    // Apply filters (status, floor, search) as before
    if (currentFilter === "vacant" && info.status !== "vacant") {
      return;
    }

    if (currentFilter === "occupied" && info.status !== "occupied") {
      return;
    }

    if (
      currentFilter === "balances" &&
      (info.status !== "occupied" || info.balance <= 0)
    ) {
      return;
    }

    if (currentFloor === "first" && roomNumber.startsWith("2")) {
      return;
    }

    if (currentFloor === "second" && !roomNumber.startsWith("2")) {
      return;
    }

    if (
      searchTerm &&
      !roomNumber.toLowerCase().includes(searchTerm) &&
      !(info.guest && info.guest.name.toLowerCase().includes(searchTerm))
    ) {
      return;
    }

    roomCount++;

    const roomCard = document.createElement("div");
    roomCard.className = "room-card";
    roomCard.id = `room-card-${roomNumber}`;
    roomCard.setAttribute("aria-label", `Room ${roomNumber} - ${info.status}`);

    // Create basic room structure
    let roomContent = `
      <div class="room-status ${info.status}"></div>
      <div class="room-content">
        <div class="room-number">${roomNumber}</div>
    `;

    if (info.status === "occupied" && info.guest) {
      // Add guest information
      roomContent += `
        <div class="guest-name">${info.guest.name}</div>
      `;

      // Get renewal status
      const renewalStatus = getRoomRenewalStatus(info);

      // Show day indicator
      if (renewalStatus.dayNumber > 1) {
        roomContent += `<div class="day-indicator">D${renewalStatus.dayNumber}</div>`;
      }

      // Add enhanced footer
      roomContent += `
        <div class="enhanced-footer">
          <div>₹${info.guest.price}</div>
          <div>${info.checkin_time ? info.checkin_time.split(" ")[1] : ""}</div>
        </div>
      `;

      // Always show checkout timer for occupied rooms
      // This is the key change - show the timer for any room that has less than 2 hours left
      if (renewalStatus.expired) {
        // If already expired, show renewal badge
        roomContent += `
          <div class="renewal-badge" id="renewal-badge-${roomNumber}">Renewal Due</div>
        `;
      } else if (renewalStatus.hoursLeft <= 2) {
        // Show timer when less than 2 hours remaining (this is the key change)
        const isWarning = renewalStatus.hoursLeft < 2;
        let timerText = `${renewalStatus.hoursLeft}h ${renewalStatus.minutesLeft}m left`;

        // Make text more urgent when less than 30 minutes
        if (renewalStatus.hoursLeft === 0 && renewalStatus.minutesLeft <= 30) {
          timerText = `<strong>⚠️ ${renewalStatus.minutesLeft}m left</strong>`;
        }

        roomContent += `
          <div class="room-timer ${
            isWarning ? "warning" : ""
          }" id="timer-${roomNumber}">
            ${timerText}
          </div>
        `;
      }

      // Show balance badges
      if (info.balance > 0) {
        roomContent += `<div class="badge" style="background-color:#ff9191;">₹${info.balance}</div>`;
      } else if (info.balance < 0) {
        // Show a green badge for refunds due with the amount
        roomContent += `<div class="badge" style="background-color: var(--success);">₹${Math.abs(
          info.balance
        )}</div>`;
      }
    } else {
      // Show vacant room info
      roomContent += `
        <div class="guest-name">Vacant</div>
        <div class="room-footer">
          <div>Available</div>
        </div>
      `;
    }

    roomContent += `</div>`;
    roomCard.innerHTML = roomContent;

    // Setup click handlers and other event listeners as before
    roomCard.addEventListener("click", () => {
      if (info.status === "vacant") {
        showCheckinModal(roomNumber);
      } else if (info.status === "occupied") {
        showCheckoutModal(roomNumber);
      }
    });

    // Setup long-press for detailed view
    let longPressTimer;
    const longPressThreshold = 500; // ms

    // Mouse events for desktop
    roomCard.addEventListener("mousedown", function (e) {
      longPressTimer = setTimeout(() => {
        showRoomDetailsModal(roomNumber);
      }, longPressThreshold);
    });

    roomCard.addEventListener("mouseup", function () {
      clearTimeout(longPressTimer);
    });

    roomCard.addEventListener("mouseleave", function () {
      clearTimeout(longPressTimer);
    });

    // Touch events for mobile
    roomCard.addEventListener("touchstart", function (e) {
      longPressTimer = setTimeout(() => {
        showRoomDetailsModal(roomNumber);
      }, longPressThreshold);
    });

    roomCard.addEventListener("touchend", function () {
      clearTimeout(longPressTimer);
    });

    roomCard.addEventListener("touchcancel", function () {
      clearTimeout(longPressTimer);
    });

    roomsGrid.appendChild(roomCard);
  });

  // Show appropriate message when no rooms match filter
  if (roomCount === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <i class="fas fa-search fa-3x"></i>
      <p>No rooms match your filter criteria</p>
    `;
    roomsGrid.appendChild(emptyState);
  }
}

// Render transaction logs
function renderLogs() {
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
  const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split("T")[0];

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
  console.log("Discount logs:", discountLogs); // Debug log to see if discounts exist

  const recentDiscountLogs = discountLogs.filter((log) =>
    recentDates.includes(log.date)
  );

  console.log("Recent discount logs:", recentDiscountLogs); // Debug to see filtered discounts

  // Combine and sort by date and time (most recent first)
  const allRecentLogs = [
    ...recentCashLogs,
    ...recentOnlineLogs,
    ...recentRefundLogs,
    ...recentDiscountLogs,
  ].sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time || "00:00"}`);
    const dateB = new Date(`${b.date} ${b.time || "00:00"}`);
    return dateB - dateA;
  });

  // Update totals
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

      // Add logs for this date
      logsByDate[date].forEach((log) => {
        let type = "Unknown";
        let color = "";
        let additionalInfo = "";

        // Determine log type and styling
        if (recentCashLogs.includes(log)) {
          type = "Cash Payment";
        } else if (recentOnlineLogs.includes(log)) {
          type = "Online Payment";
        } else if (recentRefundLogs.includes(log)) {
          type = "Refund";
          color = 'style="color: var(--danger)"';
        } else if (recentDiscountLogs.includes(log)) {
          // Special handling for discount logs
          type = "Discount";
          color = 'style="color: var(--success)"';
          additionalInfo = log.reason ? ` (${log.reason})` : "";
        }

        // Add room shift indicator if applicable
        const shiftInfo = log.room_shifted
          ? `<span class="room-shifted-badge">Shifted: ${log.old_room} → ${log.room}</span>`
          : "";

        logsHTML += `
          <div class="log-item">
            <div class="log-details">
              <div class="log-title">Room ${log.room} - ${
          log.name
        }${shiftInfo}</div>
              <div class="log-subtitle">${type}${additionalInfo} at ${
          log.time || "N/A"
        }</div>
            </div>
            <div class="log-amount" ${color}>₹${log.amount}</div>
          </div>
        `;
      });
    });

  transactionLog.innerHTML = logsHTML;
}

// Fetch data from the server
async function fetchData() {
  try {
    debugLog("Fetching data from server...");
    const response = await fetch("/get_data");
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const data = await response.json();
    debugLog("Data fetched successfully");

    rooms = data.rooms;
    logs = data.logs;
    totals = data.totals;

    // Process rooms to ensure they have renewal data
    Object.entries(rooms).forEach(([roomNumber, roomInfo]) => {
      if (roomInfo.status === "occupied") {
        // Ensure renewal count exists
        if (roomInfo.renewal_count === undefined) {
          roomInfo.renewal_count = 0;
        }

        // Make sure last_renewal_time is defined if it should be
        if (roomInfo.renewal_count > 0 && !roomInfo.last_renewal_time) {
          // Estimate a last renewal time if missing
          const checkinDate = new Date(roomInfo.checkin_time);
          const estimatedLastRenewal = new Date(
            checkinDate.getTime() + roomInfo.renewal_count * 24 * 60 * 60 * 1000
          );
          roomInfo.last_renewal_time = formatDateTime(estimatedLastRenewal);
        }
      }
    });

    // Make sure all log types exist
    const requiredLogTypes = [
      "cash",
      "online",
      "balance",
      "add_ons",
      "refunds",
      "renewals",
    ];
    requiredLogTypes.forEach((type) => {
      if (!logs[type]) logs[type] = [];
    });

    renderRooms();
    renderLogs();
    updateStats();

    return true;
  } catch (error) {
    console.error("Error fetching data:", error);
    showNotification(`Error fetching data: ${error.message}`, "error");
    return false;
  }
}

function updateStats() {
  let vacant = 0;
  let occupied = 0;
  let balance = 0;
  let renewalsDue = 0;

  Object.values(rooms).forEach((room) => {
    if (room.status === "vacant") {
      vacant++;
    } else if (room.status === "occupied") {
      occupied++;
      if (room.balance > 0) {
        balance += room.balance;
      }

      // Check if room is due for renewal
      const renewalStatus = getRoomRenewalStatus(room);
      if (renewalStatus.canRenew) {
        renewalsDue++;
      }
    }
  });

  if (vacantCount) vacantCount.textContent = vacant;
  if (occupiedCount) occupiedCount.textContent = occupied;
  if (pendingBalance) pendingBalance.textContent = "₹" + balance;

  // Calculate today's revenue with cash/online split and subtract refunds by payment method
  const today = new Date().toISOString().split("T")[0];

  // Get today's transactions
  const todayCashLogs = logs.cash.filter((log) => log.date === today);
  const todayOnlineLogs = logs.online.filter((log) => log.date === today);
  const todayRefundLogs = (logs.refunds || []).filter(
    (log) => log.date === today
  );

  // Calculate totals
  const todayCashTotal = todayCashLogs.reduce(
    (sum, log) => sum + log.amount,
    0
  );
  const todayOnlineTotal = todayOnlineLogs.reduce(
    (sum, log) => sum + log.amount,
    0
  );

  // Calculate refunds by payment method
  const todayCashRefunds = todayRefundLogs
    .filter((log) => log.payment_mode === "cash")
    .reduce((sum, log) => sum + log.amount, 0);

  const todayOnlineRefunds = todayRefundLogs
    .filter((log) => log.payment_mode === "online")
    .reduce((sum, log) => sum + log.amount, 0);

  // Calculate net amounts (subtracting refunds)
  const netCashTotal = todayCashTotal - todayCashRefunds;
  const netOnlineTotal = todayOnlineTotal - todayOnlineRefunds;
  const todayTotal = netCashTotal + netOnlineTotal;

  // Update the dashboard with separate cash/online totals
  const todayCashElement = document.getElementById("today-cash");
  const todayOnlineElement = document.getElementById("today-online");

  if (todayCashElement) todayCashElement.textContent = "₹" + netCashTotal;
  if (todayOnlineElement) todayOnlineElement.textContent = "₹" + netOnlineTotal;
  if (todayRevenue) todayRevenue.textContent = "₹" + todayTotal;

  // Update quick action renewal badge if there are rooms due for renewal
  const quickRenewBtn = document.getElementById("quick-renew-btn");
  if (quickRenewBtn && renewalsDue > 0) {
    quickRenewBtn.innerHTML = `
      <i class="fas fa-sync-alt"></i>
      <span>Renewals Due <span style="background-color: var(--danger); padding: 2px 6px; border-radius: 50%; margin-left: 5px; font-size: 0.7rem;">${renewalsDue}</span></span>
    `;
  } else if (quickRenewBtn) {
    quickRenewBtn.innerHTML = `
      <i class="fas fa-sync-alt"></i>
      <span>Renewals Due</span>
    `;
  }
}

// Calculate room renewal status
function getRoomRenewalStatus(roomInfo) {
  if (!roomInfo || !roomInfo.checkin_time) {
    return {
      hoursLeft: 0,
      minutesLeft: 0,
      expired: true,
      canRenew: false,
      renewalCount: 0,
      dayNumber: 1,
      nextRenewalTime: null,
      status: "unknown",
    };
  }

  // Get basic room info
  const renewalCount = roomInfo.renewal_count || 0;
  const dayNumber = renewalCount + 1; // Day 1, 2, 3, etc.

  // Parse the original check-in time
  const checkinDate = new Date(roomInfo.checkin_time);

  // Calculate when the next renewal is due
  const nextRenewalTime = new Date(checkinDate);

  // For day 1 (just checked in): next renewal is check-in time + 1 day
  // For day 2 (after first renewal): next renewal is check-in time + 2 days
  // For day 3: next renewal is check-in time + 3 days, etc.
  nextRenewalTime.setDate(checkinDate.getDate() + dayNumber);

  // Calculate time left until next renewal
  const now = new Date();
  const timeLeft = nextRenewalTime - now;

  // Convert milliseconds to hours and minutes
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  // Determine if time has expired (time to renew)
  const expired = timeLeft <= 0;

  // Can only renew if time has expired
  const canRenew = expired;

  // How long ago the renewal became available (for sorting overdue rooms)
  const timeSinceExpiry = expired ? Math.abs(timeLeft) : 0;

  // Format next renewal time for display
  const formattedNextRenewal = formatDateTime(nextRenewalTime);

  // Determine status for UI display
  let status;
  if (expired) {
    status = "renewable"; // Can be renewed now
  } else if (hoursLeft < 1) {
    status = "expiring-soon"; // Less than 1 hour left
  } else {
    status = "waiting"; // More than 1 hour left
  }

  return {
    hoursLeft,
    minutesLeft,
    expired,
    canRenew,
    renewalCount,
    dayNumber,
    nextRenewalTime: formattedNextRenewal,
    timeSinceExpiry,
    status,
  };
}

// Format date-time for display
function formatDateTime(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  return date.toISOString().substring(0, 19).replace("T", " ");
}

// Process rent renewal for a room
async function triggerRentRenewal(roomNumber) {
  try {
    const roomInfo = rooms[roomNumber];
    if (!roomInfo) return false;

    // Get renewal status
    const renewalStatus = getRoomRenewalStatus(roomInfo);

    // Check if renewal is allowed (must be expired)
    if (!renewalStatus.canRenew) {
      const hoursMinutesStr = `${renewalStatus.hoursLeft}h ${renewalStatus.minutesLeft}m`;
      showNotification(
        `Cannot renew yet. Please wait ${hoursMinutesStr} more.`,
        "error"
      );
      return false;
    }

    // New renewal count - this is the key value for calculating future renewals
    const newRenewalCount = (roomInfo.renewal_count || 0) + 1;

    debugLog(
      "Processing renewal for room " +
        roomNumber +
        ", new day: " +
        (newRenewalCount + 1)
    );

    const response = await fetch("/renew_rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: roomNumber,
        renewal_count: newRenewalCount,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      // Update the room object locally
      roomInfo.renewal_count = newRenewalCount;

      // Remove last_renewal_time if it exists (we don't use it anymore)
      if (roomInfo.last_renewal_time) {
        delete roomInfo.last_renewal_time;
      }

      // Add to renewal logs
      if (!logs.renewals) logs.renewals = [];

      // Get current date and time
      const now = new Date();
      const currentDate = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().split(" ")[0].slice(0, 5);

      logs.renewals.push({
        room: roomNumber,
        name: roomInfo.guest?.name || "Unknown",
        date: currentDate,
        time: currentTime,
        day: newRenewalCount + 1,
      });

      // Refresh data from server
      await fetchData();

      showNotification(
        `Room ${roomNumber} rent renewed for Day ${newRenewalCount + 1}!`,
        "success"
      );

      return true;
    } else {
      showNotification(result.message || "Failed to renew rent", "error");
      return false;
    }
  } catch (error) {
    console.error("Error renewing rent:", error);
    showNotification(`Error renewing rent: ${error.message}`, "error");
    return false;
  }
}

// Show the renewal modal with rooms due for renewal
function showRenewalModal() {
  const renewalList = document.getElementById("renewal-list");
  if (!renewalList) {
    debugLog("Renewal list element not found");
    return;
  }

  if (!rentRenewalModal) {
    debugLog("Rent renewal modal not found");
    return;
  }

  // Clear previous content
  renewalList.innerHTML = `
    <div class="loading-indicator">
      <span class="loader"></span>
      <p>Checking for renewals...</p>
    </div>
  `;

  // Find rooms due for renewal
  const dueRooms = [];

  Object.entries(rooms).forEach(([roomNumber, info]) => {
    if (info.status === "occupied") {
      const renewalStatus = getRoomRenewalStatus(info);
      if (renewalStatus.canRenew) {
        dueRooms.push({
          room: roomNumber,
          info: info,
          status: renewalStatus,
          timeSinceExpiry: renewalStatus.timeSinceExpiry,
        });
      }
    }
  });

  setTimeout(() => {
    if (dueRooms.length === 0) {
      renewalList.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <i class="fas fa-check-circle" style="color: var(--success); font-size: 2rem;"></i>
          <p style="margin-top: 10px;">All rooms are up to date!</p>
        </div>
      `;

      // Hide the renew all button
      const renewAllBtn = document.getElementById("renew-all-btn");
      if (renewAllBtn) {
        renewAllBtn.style.display = "none";
      }
    } else {
      // Sort rooms by how long they've been overdue
      dueRooms.sort((a, b) => b.timeSinceExpiry - a.timeSinceExpiry);

      // Show the renew all button
      const renewAllBtn = document.getElementById("renew-all-btn");
      if (renewAllBtn) {
        renewAllBtn.style.display = "block";
      }

      // Create list of rooms due for renewal
      renewalList.innerHTML = "";
      dueRooms.forEach(({ room, info, status }) => {
        // Calculate how long ago renewal became due
        const hoursOverdue = Math.floor(
          status.timeSinceExpiry / (1000 * 60 * 60)
        );
        const minutesOverdue = Math.floor(
          (status.timeSinceExpiry % (1000 * 60 * 60)) / (1000 * 60)
        );

        let overdueText;
        if (hoursOverdue > 0) {
          overdueText = `Overdue by ${hoursOverdue}h ${minutesOverdue}m`;
        } else {
          overdueText = `Overdue by ${minutesOverdue}m`;
        }

        const renewalItem = document.createElement("div");
        renewalItem.className = "renewal-item";
        renewalItem.dataset.room = room;

        renewalItem.innerHTML = `
          <div class="renewal-info">
            <div class="renewal-room">Room ${room} <span class="status-tag renewable">Day ${
          status.dayNumber
        }</span></div>
            <div class="renewal-guest">${info.guest?.name || "Unknown"}</div>
            <div class="renewal-overdue">${overdueText}</div>
          </div>
          <div class="renewal-price">₹${info.guest?.price || 0}</div>
          <div class="renewal-action">
            <button class="action-btn btn-sm btn-warning renew-single-btn">Renew</button>
          </div>
        `;

        renewalList.appendChild(renewalItem);

        // Add event listener to renew button
        const renewButton = renewalItem.querySelector(".renew-single-btn");
        if (renewButton) {
          renewButton.addEventListener("click", function () {
            this.disabled = true;
            this.innerHTML =
              '<span class="loader" style="width: 10px; height: 10px;"></span>';

            triggerRentRenewal(room)
              .then((success) => {
                if (success) {
                  // Update UI to show this room is processed
                  renewalItem.style.backgroundColor = "#e8f4e5";
                  this.innerHTML = "Renewed";
                } else {
                  // Reset button on failure
                  this.disabled = false;
                  this.innerHTML = "Retry";
                }
              })
              .catch(() => {
                this.disabled = false;
                this.innerHTML = "Retry";
              });
          });
        }
      });
    }
  }, 500);

  // Show the modal
  rentRenewalModal.classList.add("show");
}

// Filter rooms by balance - now used by filter button
function filterRoomsByBalance() {
  currentFilter = "balances";

  // Update active button visual
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const balancesFilterBtn = document.querySelector(
    '.filter-btn[data-filter="balances"]'
  );
  if (balancesFilterBtn) {
    balancesFilterBtn.classList.add("active");
  }

  renderRooms();
}

// Show check-in modal
function showCheckinModal(roomNumber) {
  if (!checkinModal) {
    debugLog("Check-in modal not found");
    return;
  }

  const roomNumberElement = document.getElementById("checkin-room-number");
  if (roomNumberElement) {
    roomNumberElement.textContent = roomNumber;
  }

  // Reset form fields
  const checkinForm = document.getElementById("checkin-form");
  if (checkinForm) {
    checkinForm.reset();
  }

  const paymentMethodInput = document.getElementById("payment-method");
  if (paymentMethodInput) {
    paymentMethodInput.value = "cash";
  }

  const photoPreviewContainer = document.getElementById(
    "photo-preview-container"
  );
  if (photoPreviewContainer) {
    photoPreviewContainer.style.display = "none";
  }

  const cameraContainer = document.getElementById("camera-container");
  if (cameraContainer) {
    cameraContainer.style.display = "none";
  }

  // Make sure cash is the default active payment method
  document.querySelectorAll(".payment-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const cashBtn = document.querySelector('.payment-btn[data-payment="cash"]');
  if (cashBtn) {
    cashBtn.classList.add("active");
  }

  // Reset captured photo data
  capturedPhotoData = null;
  uploadedPhotoUrl = null;

  checkinModal.classList.add("show");
}

// Update checkout modal to refresh all information
function updateCheckoutModal(roomNumber) {
  if (!checkoutModal) {
    debugLog("Checkout modal not found");
    return;
  }

  const roomInfo = rooms[roomNumber];
  if (!roomInfo || !roomInfo.guest) {
    showNotification("Error loading room data", "error");
    return;
  }

  const checkoutRoomNumber = document.getElementById("checkout-room-number");
  if (checkoutRoomNumber) {
    checkoutRoomNumber.textContent = roomNumber;
  }

  const checkoutGuestName = document.getElementById("checkout-guest-name");
  if (checkoutGuestName) {
    checkoutGuestName.textContent = roomInfo.guest.name;
  }

  const checkoutMobileNumber = document.getElementById(
    "checkout-mobile-number"
  );
  if (checkoutMobileNumber) {
    checkoutMobileNumber.textContent = roomInfo.guest.mobile || "N/A";
  }

  const checkoutGuestMobile = document.getElementById("checkout-guest-mobile");
  if (checkoutGuestMobile) {
    checkoutGuestMobile.href = `tel:${roomInfo.guest.mobile || ""}`;
  }

  const checkoutCheckinTime = document.getElementById("checkout-checkin-time");
  if (checkoutCheckinTime) {
    checkoutCheckinTime.textContent = roomInfo.checkin_time || "N/A";
  }

  const checkoutRoomPrice = document.getElementById("checkout-room-price");
  if (checkoutRoomPrice) {
    checkoutRoomPrice.textContent = "₹" + roomInfo.guest.price;
  }

  // Update balance display with color coding
  const balanceEl = document.getElementById("checkout-balance");
  if (balanceEl) {
    if (roomInfo.balance < 0) {
      balanceEl.textContent = "₹" + Math.abs(roomInfo.balance) + " (refund)";
      balanceEl.classList.add("negative-balance");
    } else {
      balanceEl.textContent = "₹" + roomInfo.balance;
      balanceEl.classList.remove("negative-balance");
    }
  }

  // Update renewal status
  const renewalStatus = getRoomRenewalStatus(roomInfo);
  const dayCountEl = document.getElementById("checkout-day-count");
  const renewalStatusEl = document.getElementById("checkout-renewal-status");

  if (dayCountEl) {
    dayCountEl.textContent = `Day ${renewalStatus.dayNumber}`;
  }

  // Set status tag based on renewal status
  if (renewalStatusEl) {
    renewalStatusEl.className = "status-tag";
    if (renewalStatus.expired) {
      renewalStatusEl.textContent = "Renewal Due";
      renewalStatusEl.classList.add("renewable");
    } else if (renewalStatus.hoursLeft < 1) {
      renewalStatusEl.textContent = `${renewalStatus.minutesLeft}m left`;
      renewalStatusEl.classList.add("warning");
    } else {
      renewalStatusEl.textContent = `${renewalStatus.hoursLeft}h ${renewalStatus.minutesLeft}m left`;
      renewalStatusEl.classList.add("waiting");
    }
  }

  // Display guest photo if available
  const photoContainer = document.getElementById("checkout-photo-container");
  if (photoContainer) {
    if (roomInfo.guest.photo) {
      const guestPhoto = document.getElementById("checkout-guest-photo");
      if (guestPhoto) {
        guestPhoto.src = roomInfo.guest.photo;
      }
      photoContainer.style.display = "block";
    } else {
      photoContainer.style.display = "none";
    }
  }

  // Reset the service form
  resetServiceForm();

  // Update renewal history
  updateRenewalHistory(roomNumber);

  // Update payment or refund UI
  updatePaymentOrRefundUI(roomNumber);

  // Update payment logs
  updatePaymentLogs(roomNumber);
}

// Show checkout modal with detailed info
function showCheckoutModal(roomNumber) {
  if (!checkoutModal) {
    debugLog("Checkout modal not found");
    return;
  }

  updateCheckoutModal(roomNumber);
  checkoutModal.classList.add("show");
}

// Update renewal history
function updateRenewalHistory(roomNumber) {
  const roomInfo = rooms[roomNumber];
  const renewalHistoryContainer = document.getElementById(
    "renewal-history-container"
  );
  const renewalHistoryContent = document.getElementById(
    "renewal-history-content"
  );
  const nextRenewalTime = document.getElementById("next-renewal-time");

  if (!renewalHistoryContainer || !renewalHistoryContent || !nextRenewalTime) {
    debugLog("Renewal history elements not found");
    return;
  }

  // If no renewal history, hide the container
  const renewalCount = roomInfo.renewal_count || 0;
  if (renewalCount === 0) {
    renewalHistoryContainer.style.display = "none";
    return;
  }

  // Show the container
  renewalHistoryContainer.style.display = "block";

  // Get renewal status
  const renewalStatus = getRoomRenewalStatus(roomInfo);

  // Clear previous content
  renewalHistoryContent.innerHTML = "";

  // Add initial check-in
  renewalHistoryContent.innerHTML += `
    <div class="renewal-history-item">
      <div>Initial Check-in</div>
      <div>${roomInfo.checkin_time}</div>
    </div>
  `;

  // Add renewal history from logs
  const roomRenewals = logs.renewals
    ? logs.renewals
        .filter((log) => log.room === roomNumber)
        .sort((a, b) => {
          // Sort by date and time
          const dateA = new Date(`${a.date} ${a.time}`);
          const dateB = new Date(`${b.date} ${b.time}`);
          return dateA - dateB;
        })
    : [];

  roomRenewals.forEach((log, index) => {
    renewalHistoryContent.innerHTML += `
      <div class="renewal-history-item">
        <div>Renewal for Day ${index + 2}</div>
        <div>${log.date} ${log.time}</div>
      </div>
    `;
  });

  // Show next renewal time
  const nextRenewalStr = renewalStatus.expired
    ? "Renewal is due now"
    : `Next renewal in ${renewalStatus.hoursLeft}h ${renewalStatus.minutesLeft}m`;

  nextRenewalTime.innerHTML = `<i class="fas fa-clock"></i> ${nextRenewalStr}`;
}

// Update payment logs in checkout modal
function updatePaymentLogs(roomNumber) {
  const paymentLogsContainer = document.getElementById("checkout-payment-logs");
  if (!paymentLogsContainer) {
    debugLog("Payment logs container not found");
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

// Handle payment
async function addPayment(mode) {
  try {
    const roomNumberElement = document.getElementById("checkout-room-number");
    if (!roomNumberElement) {
      showNotification("Error: Room number element not found", "error");
      return;
    }

    const roomNumber = roomNumberElement.textContent;
    const amountInput = document.getElementById("checkout-payment-amount");

    if (!amountInput) {
      showNotification("Error: Payment amount field not found", "error");
      return;
    }

    const amount = parseInt(amountInput.value);

    if (!amount || amount <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    // Find which button to use based on mode
    let btn = null;

    // First try to get the add payment button
    const addPaymentBtn = document.getElementById("add-payment-btn");
    if (addPaymentBtn) {
      btn = addPaymentBtn;
    } else {
      // Fall back to individual payment buttons
      btn = document.getElementById(`checkout-${mode}-btn`);
    }

    // Show loading state if the button exists
    let originalContent = "";
    if (btn) {
      originalContent = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML =
        '<span class="loader" style="width: 14px; height: 14px;"></span> Processing...';
    } else {
      console.warn(
        `Button for payment mode ${mode} not found, proceeding anyway`
      );
    }

    // Proceed with payment API call
    const response = await fetch("/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: roomNumber,
        payment_mode: mode,
        amount: amount,
        is_refund: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    await fetchData();

    // Update the checkout modal
    updateCheckoutModal(roomNumber);

    showNotification(
      result.message || `Payment of ₹${amount} added successfully`,
      "success"
    );
  } catch (error) {
    console.error("Error adding payment:", error);
    showNotification(`Error adding payment: ${error.message}`, "error");
  } finally {
    // Re-enable buttons if they exist
    const addPaymentBtn = document.getElementById("add-payment-btn");
    const cashBtn = document.getElementById("checkout-cash-btn");
    const onlineBtn = document.getElementById("checkout-online-btn");

    if (addPaymentBtn) {
      addPaymentBtn.disabled = false;
      addPaymentBtn.innerHTML =
        '<i class="fas fa-plus-circle"></i> Add Payment';
    }

    if (cashBtn) {
      cashBtn.disabled = false;
      cashBtn.innerHTML = '<i class="fas fa-money-bill"></i> Cash';
    }

    if (onlineBtn) {
      onlineBtn.disabled = false;
      onlineBtn.innerHTML = '<i class="fas fa-mobile-alt"></i> Online';
    }
  }
}

// Process refund
// Updated processRefund function to use the input field value
async function processRefund() {
  try {
    const roomNumberElement = document.getElementById("checkout-room-number");
    if (!roomNumberElement) {
      showNotification("Error: Room number element not found", "error");
      return;
    }

    const roomNumber = roomNumberElement.textContent;

    // Get the user-specified refund amount from the input field
    const refundAmountInput = document.getElementById("refund-amount-input");
    if (!refundAmountInput) {
      showNotification("Error: Refund amount input not found", "error");
      return;
    }

    const refundAmount = parseInt(refundAmountInput.value) || 0;
    const maxRefundAmount = Math.abs(rooms[roomNumber].balance);

    // Validate the refund amount
    if (refundAmount <= 0) {
      showNotification("Please enter a valid refund amount", "error");
      return;
    }

    if (refundAmount > maxRefundAmount) {
      showNotification(
        `Refund amount cannot exceed ₹${maxRefundAmount}`,
        "error"
      );
      return;
    }

    const refundMethod =
      document.querySelector(".refund-container .payment-btn.active")?.id ===
      "refund-cash-btn"
        ? "cash"
        : "online";

    // Disable button and show loading state
    const btn = document.getElementById("process-refund-btn");
    if (!btn) {
      showNotification("Error: Process refund button not found", "error");
      return;
    }

    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML =
      '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

    const response = await fetch("/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: roomNumber,
        payment_mode: refundMethod,
        amount: refundAmount,
        is_refund: true,
        process_refund: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      await fetchData();
      updateCheckoutModal(roomNumber);
      showNotification(
        `Refund of ₹${refundAmount} processed successfully!`,
        "success"
      );
    } else {
      showNotification(result.message || "Error processing refund", "error");
    }
  } catch (error) {
    console.error("Error processing refund:", error);
    showNotification(`Error processing refund: ${error.message}`, "error");
  } finally {
    // Re-enable button
    const btn = document.getElementById("process-refund-btn");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "Process Refund";
    }
  }
}

// Reset service form
function resetServiceForm() {
  if (!serviceForm) {
    debugLog("Service form not found");
    return;
  }

  serviceForm.classList.add("hidden");
  selectedService = null;

  // Deselect all service buttons
  document.querySelectorAll(".service-btn").forEach((btn) => {
    btn.classList.remove("selected");
  });

  // Reset payment method
  document.querySelectorAll(".payment-options .payment-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const cashBtn = document.querySelector("#service-form .payment-btn.cash");
  if (cashBtn) {
    cashBtn.classList.add("active");
  }

  servicePaymentMethod = "cash";
  if (servicePaymentMethodInput) servicePaymentMethodInput.value = "cash";
}

// Initialize service buttons
function initServiceButtons() {
  debugLog("Initializing service buttons");
  // Service buttons
  const serviceButtons = document.querySelectorAll(".service-btn");
  if (serviceButtons.length === 0) {
    debugLog("No service buttons found");
  }

  serviceButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const service = this.dataset.service;
      const price = this.dataset.price;

      debugLog(`Service clicked: ${service}, price: ${price}`);

      // Clear previous selection
      document.querySelectorAll(".service-btn").forEach((b) => {
        b.classList.remove("selected");
      });

      // Select this button
      this.classList.add("selected");
      selectedService = service;

      // Populate service form
      if (serviceForm && serviceName && servicePrice) {
        serviceName.value = service;
        servicePrice.value = price;

        if (price) {
          servicePrice.readOnly = true;
        } else {
          servicePrice.readOnly = false;
          servicePrice.focus();
        }

        // Show service form
        serviceForm.classList.remove("hidden");
      } else {
        debugLog("Service form elements not found");
        if (!serviceForm) debugLog("- serviceForm not found");
        if (!serviceName) debugLog("- serviceName not found");
        if (!servicePrice) debugLog("- servicePrice not found");
      }
    });
  });

  // Service payment method selection
  const servicePaymentBtns = document.querySelectorAll(
    "#service-form .payment-btn"
  );
  if (servicePaymentBtns.length === 0) {
    debugLog("No payment buttons found in service form");
  }

  servicePaymentBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      debugLog(`Service payment method clicked: ${this.dataset.payment}`);

      // Clear previous selections
      document.querySelectorAll("#service-form .payment-btn").forEach((b) => {
        b.classList.remove("active");
      });

      // Set this as active
      this.classList.add("active");
      servicePaymentMethod = this.dataset.payment;
      if (servicePaymentMethodInput) {
        servicePaymentMethodInput.value = servicePaymentMethod;
      }
    });
  });

  // Cancel service button
  const cancelServiceBtn = document.getElementById("cancel-service-btn");
  if (cancelServiceBtn) {
    cancelServiceBtn.addEventListener("click", resetServiceForm);
  } else {
    debugLog("Cancel service button not found");
  }

  // Add service button
  const addServiceBtn = document.getElementById("add-service-btn");
  if (addServiceBtn) {
    addServiceBtn.addEventListener("click", addService);
  } else {
    debugLog("Add service button not found");
  }
}

// Add service/add-on to room
async function addService() {
  try {
    const roomNumberElement = document.getElementById("checkout-room-number");
    if (!roomNumberElement) {
      showNotification("Error: Room number element not found", "error");
      return;
    }

    const roomNumber = roomNumberElement.textContent;

    if (!serviceName || !servicePrice) {
      showNotification("Error: Service form fields not found", "error");
      return;
    }

    const service = serviceName.value;
    const price = parseInt(servicePrice.value);

    if (!service) {
      showNotification("Please select a service", "error");
      return;
    }

    if (!price || price <= 0) {
      showNotification("Please enter a valid price", "error");
      return;
    }

    // Disable button during processing
    const addServiceBtn = document.getElementById("add-service-btn");
    if (!addServiceBtn) {
      showNotification("Error: Add service button not found", "error");
      return;
    }

    addServiceBtn.disabled = true;
    addServiceBtn.innerHTML =
      '<span class="loader" style="width: 14px; height: 14px;"></span> Adding...';

    const response = await fetch("/add_on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: roomNumber,
        item: service,
        price: price,
        payment_method: servicePaymentMethod,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      await fetchData();
      updateCheckoutModal(roomNumber);

      // Show an appropriate message based on the payment method
      if (servicePaymentMethod === "balance") {
        showNotification(`Added ${service} (₹${price}) to balance`, "success");
      } else {
        showNotification(
          `Added ${service} (₹${price}) - paid by ${servicePaymentMethod}`,
          "success"
        );
      }

      resetServiceForm();
    } else {
      showNotification(result.message || "Error adding service", "error");
    }
  } catch (error) {
    console.error("Error adding service:", error);
    showNotification(`Error adding service: ${error.message}`, "error");
  } finally {
    // Re-enable button
    const addServiceBtn = document.getElementById("add-service-btn");
    if (addServiceBtn) {
      addServiceBtn.disabled = false;
      addServiceBtn.innerHTML = "Add Service";
    }
  }
}

// Show edit time modal
function showEditTimeModal(roomNumber, currentCheckInTime) {
  if (!editTimeModal) {
    debugLog("Edit time modal not found");
    return;
  }

  // Parse the current check-in time
  let date = new Date();
  let time = "00:00";

  if (currentCheckInTime) {
    const parts = currentCheckInTime.split(" ");
    if (parts.length === 2) {
      date = new Date(parts[0]);
      time = parts[1];
    }
  }

  // Format date for the input field (YYYY-MM-DD)
  const formattedDate = date.toISOString().split("T")[0];

  // Set the values in the form
  const newCheckinDate = document.getElementById("new-checkin-date");
  const newCheckinTime = document.getElementById("new-checkin-time");

  if (newCheckinDate) newCheckinDate.value = formattedDate;
  if (newCheckinTime) newCheckinTime.value = time;

  // Setup the form submission
  const form = document.getElementById("edit-time-form");
  if (!form) {
    debugLog("Edit time form not found");
    return;
  }

  form.onsubmit = async (e) => {
    e.preventDefault();

    try {
      const newDate = document.getElementById("new-checkin-date").value;
      const newTime = document.getElementById("new-checkin-time").value;
      const newCheckInTime = `${newDate} ${newTime}`;

      // Disable submit button and show loading state
      const submitBtn = form.querySelector("button[type=submit]");
      if (!submitBtn) {
        debugLog("Submit button not found in edit time form");
        return;
      }

      const originalContent = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="loader" style="width: 20px; height: 20px;"></span> Updating...';

      const response = await fetch("/update_checkin_time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomNumber,
          checkin_time: newCheckInTime,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        editTimeModal.classList.remove("show");
        await fetchData();

        // Update the checkout modal with new data
        const checkoutCheckinTime = document.getElementById(
          "checkout-checkin-time"
        );
        if (checkoutCheckinTime) {
          checkoutCheckinTime.textContent = newCheckInTime;
        }

        showNotification("Check-in time updated successfully!", "success");
      } else {
        showNotification(
          result.message || "Error updating check-in time",
          "error"
        );
      }
    } catch (error) {
      console.error("Error updating check-in time:", error);
      showNotification(
        `Error updating check-in time: ${error.message}`,
        "error"
      );
    } finally {
      // Re-enable submit button
      const submitBtn = form.querySelector("button[type=submit]");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Update Check-in Time";
      }
    }
  };

  // Show the modal
  editTimeModal.classList.add("show");
}

// Show detailed room info modal
function showRoomDetailsModal(roomNumber) {
  if (!roomDetailsModal) {
    debugLog("Room details modal not found");
    return;
  }

  const contentDiv = document.getElementById("room-details-content");
  const roomNumberSpan = document.getElementById("detail-room-number");

  if (!contentDiv || !roomNumberSpan) {
    debugLog("Room details elements not found");
    return;
  }

  roomNumberSpan.textContent = roomNumber;

  // Show loading indicator
  contentDiv.innerHTML = `<div class="loading-indicator"><span class="loader"></span></div>`;

  setTimeout(() => {
    const info = rooms[roomNumber];

    if (!info) {
      contentDiv.innerHTML = `
        <div class="empty-state">
          <p>Room information not available</p>
        </div>
      `;
      return;
    }

    let html = "";

    if (info.status === "vacant") {
      html = `
        <div class="summary-card" style="margin-bottom: 0;">
          <div class="summary-title">Room Details</div>
          <div class="summary-row">
            <div class="summary-label">Status</div>
            <div class="summary-value">
              <span style="color: var(--vacant); font-weight: bold;">Vacant</span>
            </div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Floor</div>
            <div class="summary-value">${
              roomNumber.startsWith("2") ? "Second Floor" : "First Floor"
            }</div>
          </div>
        </div>
      `;
    } else if (info.status === "occupied" && info.guest) {
      // Get renewal status
      const renewalStatus = getRoomRenewalStatus(info);

      // Format check-in time
      const checkinDate = new Date(info.checkin_time);
      const formattedCheckin = info.checkin_time;

      // Calculate stay duration
      const now = new Date();
      const duration = Math.floor((now - checkinDate) / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        ((now - checkinDate) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );

      html = `
        <div class="summary-card" style="margin-bottom: 1rem;">
          <div class="summary-title">Room Details</div>
          <div class="summary-row">
            <div class="summary-label">Status</div>
            <div class="summary-value">
              <span style="color: var(--occupied); font-weight: bold;">Occupied</span>
            </div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Guest</div>
            <div class="summary-value">${info.guest.name}</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Mobile</div>
            <div class="summary-value">
              <a href="tel:${info.guest.mobile}" class="call-link">
                <i class="fas fa-phone"></i> ${info.guest.mobile}
              </a>
            </div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Check-in</div>
            <div class="summary-value">${formattedCheckin}</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Stay Duration</div>
            <div class="summary-value">${duration} days, ${hours} hours</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Stay Status</div>
            <div class="summary-value">Day ${renewalStatus.dayNumber}</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Room Price</div>
            <div class="summary-value">₹${info.guest.price}</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Balance</div>
            <div class="summary-value" style="${
              info.balance < 0
                ? "color: var(--success)"
                : info.balance > 0
                ? "color: var(--danger)"
                : ""
            }">
              ₹${Math.abs(info.balance)}${
        info.balance < 0 ? " (refund)" : info.balance > 0 ? " (due)" : ""
      }
            </div>
          </div>
        </div>
      `;

      // If there are add-ons, show them
      if (info.add_ons && info.add_ons.length > 0) {
        html += `
          <div class="summary-card" style="margin-bottom: 0;">
            <div class="summary-title">Add-on Services</div>
        `;

        info.add_ons.forEach((addon) => {
          html += `
            <div class="summary-row">
              <div class="summary-label">${addon.item}</div>
              <div class="summary-value">₹${addon.price}</div>
            </div>
          `;
        });

        html += `</div>`;
      }
    }

    contentDiv.innerHTML = html;

    // Configure action buttons
    const checkinBtn = document.getElementById("room-details-checkin-btn");
    const checkoutBtn = document.getElementById("room-details-checkout-btn");

    if (!checkinBtn || !checkoutBtn) {
      debugLog("Room details action buttons not found");
      return;
    }

    if (info.status === "vacant") {
      checkinBtn.style.display = "block";
      checkoutBtn.style.display = "none";

      checkinBtn.onclick = () => {
        roomDetailsModal.classList.remove("show");
        showCheckinModal(roomNumber);
      };
    } else {
      checkinBtn.style.display = "none";
      checkoutBtn.style.display = "block";

      checkoutBtn.onclick = () => {
        roomDetailsModal.classList.remove("show");
        showCheckoutModal(roomNumber);
      };
    }
  }, 300);

  roomDetailsModal.classList.add("show");
}

// Show add room modal
function showAddRoomModal() {
  if (!addRoomModal) {
    debugLog("Add room modal not found");
    return;
  }

  // Reset the form
  const addRoomForm = document.getElementById("add-room-form");
  if (addRoomForm) {
    addRoomForm.reset();
  }

  // Show the modal
  addRoomModal.classList.add("show");
}

// Add a new room
async function addRoom(event) {
  event.preventDefault();

  const roomNumberInput = document.getElementById("new-room-number");
  if (!roomNumberInput) {
    showNotification("Error: Room number input not found", "error");
    return;
  }

  const roomNumber = roomNumberInput.value.trim();

  if (!roomNumber) {
    showNotification("Please enter a room number", "error");
    return;
  }

  try {
    // Disable submit button and show loading state
    const submitBtn = event.target.querySelector("button[type=submit]");
    if (!submitBtn) {
      debugLog("Submit button not found in add room form");
      return;
    }

    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="loader" style="width: 20px; height: 20px;"></span> Adding...';

    const response = await fetch("/add_room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomNumber: roomNumber,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      if (addRoomModal) {
        addRoomModal.classList.remove("show");
      }
      await fetchData();
      showNotification(`Room ${roomNumber} added successfully!`, "success");
    } else {
      showNotification(result.message || "Error adding room", "error");
    }
  } catch (error) {
    console.error("Error adding room:", error);
    showNotification(`Error adding room: ${error.message}`, "error");
  } finally {
    // Re-enable submit button
    const submitBtn = event.target.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Add Room";
    }
  }
}

async function generateReport() {
  // Just call the enhanced report function in analytics.js
  if (typeof generateEnhancedReport === "function") {
    generateEnhancedReport();
  } else {
    console.error("Enhanced report generation function not found");
    showNotification("Error: Analytics module not loaded properly", "error");
  }
}
// Function to populate room dropdown
async function populateRoomDropdown() {
  const dropdown = document.getElementById("checkin-room-dropdown");
  if (!dropdown) {
    debugLog("Room dropdown not found");
    return;
  }

  // Clear existing options
  dropdown.innerHTML = "";

  try {
    // Get all room numbers
    const response = await fetch("/get_room_numbers");
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const data = await response.json();
    if (data.success) {
      // Add room numbers to dropdown
      data.rooms.forEach((roomNumber) => {
        // Skip occupied rooms
        if (rooms[roomNumber] && rooms[roomNumber].status === "occupied") {
          return;
        }

        const option = document.createElement("option");
        option.value = roomNumber;
        option.textContent = roomNumber;
        dropdown.appendChild(option);
      });
    } else {
      debugLog("Failed to get room numbers: " + data.message);
    }
  } catch (error) {
    console.error("Error fetching room numbers:", error);
  }
}

// Update the showCheckinModal function to use the dropdown
function showCheckinModal(selectedRoomNumber) {
  if (!checkinModal) {
    debugLog("Check-in modal not found");
    return;
  }

  // Populate room dropdown first
  populateRoomDropdown().then(() => {
    // Set the selected room number
    const dropdown = document.getElementById("checkin-room-dropdown");
    if (dropdown) {
      // Find the option with the matching room number
      const option = Array.from(dropdown.options).find(
        (opt) => opt.value === selectedRoomNumber
      );

      if (option) {
        dropdown.value = selectedRoomNumber;
      } else if (dropdown.options.length > 0) {
        // If the room isn't in the list (might be occupied), select the first available
        dropdown.selectedIndex = 0;
      }
    }

    // Reset form fields
    const checkinForm = document.getElementById("checkin-form");
    if (checkinForm) {
      checkinForm.reset();
    }

    const paymentMethodInput = document.getElementById("payment-method");
    if (paymentMethodInput) {
      paymentMethodInput.value = "cash";
    }

    const photoPreviewContainer = document.getElementById(
      "photo-preview-container"
    );
    if (photoPreviewContainer) {
      photoPreviewContainer.style.display = "none";
    }

    const cameraContainer = document.getElementById("camera-container");
    if (cameraContainer) {
      cameraContainer.style.display = "none";
    }

    // Make sure cash is the default active payment method
    document.querySelectorAll(".payment-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    const cashBtn = document.querySelector('.payment-btn[data-payment="cash"]');
    if (cashBtn) {
      cashBtn.classList.add("active");
    }

    // Reset captured photo data
    capturedPhotoData = null;
    uploadedPhotoUrl = null;

    checkinModal.classList.add("show");
  });
}

function updatePaymentOrRefundUI(roomNumber) {
  if (!paymentOrRefundSection) {
    debugLog("Payment or refund section not found");
    return;
  }

  const balance = rooms[roomNumber].balance;

  // Clear previous content
  paymentOrRefundSection.innerHTML = "";

  if (balance >= 0) {
    // Show payment UI for both positive balance and zero balance
    paymentOrRefundSection.innerHTML = `
      <div class="form-group" style="margin-top: 1.5rem">
        <label class="form-label">Add Payment</label>
        <div class="payment-button-wrapper">
          <input
            type="number"
            class="form-control payment-amount-input"
            id="checkout-payment-amount"
            placeholder="Amount"
            value="${balance || ""}"
            min="1"
          />
          <div class="payment-options" style="margin-top: 0.5rem;">
            <button
              type="button"
              class="payment-btn cash active"
              id="checkout-cash-btn"
            >
              <i class="fas fa-money-bill"></i> Cash
            </button>
            <button
              type="button"
              class="payment-btn online"
              id="checkout-online-btn"
            >
              <i class="fas fa-mobile-alt"></i> Online
            </button>
            <div class="payment-button-row">
            <button
              type="button"
              class="payment-add-btn"
              id="add-payment-btn"
            >
              <i class="fas fa-plus-circle"></i> Add Payment
            </button>
          </div>
          </div>
        </div>
      </div>
    `;

    // Add click handlers for the payment buttons
    const addPaymentBtn = document.getElementById("add-payment-btn");
    if (addPaymentBtn) {
      addPaymentBtn.addEventListener("click", function () {
        // Find which payment method is active
        const activeMethod = document
          .querySelector("#checkout-cash-btn")
          .classList.contains("active")
          ? "cash"
          : "online";

        addPayment(activeMethod);
      });
    }

    // Re-attach event listeners for payment method selection
    const cashBtn = document.getElementById("checkout-cash-btn");
    if (cashBtn) {
      cashBtn.addEventListener("click", function () {
        document
          .getElementById("checkout-online-btn")
          .classList.remove("active");
        cashBtn.classList.add("active");
      });
    }

    const onlineBtn = document.getElementById("checkout-online-btn");
    if (onlineBtn) {
      onlineBtn.addEventListener("click", function () {
        document.getElementById("checkout-cash-btn").classList.remove("active");
        onlineBtn.classList.add("active");
      });
    }
  } else if (balance < 0) {
    // Show refund UI for negative balance with custom input
    const refundAmount = Math.abs(balance);
    paymentOrRefundSection.innerHTML = `
      <div class="refund-container">
        <div class="refund-title">
          <i class="fas fa-hand-holding-usd"></i> Refund Required
        </div>
        <div class="detail-row">
          <div class="detail-label">Available Refund</div>
          <div class="detail-value negative-balance">₹${refundAmount}</div>
        </div>
        <div class="form-group" style="margin-top: 1rem">
          <label class="form-label" for="refund-amount-input">Refund Amount (₹)</label>
          <input
            type="number"
            class="form-control"
            id="refund-amount-input"
            placeholder="Enter refund amount"
            value="${refundAmount}"
            min="1"
            max="${refundAmount}"
            required
          />
          <div class="form-helper" style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--gray);">
            Maximum available refund: ₹${refundAmount}
          </div>
        </div>
        <div class="form-group" style="margin-top: 1rem">
          <label class="form-label">Refund Method</label>
          <div class="payment-options">
            <button
              type="button"
              class="payment-btn cash active"
              id="refund-cash-btn"
            >
              <i class="fas fa-money-bill"></i> Cash
            </button>
            <button
              type="button"
              class="payment-btn online"
              id="refund-online-btn"
            >
              <i class="fas fa-mobile-alt"></i> Online
            </button>
          </div>
        </div>
        <div id="refund-error-message" class="error-message" style="color: var(--danger); margin-top: 0.5rem; display: none;"></div>
        <button id="process-refund-btn" class="action-btn btn-warning">
          Process Refund
        </button>
      </div>
    `;

    // Refund method selection
    document
      .querySelectorAll(".refund-container .payment-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          document
            .querySelectorAll(".refund-container .payment-btn")
            .forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
        });
      });

    // Process refund button
    const processRefundBtn = document.getElementById("process-refund-btn");
    if (processRefundBtn) {
      processRefundBtn.addEventListener("click", processRefund);
    }

    // Add listener to validate refund amount on input change
    const refundInput = document.getElementById("refund-amount-input");
    if (refundInput) {
      refundInput.addEventListener("input", function () {
        const value = parseInt(this.value) || 0;
        const errorElement = document.getElementById("refund-error-message");
        if (errorElement) {
          if (value <= 0) {
            errorElement.textContent =
              "Please enter a valid amount greater than 0";
            errorElement.style.display = "block";
          } else if (value > refundAmount) {
            errorElement.textContent = `Maximum refund amount is ₹${refundAmount}`;
            errorElement.style.display = "block";
          } else {
            errorElement.style.display = "none";
          }
        }
      });
    }
  }
}
async function processRefund() {
  try {
    // Get room number
    const roomNumberElement = document.getElementById("checkout-room-number");
    if (!roomNumberElement) {
      showNotification("Error: Room number element not found", "error");
      return;
    }
    const roomNumber = roomNumberElement.textContent;

    // Get guest information for logging
    const guestName =
      document.getElementById("checkout-guest-name")?.textContent || "Unknown";

    // Get refund amount from input
    const refundAmountInput = document.getElementById("refund-amount-input");
    if (!refundAmountInput) {
      showNotification("Error: Refund amount input not found", "error");
      return;
    }

    // Parse and validate refund amount
    const refundAmount = parseInt(refundAmountInput.value) || 0;
    const maxRefundAmount = Math.abs(rooms[roomNumber].balance);

    // Validate the refund amount
    if (refundAmount <= 0) {
      showNotification(
        "Please enter a valid refund amount greater than 0",
        "error"
      );
      return;
    }

    if (refundAmount > maxRefundAmount) {
      showNotification(
        `Refund amount cannot exceed ₹${maxRefundAmount}`,
        "error"
      );
      return;
    }

    // Get refund method
    const refundMethod =
      document.querySelector(".refund-container .payment-btn.active")?.id ===
      "refund-cash-btn"
        ? "cash"
        : "online";

    // Show loading state on button
    const btn = document.getElementById("process-refund-btn");
    if (!btn) {
      showNotification("Error: Process refund button not found", "error");
      return;
    }

    btn.disabled = true;
    btn.innerHTML =
      '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

    // Clear any previous error messages
    const errorElement = document.getElementById("refund-error-message");
    if (errorElement) {
      errorElement.style.display = "none";
    }

    debugLog(
      `Processing refund of ₹${refundAmount} via ${refundMethod} for room ${roomNumber}`
    );

    // Make API request with all necessary information
    const response = await fetch("/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: roomNumber,
        name: guestName, // Include guest name for proper logging
        payment_mode: refundMethod,
        amount: refundAmount,
        is_refund: true,
        process_refund: true,
        time: new Date().toTimeString().split(" ")[0].slice(0, 5), // Current time in HH:MM format
        date: new Date().toISOString().split("T")[0], // Current date in YYYY-MM-DD format
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Refund was successful
      debugLog(`Refund processed successfully: ${JSON.stringify(result)}`);

      // Refresh data to get updated room and log information
      await fetchData();

      // Update the checkout modal with new data
      updateCheckoutModal(roomNumber);

      // Show success notification
      showNotification(
        `Refund of ₹${refundAmount} processed successfully via ${refundMethod}!`,
        "success"
      );
    } else {
      // Show error from server
      if (errorElement) {
        errorElement.textContent =
          result.message || "Error processing refund. Please try again.";
        errorElement.style.display = "block";
      }

      showNotification(result.message || "Error processing refund", "error");
    }
  } catch (error) {
    console.error("Error processing refund:", error);

    // Show error in the form
    const errorElement = document.getElementById("refund-error-message");
    if (errorElement) {
      errorElement.textContent = `Error: ${error.message}`;
      errorElement.style.display = "block";
    }

    showNotification(`Error processing refund: ${error.message}`, "error");
  } finally {
    // Always re-enable the button
    const btn = document.getElementById("process-refund-btn");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "Process Refund";
    }
  }
}

// Modify the addPayment function to ensure refunds only appear when appropriate
async function addPayment(mode) {
  try {
    const roomNumberElement = document.getElementById("checkout-room-number");
    if (!roomNumberElement) {
      showNotification("Error: Room number element not found", "error");
      return;
    }

    const roomNumber = roomNumberElement.textContent;
    const amountInput = document.getElementById("checkout-payment-amount");

    if (!amountInput) {
      showNotification("Error: Payment amount field not found", "error");
      return;
    }

    const amount = parseInt(amountInput.value);

    if (!amount || amount <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    // Find which button to use based on mode
    let btn = null;

    // First try to get the add payment button
    const addPaymentBtn = document.getElementById("add-payment-btn");
    if (addPaymentBtn) {
      btn = addPaymentBtn;
    } else {
      // Fall back to individual payment buttons
      btn = document.getElementById(`checkout-${mode}-btn`);
    }

    // Show loading state if the button exists
    let originalContent = "";
    if (btn) {
      originalContent = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML =
        '<span class="loader" style="width: 14px; height: 14px;"></span> Processing...';
    } else {
      console.warn(
        `Button for payment mode ${mode} not found, proceeding anyway`
      );
    }

    // Proceed with payment API call
    const response = await fetch("/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: roomNumber,
        payment_mode: mode,
        amount: amount,
        is_refund: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    await fetchData();

    // Update the checkout modal
    updateCheckoutModal(roomNumber);

    showNotification(
      result.message || `Payment of ₹${amount} added successfully`,
      "success"
    );
  } catch (error) {
    console.error("Error adding payment:", error);
    showNotification(`Error adding payment: ${error.message}`, "error");
  } finally {
    // Re-enable buttons if they exist
    const addPaymentBtn = document.getElementById("add-payment-btn");
    const cashBtn = document.getElementById("checkout-cash-btn");
    const onlineBtn = document.getElementById("checkout-online-btn");

    if (addPaymentBtn) {
      addPaymentBtn.disabled = false;
      addPaymentBtn.innerHTML =
        '<i class="fas fa-plus-circle"></i> Add Payment';
    }

    if (cashBtn) {
      cashBtn.disabled = false;
      cashBtn.innerHTML = '<i class="fas fa-money-bill"></i> Cash';
    }

    if (onlineBtn) {
      onlineBtn.disabled = false;
      onlineBtn.innerHTML = '<i class="fas fa-mobile-alt"></i> Online';
    }
  }
}

// Update the checkin form submission to use the selected room number
document.addEventListener("DOMContentLoaded", function () {
  // Updated check-in form submission with proper null checks
  const checkinForm = document.getElementById("checkin-form");
  if (checkinForm) {
    checkinForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Get room number - either from dropdown or fallback to the span
      let roomNumber = "";
      const roomDropdown = document.getElementById("checkin-room-dropdown");
      if (roomDropdown && roomDropdown.value) {
        roomNumber = roomDropdown.value;
      } else {
        const roomNumberElement = document.getElementById(
          "checkin-room-number"
        );
        if (roomNumberElement) {
          roomNumber = roomNumberElement.textContent;
        }
      }

      if (!roomNumber) {
        showNotification("Please select a room number", "error");
        return;
      }

      // Get form values with null checks
      const guestNameInput = document.getElementById("guest-name");
      const guestMobileInput = document.getElementById("guest-mobile");
      const roomPriceInput = document.getElementById("room-price");
      const guestCountInput = document.getElementById("guest-count");
      const amountPaidInput = document.getElementById("amount-paid");
      const paymentMethodInput = document.getElementById("payment-method");

      if (
        !guestNameInput ||
        !guestMobileInput ||
        !roomPriceInput ||
        !guestCountInput ||
        !amountPaidInput ||
        !paymentMethodInput
      ) {
        showNotification("Required form fields are missing", "error");
        return;
      }

      const guestName = guestNameInput.value;
      const guestMobile = guestMobileInput.value;
      const roomPrice = roomPriceInput.value;
      const guestCount = guestCountInput.value;
      const amountPaid = parseInt(amountPaidInput.value || "0");
      const paymentMethod = paymentMethodInput.value;

      if (!guestName || !guestMobile || !roomPrice || !guestCount) {
        showNotification("Please fill all required fields", "error");
        return;
      }

      // Don't allow amount paid > 0 when payment method is "balance"
      if (amountPaid > 0 && paymentMethod === "balance") {
        showNotification(
          'Cannot select "Pay Later" when amount is provided. Please select Cash or Online payment method.',
          "error"
        );
        return;
      }

      // Disable submit button and show loading state
      const submitBtn = e.target.querySelector("button[type=submit]");
      if (!submitBtn) {
        showNotification("Submit button not found", "error");
        return;
      }

      const originalContent = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

      try {
        const response = await fetch("/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room: roomNumber,
            name: guestName,
            mobile: guestMobile,
            price: roomPrice,
            guests: guestCount,
            payment: paymentMethod,
            amountPaid: amountPaid,
            photoPath: uploadedPhotoUrl,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          checkinModal.classList.remove("show");
          await fetchData();
          showNotification(result.message || "Check-in successful!", "success");
        } else {
          showNotification(result.message || "Error during check-in", "error");
        }
      } catch (error) {
        console.error("Error during check-in:", error);
        showNotification(`Error during check-in: ${error.message}`, "error");
      } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Complete Check-in";
      }
    });
  } else {
    debugLog("Check-in form not found");
  }
});

// Report password protection logic
const REPORT_PASSWORD = "admin123"; // You can change this to any password you want
let reportPasswordVerified = false;

// Function to handle reports tab access
function handleReportsTabAccess() {
  // Skip password check if already verified
  if (reportPasswordVerified) {
    showReportsTab();
    return;
  }

  // Show password modal
  const passwordModal = document.getElementById("password-modal");
  if (!passwordModal) {
    debugLog("Password modal not found");
    return;
  }

  passwordModal.classList.add("show");

  // Clear previous password input and error
  const passwordInput = document.getElementById("report-password");
  const passwordError = document.getElementById("password-error");

  if (passwordInput) {
    passwordInput.value = "";
    passwordInput.focus();
  }

  if (passwordError) {
    passwordError.style.display = "none";
  }
}

// Function to verify password
function verifyReportPassword() {
  const passwordInput = document.getElementById("report-password");
  const passwordError = document.getElementById("password-error");
  const passwordModal = document.getElementById("password-modal");

  if (!passwordInput || !passwordError || !passwordModal) {
    debugLog("Password elements not found");
    return;
  }

  const password = passwordInput.value;

  if (password === REPORT_PASSWORD) {
    // Password correct
    reportPasswordVerified = true;
    passwordModal.classList.remove("show");
    showReportsTab();
  } else {
    // Password incorrect
    passwordError.style.display = "block";
    passwordInput.value = "";
    passwordInput.focus();
  }
}

// Function to show reports tab
function showReportsTab() {
  // Show the reports tab
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.add("hidden");
  });

  const reportsTab = document.getElementById("reports-tab");
  if (reportsTab) {
    reportsTab.classList.remove("hidden");
  }

  // Update nav items
  document.querySelectorAll(".nav-item").forEach((navItem) => {
    navItem.classList.remove("active");
  });

  const reportsNavItem = document.querySelector(
    '.nav-item[data-tab="reports"]'
  );
  if (reportsNavItem) {
    reportsNavItem.classList.add("active");
  }
}

// Setup event listeners for password modal
document.addEventListener("DOMContentLoaded", function () {
  // Override reports tab click handler
  const reportsNavItem = document.querySelector(
    '.nav-item[data-tab="reports"]'
  );
  if (reportsNavItem) {
    reportsNavItem.addEventListener(
      "click",
      function (e) {
        e.stopPropagation(); // Prevent default tab click behavior
        handleReportsTabAccess();
      },
      true
    ); // Use capture to intercept event before other handlers
  }

  // Password submit button
  const passwordSubmitBtn = document.getElementById("password-submit-btn");
  if (passwordSubmitBtn) {
    passwordSubmitBtn.addEventListener("click", verifyReportPassword);
  }

  // Password cancel button
  const passwordCancelBtn = document.getElementById("password-cancel-btn");
  if (passwordCancelBtn) {
    passwordCancelBtn.addEventListener("click", function () {
      const passwordModal = document.getElementById("password-modal");
      if (passwordModal) {
        passwordModal.classList.remove("show");
      }
    });
  }

  // Enter key in password field
  const passwordInput = document.getElementById("report-password");
  if (passwordInput) {
    passwordInput.addEventListener("keyup", function (e) {
      if (e.key === "Enter") {
        verifyReportPassword();
      }
    });
  }
});

// Add discount field to checkout modal for existing stays
function addDiscountToCheckoutModal() {
  const balanceRow = document.querySelector(
    "#checkout-modal .detail-row:nth-child(5)"
  );
  if (!balanceRow) return;

  const discountRow = document.createElement("div");
  discountRow.className = "detail-row";
  discountRow.innerHTML = `
    <div class="detail-label">
      Discount
      <button id="add-discount-btn" style="background: none; border: none; color: var(--primary); cursor: pointer; margin-left: 5px;">
        <i class="fas fa-plus-circle"></i>
      </button>
    </div>
    <div class="detail-value" id="checkout-discount">₹0</div>
  `;

  balanceRow.parentNode.insertBefore(discountRow, balanceRow);
}

// Discount dialog for existing stays
function createDiscountDialog() {
  const dialog = document.createElement("div");
  dialog.className = "modal-backdrop";
  dialog.id = "discount-modal";
  dialog.innerHTML = `
    <div class="modal-content" style="max-width: 400px">
      <div class="modal-header">
        <h2>Apply Discount</h2>
        <button class="close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="form-group">
        <label class="form-label" for="discount-amount">Discount Amount (₹)</label>
        <input type="number" class="form-control" id="discount-amount" min="0" value="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Discount Reason</label>
        <select class="form-control" id="discount-reason">
          <option value="Regular Customer">Regular Customer</option>
          <option value="Special Offer">Special Offer</option>
          <option value="Long Stay">Long Stay</option>
          <option value="Complaint Resolution">Complaint Resolution</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group" id="other-reason-container" style="display: none;">
        <label class="form-label" for="other-discount-reason">Specify Reason</label>
        <input type="text" class="form-control" id="other-discount-reason" />
      </div>
      <button id="apply-discount-btn" class="action-btn btn-primary">Apply Discount</button>
    </div>
  `;

  document.body.appendChild(dialog);

  // Event handlers for discount dialog
  document
    .querySelector("#discount-modal .close-btn")
    .addEventListener("click", () => {
      document.getElementById("discount-modal").classList.remove("show");
    });

  document
    .getElementById("discount-reason")
    .addEventListener("change", function () {
      if (this.value === "Other") {
        document.getElementById("other-reason-container").style.display =
          "block";
      } else {
        document.getElementById("other-reason-container").style.display =
          "none";
      }
    });

  document
    .getElementById("apply-discount-btn")
    .addEventListener("click", applyDiscount);
}

// Apply discount function
async function applyDiscount() {
  const roomNumber = document.getElementById(
    "checkout-room-number"
  ).textContent;
  const discountAmount =
    parseInt(document.getElementById("discount-amount").value) || 0;
  const discountReason = document.getElementById("discount-reason").value;

  // Get actual reason text (handle the "Other" case)
  let reason = discountReason;
  if (discountReason === "Other") {
    reason = document.getElementById("other-discount-reason").value || "Other";
  }

  // Validation
  if (discountAmount <= 0) {
    showNotification("Please enter a valid discount amount", "error");
    return;
  }

  try {
    const submitBtn = document.getElementById("apply-discount-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

    const response = await fetch("/apply_discount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: roomNumber,
        amount: discountAmount,
        reason: reason,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
      // Close discount modal
      document.getElementById("discount-modal").classList.remove("show");

      // Update room data
      await fetchData();

      // Update checkout modal UI
      updateCheckoutModal(roomNumber);

      showNotification(
        `Discount of ₹${discountAmount} applied successfully`,
        "success"
      );
    } else {
      showNotification(result.message || "Failed to apply discount", "error");
    }
  } catch (error) {
    console.error("Error applying discount:", error);
    showNotification(`Error applying discount: ${error.message}`, "error");
  } finally {
    const submitBtn = document.getElementById("apply-discount-btn");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Apply Discount";
    }
  }
}

// Update checkout modal to include discount
function updateCheckoutModalWithDiscount(roomNumber) {
  const roomInfo = rooms[roomNumber];
  if (!roomInfo || !roomInfo.guest) return;

  // Update discount display
  const discountEl = document.getElementById("checkout-discount");
  if (discountEl) {
    let totalDiscount = 0;

    // Sum up all discounts from logs
    if (roomInfo.discounts && Array.isArray(roomInfo.discounts)) {
      totalDiscount = roomInfo.discounts.reduce(
        (sum, discount) => sum + discount.amount,
        0
      );
    }

    discountEl.textContent = "₹" + totalDiscount;

    // Change color if discount exists
    if (totalDiscount > 0) {
      discountEl.style.color = "var(--success)";
    } else {
      discountEl.style.color = "";
    }
  }

  // Add discount event listener
  const addDiscountBtn = document.getElementById("add-discount-btn");
  if (addDiscountBtn) {
    addDiscountBtn.onclick = function () {
      document.getElementById("discount-modal").classList.add("show");
      document.getElementById("discount-amount").value = "";
      document.getElementById("discount-amount").focus();
    };
  }
}

// Initialize discount functionality
function initializeDiscountFeature() {
  addDiscountToCheckoutModal();
  createDiscountDialog();

  // Update the original updateCheckoutModal function to include discount info
  const originalUpdateCheckoutModal = updateCheckoutModal;
  window.updateCheckoutModal = function (roomNumber) {
    // Call the original function first
    originalUpdateCheckoutModal(roomNumber);

    // Then add our discount updates
    updateCheckoutModalWithDiscount(roomNumber);
  };
}

document.addEventListener("DOMContentLoaded", function () {
  // Call this after the page is fully loaded
  setTimeout(initializeDiscountFeature, 1000);
  if (typeof initBookings === "function") {
    initBookings();
  }
});
