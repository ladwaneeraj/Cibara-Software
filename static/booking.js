// Booking Module Variables
let bookings = [];
let filteredBookings = [];
let currentBookingFilter = "upcoming";

// DOM Elements
document.addEventListener("DOMContentLoaded", function () {
  // Initialize booking tab
  const bookingNavItem = document.querySelector(
    '.nav-item[data-tab="bookings"]'
  );
  if (bookingNavItem) {
    bookingNavItem.addEventListener("click", function () {
      // Update nav items
      document.querySelectorAll(".nav-item").forEach((navItem) => {
        navItem.classList.remove("active");
      });
      this.classList.add("active");

      // Update tabs content
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.add("hidden");
      });

      const bookingsTab = document.getElementById("bookings-tab");
      if (bookingsTab) {
        bookingsTab.classList.remove("hidden");
        fetchBookings(); // Refresh bookings when tab is opened
      }
    });
  }

  // New Booking Button
  const newBookingBtn = document.getElementById("new-booking-btn");
  if (newBookingBtn) {
    newBookingBtn.addEventListener("click", showNewBookingModal);
  }

  // Initialize Booking Form
  initializeBookingForm();

  // Initialize Modals
  document.querySelectorAll(".close-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".modal-backdrop").forEach((modal) => {
        modal.classList.remove("show");
      });
    });
  });

  // Initialize Booking Filters
  document.querySelectorAll(".booking-filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".booking-filter-btn").forEach((b) => {
        b.classList.remove("active");
      });
      this.classList.add("active");
      currentBookingFilter = this.dataset.filter;
      renderBookings();
    });
  });

  // Initialize Convert Booking Form
  initializeConvertBookingForm();

  // Initialize Cancel Booking Form
  initializeCancelBookingForm();

  // Initialize Update Booking Form
  initializeUpdateBookingForm();
});

// Initialize Booking Form
function initializeBookingForm() {
  const bookingForm = document.getElementById("booking-form");
  if (!bookingForm) return;

  // Handle check dates change
  const checkInDate = document.getElementById("booking-check-in");
  const checkOutDate = document.getElementById("booking-check-out");

  if (checkInDate && checkOutDate) {
    // Set min date to today
    const today = new Date().toISOString().split("T")[0];
    checkInDate.min = today;
    checkOutDate.min = today;

    // Update checkout min date when checkin changes
    checkInDate.addEventListener("change", function () {
      checkOutDate.min = this.value;
      if (checkOutDate.value && checkOutDate.value < this.value) {
        checkOutDate.value = this.value;
      }
      checkAvailability();
    });

    checkOutDate.addEventListener("change", function () {
      checkAvailability();
    });
  }

  // Payment Method Selection
  document.querySelectorAll("#booking-form .payment-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#booking-form .payment-btn").forEach((b) => {
        b.classList.remove("active");
      });
      this.classList.add("active");
      const paymentMethod = this.dataset.payment;
      document.getElementById("booking-payment-method").value = paymentMethod;
    });
  });

  // Handle partial payment input
  const totalAmount = document.getElementById("booking-total-amount");
  const partialPayment = document.getElementById("booking-partial-payment");
  const remainingAmount = document.getElementById("booking-remaining-amount");

  if (totalAmount && partialPayment && remainingAmount) {
    // Calculate remaining amount
    const calculateRemaining = () => {
      const total = parseInt(totalAmount.value) || 0;
      const partial = parseInt(partialPayment.value) || 0;
      const remaining = total - partial;

      remainingAmount.textContent = "₹" + remaining;

      // Validate partial payment is not greater than total
      if (partial > total) {
        partialPayment.setCustomValidity(
          "Partial payment cannot exceed total amount"
        );
      } else {
        partialPayment.setCustomValidity("");
      }
    };

    totalAmount.addEventListener("input", calculateRemaining);
    partialPayment.addEventListener("input", calculateRemaining);
  }

  // Form submission
  bookingForm.addEventListener("submit", createBooking);
}

// Create a new booking
async function createBooking(event) {
  event.preventDefault();

  // Get form values
  const room = document.getElementById("booking-room").value;
  const guestName = document.getElementById("booking-guest-name").value;
  const guestMobile = document.getElementById("booking-guest-mobile").value;
  const checkInDate = document.getElementById("booking-check-in").value;
  const checkOutDate = document.getElementById("booking-check-out").value;
  const totalAmount = parseInt(
    document.getElementById("booking-total-amount").value
  );
  const partialPayment = parseInt(
    document.getElementById("booking-partial-payment").value || 0
  );
  const paymentMethod = document.getElementById("booking-payment-method").value;
  const guestCount = parseInt(
    document.getElementById("booking-guest-count").value
  );
  const notes = document.getElementById("booking-notes").value;

  // Validation checks
  if (
    !room ||
    !guestName ||
    !guestMobile ||
    !checkInDate ||
    !checkOutDate ||
    !totalAmount
  ) {
    showNotification("Please fill all required fields", "error");
    return;
  }

  // Validate check-in date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = new Date(checkInDate);
  checkIn.setHours(0, 0, 0, 0);

  if (checkIn < today) {
    showNotification("Check-in date cannot be in the past", "error");
    return;
  }

  // Validate check-out date is after check-in date
  const checkOut = new Date(checkOutDate);
  checkOut.setHours(0, 0, 0, 0);

  if (checkOut < checkIn) {
    showNotification("Check-out date must be after check-in date", "error");
    return;
  }

  // Disable submit button
  const submitBtn = event.target.querySelector("button[type=submit]");
  if (!submitBtn) return;

  const originalContent = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML =
    '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

  try {
    // Create booking data
    const bookingData = {
      room,
      guest_name: guestName,
      guest_mobile: guestMobile,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      total_amount: totalAmount,
      paid_amount: partialPayment,
      payment_method: paymentMethod,
      guest_count: guestCount,
      notes,
      photo_path: uploadedPhotoUrl,
    };

    // Send request to create booking
    const response = await fetch("/create_booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Close modal and refresh data
      const newBookingModal = document.getElementById("new-booking-modal");
      if (newBookingModal) {
        newBookingModal.classList.remove("show");
      }

      // Reset form
      event.target.reset();

      // Reset photo
      uploadedPhotoUrl = null;
      const photoPreviewContainer = document.getElementById(
        "booking-photo-preview-container"
      );
      if (photoPreviewContainer) {
        photoPreviewContainer.style.display = "none";
      }

      // Show success notification
      showNotification("Booking created successfully!", "success");

      // Refresh bookings
      fetchBookings();
    } else {
      showNotification(result.message || "Error creating booking", "error");
    }
  } catch (error) {
    console.error("Error creating booking:", error);
    showNotification(`Error creating booking: ${error.message}`, "error");
  } finally {
    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalContent;
  }
}

// Fetch all bookings
async function fetchBookings() {
  try {
    const response = await fetch("/get_bookings");
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      bookings = result.bookings;
      renderBookings();
    } else {
      showNotification(result.message || "Error fetching bookings", "error");
    }
  } catch (error) {
    console.error("Error fetching bookings:", error);
    showNotification(`Error fetching bookings: ${error.message}`, "error");
  }
}

// Render bookings based on filter
function renderBookings() {
  const bookingsList = document.getElementById("bookings-list");
  if (!bookingsList) return;

  // Apply filter
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  filteredBookings = bookings.filter((booking) => {
    if (
      booking.status === "cancelled" &&
      currentBookingFilter !== "cancelled"
    ) {
      return false;
    }

    if (
      booking.status === "checked_in" &&
      currentBookingFilter !== "completed"
    ) {
      return false;
    }

    // For upcoming filter, only show confirmed bookings with future check-in
    if (currentBookingFilter === "upcoming") {
      const checkInDate = new Date(booking.check_in_date);
      return booking.status === "confirmed" && checkInDate >= today;
    }

    // For today filter, show confirmed bookings with today's check-in
    if (currentBookingFilter === "today") {
      const checkInDate = new Date(booking.check_in_date);
      checkInDate.setHours(0, 0, 0, 0);
      return (
        booking.status === "confirmed" &&
        checkInDate.getTime() === today.getTime()
      );
    }

    // For all filter, show all bookings regardless of status
    return true;
  });

  // Sort bookings by check-in date (most recent first for past bookings, soonest first for upcoming)
  filteredBookings.sort((a, b) => {
    const dateA = new Date(a.check_in_date);
    const dateB = new Date(b.check_in_date);

    if (
      currentBookingFilter === "completed" ||
      currentBookingFilter === "cancelled"
    ) {
      return dateB - dateA; // Most recent first for past bookings
    } else {
      return dateA - dateB; // Soonest first for upcoming bookings
    }
  });

  // Show empty state if no bookings
  if (filteredBookings.length === 0) {
    bookingsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-alt fa-3x"></i>
                <p>No ${currentBookingFilter} bookings found</p>
            </div>
        `;
    return;
  }

  // Render bookings
  let html = "";

  filteredBookings.forEach((booking) => {
    // Format dates for display
    const checkInDate = new Date(booking.check_in_date);
    const checkOutDate = new Date(booking.check_out_date);
    const formattedCheckIn = formatDate(checkInDate);
    const formattedCheckOut = formatDate(checkOutDate);

    // Calculate nights
    const nights = Math.round(
      (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
    );

    // Determine status badge color
    let statusBadge = "";
    switch (booking.status) {
      case "confirmed":
        statusBadge = '<span class="status-badge confirmed">Confirmed</span>';
        break;
      case "cancelled":
        statusBadge = '<span class="status-badge cancelled">Cancelled</span>';
        break;
      case "checked_in":
        statusBadge = '<span class="status-badge checked-in">Checked In</span>';
        break;
      default:
        statusBadge = '<span class="status-badge">Unknown</span>';
    }

    // Determine if check-in is today
    const isToday =
      checkInDate.toISOString().split("T")[0] ===
      new Date().toISOString().split("T")[0];
    const todayBadge = isToday ? '<span class="today-badge">Today</span>' : "";

    // Calculate payment status
    const paymentStatus =
      booking.paid_amount === booking.total_amount
        ? '<span class="payment-badge paid">Fully Paid</span>'
        : booking.paid_amount > 0
        ? '<span class="payment-badge partial">Partially Paid</span>'
        : '<span class="payment-badge unpaid">Unpaid</span>';

    html += `
            <div class="booking-item" data-id="${booking.booking_id}">
                <div class="booking-header">
                    <div class="booking-room">Room ${booking.room}</div>
                    <div class="booking-badges">
                        ${statusBadge}
                        ${todayBadge}
                    </div>
                </div>
                <div class="booking-guest">${booking.guest_name}</div>
                <div class="booking-dates">
                    <div><i class="fas fa-calendar-check"></i> ${formattedCheckIn}</div>
                    <div><i class="fas fa-calendar-times"></i> ${formattedCheckOut}</div>
                    <div><i class="fas fa-moon"></i> ${nights} night${
      nights !== 1 ? "s" : ""
    }</div>
                </div>
                <div class="booking-footer">
                    <div class="booking-payment">
                        ${paymentStatus}
                        <div class="booking-amount">₹${
                          booking.total_amount
                        }</div>
                    </div>
                    <div class="booking-actions">
                        <button class="action-btn btn-sm btn-primary view-booking-btn" data-id="${
                          booking.booking_id
                        }">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
  });

  bookingsList.innerHTML = html;

  // Add event listeners to booking items
  document.querySelectorAll(".view-booking-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bookingId = btn.dataset.id;
      showBookingDetails(bookingId);
    });
  });
}

// Format date for display
function formatDate(date) {
  const options = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

// Format date-time for display
function formatDateTime(dateStr) {
  if (!dateStr) return "N/A";

  const date = new Date(dateStr);
  const options = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  return date.toLocaleDateString("en-US", options);
}

// Show booking details modal
function showBookingDetails(bookingId) {
  const booking = bookings.find((b) => b.booking_id === bookingId);
  if (!booking) return;

  const detailsModal = document.getElementById("booking-details-modal");
  if (!detailsModal) return;

  // Calculate stay duration
  const checkInDate = new Date(booking.check_in_date);
  const checkOutDate = new Date(booking.check_out_date);
  const nights = Math.round(
    (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
  );

  // Format dates
  const formattedCheckIn = formatDate(checkInDate);
  const formattedCheckOut = formatDate(checkOutDate);
  const bookingDate = formatDateTime(booking.booking_date);

  // Set booking details
  document.getElementById("details-booking-id").textContent = bookingId;
  document.getElementById("details-room-number").textContent = booking.room;
  document.getElementById("details-guest-name").textContent =
    booking.guest_name;
  document.getElementById("details-guest-mobile").textContent =
    booking.guest_mobile;
  document.getElementById(
    "details-guest-mobile-link"
  ).href = `tel:${booking.guest_mobile}`;
  document.getElementById("details-check-in").textContent = formattedCheckIn;
  document.getElementById("details-check-out").textContent = formattedCheckOut;
  document.getElementById("details-booking-date").textContent = bookingDate;
  document.getElementById("details-nights").textContent = `${nights} night${
    nights !== 1 ? "s" : ""
  }`;
  document.getElementById("details-guests").textContent =
    booking.guest_count || 1;
  document.getElementById(
    "details-total-amount"
  ).textContent = `₹${booking.total_amount}`;
  document.getElementById(
    "details-paid-amount"
  ).textContent = `₹${booking.paid_amount}`;
  document.getElementById(
    "details-balance"
  ).textContent = `₹${booking.balance}`;
  document.getElementById("details-status").textContent =
    booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
  document.getElementById("details-notes").textContent =
    booking.notes || "No notes";

  // Set status class
  const statusEl = document.getElementById("details-status");
  statusEl.className = ""; // Clear previous classes
  statusEl.classList.add(`status-${booking.status}`);

  // Display photo if available
  const photoContainer = document.getElementById("details-photo-container");
  if (photoContainer) {
    if (booking.photo_path) {
      const photoImg = document.getElementById("details-guest-photo");
      if (photoImg) {
        photoImg.src = booking.photo_path;
        photoContainer.style.display = "block";
      }
    } else {
      photoContainer.style.display = "none";
    }
  }

  // Set up action buttons based on booking status
  const updateBtn = document.getElementById("update-booking-btn");
  const convertBtn = document.getElementById("convert-booking-btn");
  const cancelBtn = document.getElementById("cancel-booking-btn");
  const addPaymentBtn = document.getElementById("add-payment-btn");

  if (updateBtn)
    updateBtn.style.display = booking.status === "confirmed" ? "block" : "none";
  if (convertBtn) {
    // Show convert button for confirmed bookings that are today or in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(booking.check_in_date);
    checkIn.setHours(0, 0, 0, 0);

    convertBtn.style.display =
      booking.status === "confirmed" && checkIn <= today ? "block" : "none";
  }
  if (cancelBtn)
    cancelBtn.style.display = booking.status === "confirmed" ? "block" : "none";
  if (addPaymentBtn) {
    // Show add payment button for confirmed bookings with remaining balance
    addPaymentBtn.style.display =
      booking.status === "confirmed" && booking.balance > 0 ? "block" : "none";
  }

  // Set up button event listeners
  if (updateBtn) {
    updateBtn.onclick = () => {
      showUpdateBookingModal(bookingId);
      detailsModal.classList.remove("show");
    };
  }

  if (convertBtn) {
    convertBtn.onclick = () => {
      showConvertBookingModal(bookingId);
      detailsModal.classList.remove("show");
    };
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      showCancelBookingModal(bookingId);
      detailsModal.classList.remove("show");
    };
  }

  if (addPaymentBtn) {
    addPaymentBtn.onclick = () => {
      showAddPaymentModal(bookingId);
      detailsModal.classList.remove("show");
    };
  }

  // Show the modal
  detailsModal.classList.add("show");
}

// Updated checkAvailability function for frontend
async function checkAvailability() {
  const checkInDate = document.getElementById("booking-check-in").value;
  const checkOutDate = document.getElementById("booking-check-out").value;
  const roomSelect = document.getElementById("booking-room");

  if (!checkInDate || !checkOutDate || !roomSelect) return;

  try {
    // Show loading indicator
    roomSelect.innerHTML = '<option value="">Checking availability...</option>';

    const response = await fetch("/check_availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Populate room select with available rooms
      const availableRooms = result.available_rooms;

      if (availableRooms.length === 0) {
        roomSelect.innerHTML = '<option value="">No rooms available</option>';
        showNotification(
          "No rooms available for the selected dates",
          "warning"
        );
      } else {
        roomSelect.innerHTML = '<option value="">Select a room</option>';

        // Group rooms by floor
        const firstFloor = availableRooms.filter(
          (room) => !room.startsWith("2")
        );
        const secondFloor = availableRooms.filter((room) =>
          room.startsWith("2")
        );

        // Sort rooms numerically within each floor
        firstFloor.sort((a, b) => parseInt(a) - parseInt(b));
        secondFloor.sort((a, b) => parseInt(a) - parseInt(b));

        // Add first floor rooms
        if (firstFloor.length > 0) {
          const firstFloorGroup = document.createElement("optgroup");
          firstFloorGroup.label = "First Floor";

          firstFloor.forEach((room) => {
            const option = document.createElement("option");
            option.value = room;
            option.textContent = `Room ${room}`;
            firstFloorGroup.appendChild(option);
          });

          roomSelect.appendChild(firstFloorGroup);
        }

        // Add second floor rooms
        if (secondFloor.length > 0) {
          const secondFloorGroup = document.createElement("optgroup");
          secondFloorGroup.label = "Second Floor";

          secondFloor.forEach((room) => {
            const option = document.createElement("option");
            option.value = room;
            option.textContent = `Room ${room}`;
            secondFloorGroup.appendChild(option);
          });

          roomSelect.appendChild(secondFloorGroup);
        }

        // Log for debugging
        console.log(
          `Found ${availableRooms.length} available rooms for dates ${checkInDate} to ${checkOutDate}`
        );
      }
    } else {
      roomSelect.innerHTML =
        '<option value="">Error checking availability</option>';
      showNotification(
        result.message || "Error checking availability",
        "error"
      );
    }
  } catch (error) {
    console.error("Error checking availability:", error);
    roomSelect.innerHTML =
      '<option value="">Error checking availability</option>';
    showNotification(`Error checking availability: ${error.message}`, "error");
  }
}

// Helper function to check if a date is today
function isToday(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Show new booking modal
function showNewBookingModal() {
  const modal = document.getElementById("new-booking-modal");
  if (!modal) return;

  // Reset form
  const form = document.getElementById("booking-form");
  if (form) form.reset();

  // Reset room select
  const roomSelect = document.getElementById("booking-room");
  if (roomSelect)
    roomSelect.innerHTML =
      '<option value="">Select dates to check availability</option>';

  // Set default dates (today and tomorrow)
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const checkInDate = document.getElementById("booking-check-in");
  const checkOutDate = document.getElementById("booking-check-out");

  if (checkInDate) checkInDate.value = today.toISOString().split("T")[0];
  if (checkOutDate) checkOutDate.value = tomorrow.toISOString().split("T")[0];

  // Reset payment method
  document.querySelectorAll("#booking-form .payment-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const cashBtn = document.querySelector("#booking-form .payment-btn.cash");
  if (cashBtn) cashBtn.classList.add("active");

  const paymentMethodInput = document.getElementById("booking-payment-method");
  if (paymentMethodInput) paymentMethodInput.value = "cash";

  // Reset photo preview
  const photoPreviewContainer = document.getElementById(
    "booking-photo-preview-container"
  );
  if (photoPreviewContainer) photoPreviewContainer.style.display = "none";

  uploadedPhotoUrl = null;

  // Check availability for default dates
  checkAvailability();

  // Show modal
  modal.classList.add("show");
}

// Show cancel booking modal
function showCancelBookingModal(bookingId) {
  const booking = bookings.find((b) => b.booking_id === bookingId);
  if (!booking) return;

  const modal = document.getElementById("cancel-booking-modal");
  if (!modal) return;

  // Set booking details
  document.getElementById("cancel-booking-id").value = bookingId;
  document.getElementById("cancel-room-number").textContent = booking.room;
  document.getElementById("cancel-guest-name").textContent = booking.guest_name;
  document.getElementById("cancel-check-in").textContent = formatDate(
    new Date(booking.check_in_date)
  );

  // Set refund amount to what was paid
  const refundAmountInput = document.getElementById("cancel-refund-amount");
  if (refundAmountInput) {
    refundAmountInput.max = booking.paid_amount;
    refundAmountInput.value = booking.paid_amount;
  }

  // Show modal
  modal.classList.add("show");
}

// Initialize cancel booking form
function initializeCancelBookingForm() {
  const form = document.getElementById("cancel-booking-form");
  if (!form) return;

  // Payment Method Selection
  document
    .querySelectorAll("#cancel-booking-form .payment-btn")
    .forEach((btn) => {
      btn.addEventListener("click", function () {
        document
          .querySelectorAll("#cancel-booking-form .payment-btn")
          .forEach((b) => {
            b.classList.remove("active");
          });
        this.classList.add("active");
        const paymentMethod = this.dataset.payment;
        document.getElementById("cancel-refund-method").value = paymentMethod;
      });
    });

  // Form submission
  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const bookingId = document.getElementById("cancel-booking-id").value;
    const refundAmount = parseInt(
      document.getElementById("cancel-refund-amount").value || 0
    );
    const refundMethod = document.getElementById("cancel-refund-method").value;
    const reason = document.getElementById("cancel-reason").value;

    // Validation
    if (!bookingId) {
      showNotification("Invalid booking ID", "error");
      return;
    }

    const booking = bookings.find((b) => b.booking_id === bookingId);
    if (!booking) {
      showNotification("Booking not found", "error");
      return;
    }

    if (refundAmount > booking.paid_amount) {
      showNotification("Refund amount cannot exceed paid amount", "error");
      return;
    }

    // Disable submit button
    const submitBtn = event.target.querySelector("button[type=submit]");
    if (!submitBtn) return;

    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

    try {
      const response = await fetch("/cancel_booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          refund_amount: refundAmount,
          refund_method: refundMethod,
          reason: reason,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Close modal and refresh data
        const cancelModal = document.getElementById("cancel-booking-modal");
        if (cancelModal) {
          cancelModal.classList.remove("show");
        }

        // Reset form
        event.target.reset();

        // Show success notification
        showNotification("Booking cancelled successfully!", "success");

        // Refresh bookings
        fetchBookings();
      } else {
        showNotification(result.message || "Error cancelling booking", "error");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      showNotification(`Error cancelling booking: ${error.message}`, "error");
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalContent;
    }
  });
}

// Show convert booking modal
function showConvertBookingModal(bookingId) {
  const booking = bookings.find((b) => b.booking_id === bookingId);
  if (!booking) return;

  const modal = document.getElementById("convert-booking-modal");
  if (!modal) return;

  // Set booking details
  document.getElementById("convert-booking-id").value = bookingId;
  document.getElementById("convert-room-number").textContent = booking.room;
  document.getElementById("convert-guest-name").textContent =
    booking.guest_name;
  document.getElementById("convert-check-in").textContent = formatDate(
    new Date(booking.check_in_date)
  );
  document.getElementById(
    "convert-total-amount"
  ).textContent = `₹${booking.total_amount}`;
  document.getElementById(
    "convert-paid-amount"
  ).textContent = `₹${booking.paid_amount}`;
  document.getElementById(
    "convert-balance"
  ).textContent = `₹${booking.balance}`;

  // Set remaining payment input to the balance amount
  const remainingPayment = document.getElementById("convert-remaining-payment");
  if (remainingPayment) {
    remainingPayment.max = booking.balance;
    remainingPayment.value = booking.balance > 0 ? booking.balance : 0;
  }

  // Show modal
  modal.classList.add("show");
}

// Initialize convert booking form
function initializeConvertBookingForm() {
  const form = document.getElementById("convert-booking-form");
  if (!form) return;

  // Payment Method Selection
  document
    .querySelectorAll("#convert-booking-form .payment-btn")
    .forEach((btn) => {
      btn.addEventListener("click", function () {
        document
          .querySelectorAll("#convert-booking-form .payment-btn")
          .forEach((b) => {
            b.classList.remove("active");
          });
        this.classList.add("active");
        const paymentMethod = this.dataset.payment;
        document.getElementById("convert-payment-method").value = paymentMethod;
      });
    });

  // Form submission
  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const bookingId = document.getElementById("convert-booking-id").value;
    const remainingPayment = parseInt(
      document.getElementById("convert-remaining-payment").value || 0
    );
    const paymentMethod = document.getElementById(
      "convert-payment-method"
    ).value;

    // Validation
    if (!bookingId) {
      showNotification("Invalid booking ID", "error");
      return;
    }

    const booking = bookings.find((b) => b.booking_id === bookingId);
    if (!booking) {
      showNotification("Booking not found", "error");
      return;
    }

    if (remainingPayment > booking.balance) {
      showNotification("Payment amount cannot exceed balance", "error");
      return;
    }

    // Disable submit button
    const submitBtn = event.target.querySelector("button[type=submit]");
    if (!submitBtn) return;

    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

    try {
      const response = await fetch("/convert_booking_to_checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          remaining_payment: remainingPayment,
          payment_method: paymentMethod,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Close modal and refresh data
        const convertModal = document.getElementById("convert-booking-modal");
        if (convertModal) {
          convertModal.classList.remove("show");
        }

        // Reset form
        event.target.reset();

        // Show success notification
        showNotification(
          result.message || "Booking converted to check-in successfully!",
          "success"
        );

        // Refresh bookings and rooms
        fetchBookings();
        fetchData();
      } else {
        showNotification(result.message || "Error converting booking", "error");
      }
    } catch (error) {
      console.error("Error converting booking:", error);
      showNotification(`Error converting booking: ${error.message}`, "error");
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalContent;
    }
  });
}

// Show add payment modal
function showAddPaymentModal(bookingId) {
  const booking = bookings.find((b) => b.booking_id === bookingId);
  if (!booking) return;

  const modal = document.getElementById("add-payment-modal");
  if (!modal) return;

  // Set booking details
  document.getElementById("payment-booking-id").value = bookingId;
  document.getElementById("payment-room-number").textContent = booking.room;
  document.getElementById("payment-guest-name").textContent =
    booking.guest_name;
  document.getElementById(
    "payment-total-amount"
  ).textContent = `₹${booking.total_amount}`;
  document.getElementById(
    "payment-paid-amount"
  ).textContent = `₹${booking.paid_amount}`;
  document.getElementById(
    "payment-balance"
  ).textContent = `₹${booking.balance}`;

  // Set payment amount input to the balance amount
  const paymentAmount = document.getElementById("payment-amount");
  if (paymentAmount) {
    paymentAmount.max = booking.balance;
    paymentAmount.value = booking.balance;
  }

  // Show modal
  modal.classList.add("show");
}

// Initialize add payment form
function initializeAddPaymentForm() {
  const form = document.getElementById("add-payment-form");
  if (!form) return;

  // Payment Method Selection
  document.querySelectorAll("#add-payment-form .payment-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll("#add-payment-form .payment-btn")
        .forEach((b) => {
          b.classList.remove("active");
        });
      this.classList.add("active");
      const paymentMethod = this.dataset.payment;
      document.getElementById("payment-method").value = paymentMethod;
    });
  });

  // Form submission
  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const bookingId = document.getElementById("payment-booking-id").value;
    const paymentAmount = parseInt(
      document.getElementById("payment-amount").value || 0
    );
    const paymentMethod = document.getElementById("payment-method").value;

    // Validation
    if (!bookingId) {
      showNotification("Invalid booking ID", "error");
      return;
    }

    const booking = bookings.find((b) => b.booking_id === bookingId);
    if (!booking) {
      showNotification("Booking not found", "error");
      return;
    }

    if (paymentAmount <= 0) {
      showNotification("Payment amount must be greater than zero", "error");
      return;
    }

    if (paymentAmount > booking.balance) {
      showNotification("Payment amount cannot exceed balance", "error");
      return;
    }

    // Disable submit button
    const submitBtn = event.target.querySelector("button[type=submit]");
    if (!submitBtn) return;

    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

    try {
      const response = await fetch("/update_booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          new_payment: paymentAmount,
          payment_method: paymentMethod,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Close modal and refresh data
        const paymentModal = document.getElementById("add-payment-modal");
        if (paymentModal) {
          paymentModal.classList.remove("show");
        }

        // Reset form
        event.target.reset();

        // Show success notification
        showNotification(
          `Payment of ₹${paymentAmount} added successfully!`,
          "success"
        );

        // Refresh bookings
        fetchBookings();
      } else {
        showNotification(result.message || "Error adding payment", "error");
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      showNotification(`Error adding payment: ${error.message}`, "error");
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalContent;
    }
  });
}

// Show update booking modal
function showUpdateBookingModal(bookingId) {
  const booking = bookings.find((b) => b.booking_id === bookingId);
  if (!booking) return;

  const modal = document.getElementById("update-booking-modal");
  if (!modal) return;

  // Set form fields
  document.getElementById("update-booking-id").value = bookingId;
  document.getElementById("update-guest-name").value = booking.guest_name;
  document.getElementById("update-guest-mobile").value = booking.guest_mobile;
  document.getElementById("update-check-in").value = booking.check_in_date;
  document.getElementById("update-check-out").value = booking.check_out_date;
  document.getElementById("update-guest-count").value =
    booking.guest_count || 1;
  document.getElementById("update-total-amount").value = booking.total_amount;
  document.getElementById("update-notes").value = booking.notes || "";

  // Set room options
  updateRoomOptions(
    booking.room,
    booking.check_in_date,
    booking.check_out_date
  );

  // Show modal
  modal.classList.add("show");
}

// Initialize update booking form
function initializeUpdateBookingForm() {
  const form = document.getElementById("update-booking-form");
  if (!form) return;

  // Handle check dates change
  const checkInDate = document.getElementById("update-check-in");
  const checkOutDate = document.getElementById("update-check-out");

  if (checkInDate && checkOutDate) {
    // Set min date to today
    const today = new Date().toISOString().split("T")[0];
    checkInDate.min = today;
    checkOutDate.min = today;

    // Update checkout min date when checkin changes
    checkInDate.addEventListener("change", function () {
      checkOutDate.min = this.value;
      if (checkOutDate.value && checkOutDate.value < this.value) {
        checkOutDate.value = this.value;
      }

      const bookingId = document.getElementById("update-booking-id").value;
      const booking = bookings.find((b) => b.booking_id === bookingId);
      if (booking) {
        updateRoomOptions(booking.room, this.value, checkOutDate.value);
      }
    });

    checkOutDate.addEventListener("change", function () {
      const bookingId = document.getElementById("update-booking-id").value;
      const booking = bookings.find((b) => b.booking_id === bookingId);
      if (booking) {
        updateRoomOptions(booking.room, checkInDate.value, this.value);
      }
    });
  }

  // Form submission
  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const bookingId = document.getElementById("update-booking-id").value;
    const guestName = document.getElementById("update-guest-name").value;
    const guestMobile = document.getElementById("update-guest-mobile").value;
    const checkInDate = document.getElementById("update-check-in").value;
    const checkOutDate = document.getElementById("update-check-out").value;
    const room = document.getElementById("update-room").value;
    const guestCount = parseInt(
      document.getElementById("update-guest-count").value
    );
    const totalAmount = parseInt(
      document.getElementById("update-total-amount").value
    );
    const notes = document.getElementById("update-notes").value;

    // Validation
    if (
      !bookingId ||
      !guestName ||
      !guestMobile ||
      !checkInDate ||
      !checkOutDate ||
      !room ||
      !totalAmount
    ) {
      showNotification("Please fill all required fields", "error");
      return;
    }

    const booking = bookings.find((b) => b.booking_id === bookingId);
    if (!booking) {
      showNotification("Booking not found", "error");
      return;
    }

    // Validate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(checkOutDate);
    checkOut.setHours(0, 0, 0, 0);

    if (
      checkIn < today &&
      checkIn.getTime() !== new Date(booking.check_in_date).getTime()
    ) {
      showNotification("Check-in date cannot be in the past", "error");
      return;
    }

    if (checkOut <= checkIn) {
      showNotification("Check-out date must be after check-in date", "error");
      return;
    }

    // Disable submit button
    const submitBtn = event.target.querySelector("button[type=submit]");
    if (!submitBtn) return;

    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';

    try {
      const response = await fetch("/update_booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          guest_name: guestName,
          guest_mobile: guestMobile,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          room: room,
          guest_count: guestCount,
          total_amount: totalAmount,
          notes: notes,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Close modal and refresh data
        const updateModal = document.getElementById("update-booking-modal");
        if (updateModal) {
          updateModal.classList.remove("show");
        }

        // Show success notification
        showNotification("Booking updated successfully!", "success");

        // Refresh bookings
        fetchBookings();
      } else {
        showNotification(result.message || "Error updating booking", "error");
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      showNotification(`Error updating booking: ${error.message}`, "error");
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalContent;
    }
  });
}

// Fixed updateRoomOptions function for editing bookings
async function updateRoomOptions(currentRoom, checkInDate, checkOutDate) {
  const roomSelect = document.getElementById("update-room");
  if (!roomSelect) return;

  try {
    // Show loading indicator
    roomSelect.innerHTML = '<option value="">Checking availability...</option>';

    const response = await fetch("/check_availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Always include the current room in the available rooms list
      // since it should always be an option when editing
      let availableRooms = result.available_rooms;
      if (!availableRooms.includes(currentRoom)) {
        availableRooms = [...availableRooms, currentRoom];
      }

      // Sort room numbers numerically
      availableRooms.sort((a, b) => {
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        return aNum - bNum;
      });

      // Populate room select with available rooms
      if (availableRooms.length === 0) {
        roomSelect.innerHTML = '<option value="">No rooms available</option>';
      } else {
        roomSelect.innerHTML = "";

        // Group rooms by floor
        const firstFloor = availableRooms.filter(
          (room) => !room.startsWith("2")
        );
        const secondFloor = availableRooms.filter((room) =>
          room.startsWith("2")
        );

        // Add first floor rooms
        if (firstFloor.length > 0) {
          const firstFloorGroup = document.createElement("optgroup");
          firstFloorGroup.label = "First Floor";

          firstFloor.forEach((room) => {
            const option = document.createElement("option");
            option.value = room;
            option.textContent = `Room ${room}`;
            if (room === currentRoom) {
              option.selected = true;
            }
            firstFloorGroup.appendChild(option);
          });

          roomSelect.appendChild(firstFloorGroup);
        }

        // Add second floor rooms
        if (secondFloor.length > 0) {
          const secondFloorGroup = document.createElement("optgroup");
          secondFloorGroup.label = "Second Floor";

          secondFloor.forEach((room) => {
            const option = document.createElement("option");
            option.value = room;
            option.textContent = `Room ${room}`;
            if (room === currentRoom) {
              option.selected = true;
            }
            secondFloorGroup.appendChild(option);
          });

          roomSelect.appendChild(secondFloorGroup);
        }
      }
    } else {
      roomSelect.innerHTML =
        '<option value="">Error checking availability</option>';
      showNotification(
        result.message || "Error checking availability",
        "error"
      );
    }
  } catch (error) {
    console.error("Error checking availability:", error);
    roomSelect.innerHTML =
      '<option value="">Error checking availability</option>';
    showNotification(`Error checking availability: ${error.message}`, "error");
  }
}

// Initialize all payment-related forms on page load
document.addEventListener("DOMContentLoaded", function () {
  initializeAddPaymentForm();
});
// Camera functionality for booking photos
document.addEventListener("DOMContentLoaded", function () {
  // Initialize booking camera
  initBookingCamera();
});

// Initialize camera functionality for booking photos
function initBookingCamera() {
  const cameraBtn = document.getElementById("booking-camera-btn");
  const cameraContainer = document.getElementById("booking-camera-container");
  const cameraFeed = document.getElementById("booking-camera-feed");
  const captureBtn = document.getElementById("booking-capture-photo-btn");
  const cancelCameraBtn = document.getElementById("booking-cancel-camera-btn");
  const photoPreviewContainer = document.getElementById(
    "booking-photo-preview-container"
  );
  const photoPreview = document.getElementById("booking-photo-preview");
  const retakePhotoBtn = document.getElementById("booking-retake-photo-btn");
  const fileInput = document.getElementById("booking-guest-photo");

  if (!cameraBtn || !fileInput) {
    debugLog("Booking camera elements not found");
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
      const file = new File([blob], "booking-camera-capture.jpg", {
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
// Calendar View for Bookings
let currentCalendarDate = new Date();
let currentCalendarView = "list"; // 'list' or 'calendar'

// Initialize calendar when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // View selector buttons
  const viewButtons = document.querySelectorAll(".view-btn");
  if (viewButtons.length) {
    viewButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const view = this.dataset.view;
        switchBookingView(view);
      });
    });
  }

  // Calendar navigation buttons
  const prevMonthBtn = document.getElementById("prev-month-btn");
  const nextMonthBtn = document.getElementById("next-month-btn");
  const todayBtn = document.getElementById("today-btn");

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", function () {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", function () {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener("click", function () {
      currentCalendarDate = new Date();
      renderCalendar();
    });
  }

  // Day details modal
  const dayDetailsModal = document.getElementById("day-details-modal");
  if (dayDetailsModal) {
    // Close button for day details modal
    const closeBtn = dayDetailsModal.querySelector(".close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        dayDetailsModal.classList.remove("show");
      });
    }

    // New booking for specific day button
    const newBookingForDayBtn = document.getElementById(
      "new-booking-for-day-btn"
    );
    if (newBookingForDayBtn) {
      newBookingForDayBtn.addEventListener("click", function () {
        const selectedDate =
          document.getElementById("selected-date").dataset.date;
        dayDetailsModal.classList.remove("show");
        showNewBookingModalForDate(selectedDate);
      });
    }
  }
});

// Switch between list and calendar view
function switchBookingView(view) {
  // Update view buttons
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document
    .querySelector(`.view-btn[data-view="${view}"]`)
    .classList.add("active");

  // Update visible content
  const listContainer = document.getElementById("bookings-list");
  const calendarContainer = document.getElementById("bookings-calendar-view");

  if (view === "list") {
    listContainer.classList.remove("hidden");
    calendarContainer.classList.add("hidden");
    currentCalendarView = "list";
  } else {
    listContainer.classList.add("hidden");
    calendarContainer.classList.remove("hidden");
    currentCalendarView = "calendar";

    // Generate the calendar if it's now visible
    renderCalendar();
  }
}

function renderCalendar() {
  const calendarTitle = document.getElementById("calendar-title");
  const calendarDaysGrid = document.getElementById("calendar-days-grid");

  if (!calendarTitle || !calendarDaysGrid) return;

  // Set the calendar title (Month Year)
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  calendarTitle.textContent = `${
    monthNames[currentCalendarDate.getMonth()]
  } ${currentCalendarDate.getFullYear()}`;

  // Clear the calendar grid
  calendarDaysGrid.innerHTML = "";

  // Calculate the first day of the month
  const firstDay = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth(),
    1
  );
  const lastDay = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth() + 1,
    0
  );

  // Get the day of the week for the first day (0 = Sunday, 1 = Monday, etc.)
  const startingDay = firstDay.getDay();

  // Get the number of days in the previous month
  const prevMonthLastDay = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth(),
    0
  ).getDate();

  // Filter bookings for the current month and adjacent days
  const currentMonthBookings = getCurrentMonthBookings();

  // Get today's date for highlighting
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  // Create days from previous month to fill the first row
  for (let i = 0; i < startingDay; i++) {
    const day = prevMonthLastDay - startingDay + i + 1;
    const date = new Date(
      currentCalendarDate.getFullYear(),
      currentCalendarDate.getMonth() - 1,
      day
    );
    const dateStr = formatDateForAPI(date);

    // Get bookings for this day
    const dayBookings = currentMonthBookings.filter((booking) =>
      isDateInBookingRange(
        dateStr,
        booking.check_in_date,
        booking.check_out_date
      )
    );

    calendarDaysGrid.appendChild(
      createDayElement(day, dayBookings, "different-month", dateStr)
    );
  }

  // Create days for current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(
      currentCalendarDate.getFullYear(),
      currentCalendarDate.getMonth(),
      day
    );
    const dateStr = formatDateForAPI(date);

    // Get bookings for this day
    const dayBookings = currentMonthBookings.filter((booking) =>
      isDateInBookingRange(
        dateStr,
        booking.check_in_date,
        booking.check_out_date
      )
    );

    // Check if this is today
    const isToday =
      day === todayDate &&
      currentCalendarDate.getMonth() === todayMonth &&
      currentCalendarDate.getFullYear() === todayYear;

    calendarDaysGrid.appendChild(
      createDayElement(day, dayBookings, isToday ? "today" : "", dateStr)
    );
  }

  // Calculate how many days from the next month to show to complete the grid
  // We want to have complete weeks, so the total should be a multiple of 7
  const totalDaysShown = startingDay + lastDay.getDate();
  const remainingCells = 7 - (totalDaysShown % 7);

  // Only add next month days if needed (if we're not already at the end of a week)
  if (remainingCells < 7) {
    // Create days from next month
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(
        currentCalendarDate.getFullYear(),
        currentCalendarDate.getMonth() + 1,
        day
      );
      const dateStr = formatDateForAPI(date);

      // Get bookings for this day
      const dayBookings = currentMonthBookings.filter((booking) =>
        isDateInBookingRange(
          dateStr,
          booking.check_in_date,
          booking.check_out_date
        )
      );

      calendarDaysGrid.appendChild(
        createDayElement(day, dayBookings, "different-month", dateStr)
      );
    }
  }

  // Optimize display based on screen size
  optimizeCalendarForScreenSize();
}

function createDayElement(dayNumber, bookings, extraClass, dateStr) {
  const dayElement = document.createElement("div");
  dayElement.className = `calendar-day ${extraClass || ""}`;
  dayElement.dataset.date = dateStr;

  // Filter active bookings (not cancelled)
  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  const confirmedBookings = activeBookings.filter(
    (b) => b.status === "confirmed"
  );
  const checkedInBookings = activeBookings.filter(
    (b) => b.status === "checked_in"
  );

  // Add classes for styling based on bookings
  if (confirmedBookings.length > 0) {
    dayElement.classList.add("has-bookings");
  }

  if (checkedInBookings.length > 0) {
    dayElement.classList.add("has-checkins");
  }

  // Create day number
  const dayNumberEl = document.createElement("div");
  dayNumberEl.className = "day-number";
  dayNumberEl.textContent = dayNumber;
  dayElement.appendChild(dayNumberEl);

  // Add booking count if there are any active bookings
  if (activeBookings.length > 0) {
    const bookingCount = document.createElement("div");
    bookingCount.className = `booking-count ${
      activeBookings.length > 1 ? "has-multiple" : ""
    }`;
    bookingCount.textContent = `${activeBookings.length} booking${
      activeBookings.length !== 1 ? "s" : ""
    }`;
    dayElement.appendChild(bookingCount);

    // Show preview of first bookings (limit based on screen size)
    // Initially show up to 2, this will be adjusted by optimizeCalendarForScreenSize
    const maxPreviewsToShow = Math.min(2, activeBookings.length);

    for (let i = 0; i < maxPreviewsToShow; i++) {
      const booking = activeBookings[i];
      const bookingPreview = document.createElement("div");
      bookingPreview.className = `day-booking-preview ${
        booking.status === "checked_in" ? "checked-in" : ""
      }`;
      bookingPreview.textContent = `${booking.room}: ${booking.guest_name}`;
      dayElement.appendChild(bookingPreview);
    }

    // If there are more bookings than we're showing, add indicator
    if (activeBookings.length > maxPreviewsToShow) {
      const moreBookings = document.createElement("div");
      moreBookings.className = "day-booking-preview more-indicator";
      moreBookings.textContent = `+${
        activeBookings.length - maxPreviewsToShow
      } more`;
      dayElement.appendChild(moreBookings);
    }
  }

  // Add click event to show day details
  dayElement.addEventListener("click", function () {
    showDayDetails(dateStr, bookings);
  });

  return dayElement;
}

// Show modal with day details
function showDayDetails(dateStr, bookings) {
  const modal = document.getElementById("day-details-modal");
  const dateTitle = document.getElementById("selected-date");
  const bookingsList = document.getElementById("day-bookings-list");

  if (!modal || !dateTitle || !bookingsList) return;

  // Format date for display
  const selectedDate = new Date(dateStr);
  const formattedDate = formatDateForDisplay(selectedDate);

  // Set the date
  dateTitle.textContent = formattedDate;
  dateTitle.dataset.date = dateStr;

  // Clear previous bookings
  bookingsList.innerHTML = "";

  // Add bookings or show empty state
  if (bookings.length === 0) {
    bookingsList.innerHTML = `
            <div class="empty-state" style="padding: 2rem;">
                <i class="fas fa-calendar-day fa-3x"></i>
                <p>No bookings for this date</p>
            </div>
        `;
  } else {
    // Sort bookings by room number
    bookings.sort((a, b) => {
      return parseInt(a.room) - parseInt(b.room);
    });

    // Add each booking
    bookings.forEach((booking) => {
      const bookingItem = document.createElement("div");
      bookingItem.className = "day-booking-item";
      bookingItem.dataset.id = booking.booking_id;

      const checkInDate = new Date(booking.check_in_date);
      const checkOutDate = new Date(booking.check_out_date);
      const isCheckIn = formatDateForAPI(checkInDate) === dateStr;
      const isCheckOut = formatDateForAPI(checkOutDate) === dateStr;

      // Calculate status badge text
      let statusText =
        booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
      if (isCheckIn && booking.status === "confirmed") {
        statusText = "Check-in Day";
      } else if (
        isCheckOut &&
        (booking.status === "confirmed" || booking.status === "checked_in")
      ) {
        statusText = "Check-out Day";
      }

      bookingItem.innerHTML = `
                <div class="day-booking-header">
                    <div class="day-booking-room">Room ${booking.room}</div>
                    <div class="day-booking-time">
                        ${
                          isCheckIn
                            ? "Check-in"
                            : isCheckOut
                            ? "Check-out"
                            : "Stay"
                        }
                    </div>
                </div>
                <div class="day-booking-guest">${booking.guest_name}</div>
                <div class="day-booking-status">
                    <div class="day-booking-status-badge ${booking.status}">
                        ${statusText}
                    </div>
                    <div class="day-booking-price">₹${
                      booking.total_amount
                    }</div>
                </div>
            `;

      // Add click event to show booking details
      bookingItem.addEventListener("click", function () {
        modal.classList.remove("show");
        showBookingDetails(booking.booking_id);
      });

      bookingsList.appendChild(bookingItem);
    });
  }

  // Show the modal
  modal.classList.add("show");
}

// Show new booking modal with a specific date pre-selected
function showNewBookingModalForDate(dateStr) {
  const modal = document.getElementById("new-booking-modal");
  if (!modal) return;

  // Reset form
  const form = document.getElementById("booking-form");
  if (form) form.reset();

  // Set the selected date
  const checkInDate = document.getElementById("booking-check-in");
  const checkOutDate = document.getElementById("booking-check-out");

  if (checkInDate) checkInDate.value = dateStr;

  // Set check-out date to the next day by default
  if (checkOutDate) {
    const nextDay = new Date(dateStr);
    nextDay.setDate(nextDay.getDate() + 1);
    checkOutDate.value = formatDateForAPI(nextDay);
  }

  // Reset payment method
  document.querySelectorAll("#booking-form .payment-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const cashBtn = document.querySelector("#booking-form .payment-btn.cash");
  if (cashBtn) cashBtn.classList.add("active");

  const paymentMethodInput = document.getElementById("booking-payment-method");
  if (paymentMethodInput) paymentMethodInput.value = "cash";

  // Reset photo preview
  const photoPreviewContainer = document.getElementById(
    "booking-photo-preview-container"
  );
  if (photoPreviewContainer) photoPreviewContainer.style.display = "none";

  uploadedPhotoUrl = null;

  // Check availability for the selected date
  checkAvailability();

  // Show modal
  modal.classList.add("show");
}

// Get bookings for the current month view
function getCurrentMonthBookings() {
  // Get the start and end dates for the calendar view (including adjacent months' days)
  const startDate = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth(),
    1
  );
  startDate.setDate(1 - startDate.getDay()); // Go back to the first day shown on the calendar

  const endDate = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth() + 1,
    0
  );
  const daysAfter = 6 - endDate.getDay();
  endDate.setDate(endDate.getDate() + daysAfter); // Go forward to the last day shown on the calendar

  // Format dates for comparison
  const startDateStr = formatDateForAPI(startDate);
  const endDateStr = formatDateForAPI(endDate);

  // Filter bookings that fall within our calendar view
  return bookings.filter((booking) => {
    const bookingCheckIn = booking.check_in_date;
    const bookingCheckOut = booking.check_out_date;

    // A booking is in our view if:
    // 1. Check-in date is before or equal to the end date of our calendar, AND
    // 2. Check-out date is after or equal to the start date of our calendar
    return bookingCheckIn <= endDateStr && bookingCheckOut >= startDateStr;
  });
}

// Check if a date falls within a booking's date range
function isDateInBookingRange(dateStr, checkInDate, checkOutDate) {
  // Convert to comparable format
  const date = new Date(dateStr);
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  // Reset time components for accurate date comparison
  date.setHours(0, 0, 0, 0);
  checkIn.setHours(0, 0, 0, 0);
  checkOut.setHours(0, 0, 0, 0);

  // A date is in the booking range if:
  // It's on or after the check-in date AND before the check-out date
  // (check-out day itself is not considered part of the stay)
  return date >= checkIn && date < checkOut;
}

// Format date for API (YYYY-MM-DD)
function formatDateForAPI(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Format date for display
function formatDateForDisplay(date) {
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

// Check availability for a specific date
async function checkAvailabilityForDate(dateStr) {
  try {
    // Create a next day date for check_out_date
    const checkInDate = new Date(dateStr);
    const checkOutDate = new Date(dateStr);
    checkOutDate.setDate(checkOutDate.getDate() + 1);

    const response = await fetch("/check_availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        check_in_date: formatDateForAPI(checkInDate),
        check_out_date: formatDateForAPI(checkOutDate),
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      return result.available_rooms;
    } else {
      console.error(result.message || "Error checking availability");
      return [];
    }
  } catch (error) {
    console.error("Error checking availability:", error);
    return [];
  }
}

// Update the original fetchBookings function to also update the calendar
const originalFetchBookings = fetchBookings;
fetchBookings = async function () {
  await originalFetchBookings();

  // If we're in calendar view, refresh the calendar
  if (currentCalendarView === "calendar") {
    renderCalendar();
  }
};
// Optimize the calendar layout for laptop screens
function optimizeCalendarForScreenSize() {
  // Get the container width
  const calendarContainer = document.getElementById("bookings-calendar-view");
  if (!calendarContainer) return;

  // Get current viewport width
  const viewportWidth = window.innerWidth;

  // Apply different styles based on screen size
  if (viewportWidth < 1366) {
    // For standard laptops (1366x768 is common)
    document.documentElement.style.setProperty(
      "--calendar-day-min-height",
      "55px"
    );
    document.documentElement.style.setProperty(
      "--calendar-day-aspect-ratio",
      "1/0.75"
    );
  } else if (viewportWidth < 1600) {
    // For larger laptops
    document.documentElement.style.setProperty(
      "--calendar-day-min-height",
      "65px"
    );
    document.documentElement.style.setProperty(
      "--calendar-day-aspect-ratio",
      "1/0.8"
    );
  } else {
    // For desktops or large screens
    document.documentElement.style.setProperty(
      "--calendar-day-min-height",
      "70px"
    );
    document.documentElement.style.setProperty(
      "--calendar-day-aspect-ratio",
      "1/0.85"
    );
  }

  // Limit the maximum number of booking previews based on cell height
  const calendarDays = document.querySelectorAll(".calendar-day");
  calendarDays.forEach((day) => {
    const dayHeight = day.offsetHeight;
    const bookingPreviews = day.querySelectorAll(".day-booking-preview");

    // Show only as many previews as can fit
    const maxPreviews = Math.floor((dayHeight - 30) / 18); // Approximate calculation
    bookingPreviews.forEach((preview, index) => {
      if (index < maxPreviews) {
        preview.style.display = "block";
      } else {
        preview.style.display = "none";
      }
    });
  });
}

// Add the optimization function to the calendar rendering
const originalRenderCalendar = renderCalendar;
renderCalendar = function () {
  originalRenderCalendar();
  setTimeout(optimizeCalendarForScreenSize, 100); // Run after the calendar is rendered
};

// Run optimization on window resize
window.addEventListener("resize", function () {
  if (currentCalendarView === "calendar") {
    optimizeCalendarForScreenSize();
  }
});

// Update switchBookingView to call optimization when switching to calendar
const originalSwitchBookingView = switchBookingView;
switchBookingView = function (view) {
  originalSwitchBookingView(view);
  if (view === "calendar") {
    setTimeout(optimizeCalendarForScreenSize, 100);
  }
};
function optimizeCalendarForScreenSize() {
  // Get current viewport width
  const viewportWidth = window.innerWidth;

  // Default values for calendar day cells based on screen size
  let minHeight, aspectRatio, maxPreviews;

  if (viewportWidth >= 1600) {
    // Large desktops
    minHeight = "75px";
    aspectRatio = "1/0.85";
    maxPreviews = 3;
  } else if (viewportWidth >= 1366) {
    // Standard laptops
    minHeight = "65px";
    aspectRatio = "1/0.8";
    maxPreviews = 2;
  } else if (viewportWidth >= 992) {
    // Small laptops
    minHeight = "60px";
    aspectRatio = "1/0.75";
    maxPreviews = 1;
  } else if (viewportWidth >= 768) {
    // Tablets
    minHeight = "55px";
    aspectRatio = "1/0.7";
    maxPreviews = 1;
  } else {
    // Mobile
    minHeight = "50px";
    aspectRatio = "auto";
    maxPreviews = 0; // No previews on mobile
  }

  // Set CSS variables
  document.documentElement.style.setProperty(
    "--calendar-day-min-height",
    minHeight
  );
  document.documentElement.style.setProperty(
    "--calendar-day-aspect-ratio",
    aspectRatio
  );

  // Adjust visible previews
  const dayElements = document.querySelectorAll(".calendar-day");

  dayElements.forEach((day) => {
    const previews = day.querySelectorAll(
      ".day-booking-preview:not(.more-indicator)"
    );
    const moreIndicator = day.querySelector(".more-indicator");

    // Hide extra previews based on screen size
    previews.forEach((preview, index) => {
      if (index < maxPreviews) {
        preview.style.display = "block";
      } else {
        preview.style.display = "none";
      }
    });

    // Update more indicator
    if (moreIndicator && previews.length > maxPreviews) {
      moreIndicator.style.display = "block";
      moreIndicator.textContent = `+${previews.length - maxPreviews} more`;
    } else if (moreIndicator) {
      moreIndicator.style.display = "none";
    }
  });
}

// Listen for window resize to optimize calendar
window.addEventListener("resize", function () {
  if (currentCalendarView === "calendar") {
    optimizeCalendarForScreenSize();
  }
});
