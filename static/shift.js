// Quick Room Transfer Functionality
function initQuickTransferButton() {
  const quickTransferBtn = document.getElementById("quick-transfer-btn");
  if (!quickTransferBtn) {
    console.error("Quick transfer button not found");
    return;
  }

  quickTransferBtn.addEventListener("click", function () {
    showQuickTransferModal();

    // Hide the quick action menu
    const quickActionMenu = document.querySelector(".quick-action-menu");
    if (quickActionMenu) {
      quickActionMenu.classList.remove("show");
    }
  });

  // Set up close functionality for the quick transfer modal
  const quickTransferModal = document.getElementById("quick-transfer-modal");
  if (quickTransferModal) {
    const closeBtn = quickTransferModal.querySelector(".close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        quickTransferModal.classList.remove("show");
      });
    }

    const cancelBtn = document.getElementById("cancel-quick-transfer-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        quickTransferModal.classList.remove("show");
      });
    }
  }
}

// Show quick transfer modal
function showQuickTransferModal() {
  const quickTransferModal = document.getElementById("quick-transfer-modal");
  if (!quickTransferModal) {
    console.error("Quick transfer modal not found");
    return;
  }

  const sourceRoomSelect = document.getElementById("quick-source-room");
  const destRoomSelect = document.getElementById("quick-dest-room");
  const quickGuestInfo = document.getElementById("quick-guest-info");
  const quickBalanceInfo = document.getElementById("quick-balance-info");
  const quickGuestName = document.getElementById("quick-guest-name");
  const quickBalance = document.getElementById("quick-balance");

  if (!sourceRoomSelect || !destRoomSelect) {
    console.error("Quick transfer form elements not found");
    return;
  }

  // Reset the form
  quickGuestInfo.style.display = "none";
  quickBalanceInfo.style.display = "none";

  // Populate source room dropdown (only occupied rooms)
  sourceRoomSelect.innerHTML = '<option value="">Select source room</option>';
  let occupiedRoomCount = 0;

  Object.entries(rooms).forEach(([roomNum, info]) => {
    if (info.status === "occupied") {
      const option = document.createElement("option");
      option.value = roomNum;
      option.textContent = `Room ${roomNum} - ${info.guest.name}`;
      sourceRoomSelect.appendChild(option);
      occupiedRoomCount++;
    }
  });

  if (occupiedRoomCount === 0) {
    const option = document.createElement("option");
    option.disabled = true;
    option.textContent = "No occupied rooms available";
    sourceRoomSelect.appendChild(option);
  }

  // Reset destination room dropdown
  destRoomSelect.innerHTML =
    '<option value="">Select destination room</option>';
  destRoomSelect.disabled = true;

  // Set up source room change handler
  sourceRoomSelect.addEventListener("change", function () {
    const selectedRoom = this.value;

    if (!selectedRoom) {
      // Reset UI if no room selected
      quickGuestInfo.style.display = "none";
      quickBalanceInfo.style.display = "none";
      destRoomSelect.innerHTML =
        '<option value="">Select destination room</option>';
      destRoomSelect.disabled = true;
      return;
    }

    // Show guest information
    if (rooms[selectedRoom] && rooms[selectedRoom].guest) {
      const guest = rooms[selectedRoom].guest;

      quickGuestName.textContent = guest.name;
      quickGuestInfo.style.display = "block";

      // Show balance information
      const balance = rooms[selectedRoom].balance;
      if (balance < 0) {
        quickBalance.textContent = `₹${Math.abs(balance)} (refund)`;
        quickBalance.style.color = "var(--success)";
      } else {
        quickBalance.textContent = `₹${balance}`;
        quickBalance.style.color = balance > 0 ? "var(--danger)" : "";
      }
      quickBalanceInfo.style.display = "block";
    }

    // Populate destination room dropdown (only vacant rooms)
    destRoomSelect.innerHTML =
      '<option value="">Select destination room</option>';
    destRoomSelect.disabled = false;

    let vacantRoomCount = 0;

    Object.entries(rooms).forEach(([roomNum, info]) => {
      if (roomNum !== selectedRoom && info.status === "vacant") {
        const option = document.createElement("option");
        option.value = roomNum;
        option.textContent = `Room ${roomNum}`;
        destRoomSelect.appendChild(option);
        vacantRoomCount++;
      }
    });

    if (vacantRoomCount === 0) {
      const option = document.createElement("option");
      option.disabled = true;
      option.textContent = "No vacant rooms available";
      destRoomSelect.appendChild(option);
      destRoomSelect.disabled = true;

      showNotification("No vacant rooms available for transfer", "warning");
    }
  });

  // Set up form submission
  const quickTransferForm = document.getElementById("quick-transfer-form");
  if (quickTransferForm) {
    quickTransferForm.onsubmit = function (e) {
      e.preventDefault();

      const oldRoom = sourceRoomSelect.value;
      const newRoom = destRoomSelect.value;

      if (!oldRoom || !newRoom) {
        showNotification(
          "Please select both source and destination rooms",
          "error"
        );
        return;
      }

      processRoomTransfer(oldRoom, newRoom, quickTransferModal);
    };
  }

  // Show the modal
  quickTransferModal.classList.add("show");
}

// Update processRoomTransfer to accept a modal element parameter
async function processRoomTransfer(oldRoom, newRoom, modalElement = null) {
  console.log(`Processing room transfer from ${oldRoom} to ${newRoom}`);

  if (!oldRoom) {
    console.error("Source room not specified");
    showNotification("Error: Source room not specified", "error");
    return;
  }

  if (!newRoom) {
    showNotification("Please select a destination room", "error");
    return;
  }

  try {
    // Disable the submit button - use the appropriate modal
    const submitBtn = modalElement
      ? modalElement.querySelector("button[type=submit]")
      : document.querySelector("#transfer-room-form button[type=submit]");

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<span class="loader" style="width: 20px; height: 20px;"></span> Processing...';
    }

    // Ensure room numbers are strings for consistency
    const requestData = {
      old_room: String(oldRoom),
      new_room: String(newRoom),
    };

    console.log("Sending transfer request:", requestData);

    const response = await fetch("/transfer_room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });

    console.log("Server response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Response error:", errorText);
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    console.log("Response data:", result);

    if (result.success) {
      // Close the modal that was used (quick transfer or regular transfer)
      if (modalElement) {
        modalElement.classList.remove("show");
      } else {
        // Close both regular modals
        const transferRoomModal = document.getElementById(
          "transfer-room-modal"
        );
        if (transferRoomModal) {
          transferRoomModal.classList.remove("show");
        }

        const checkoutModal = document.getElementById("checkout-modal");
        if (checkoutModal) {
          checkoutModal.classList.remove("show");
        }
      }

      // Refresh data
      await fetchData();

      showNotification(
        result.message || "Room transferred successfully",
        "success"
      );
    } else {
      showNotification(result.message || "Error transferring room", "error");
    }
  } catch (error) {
    console.error("Error transferring room:", error);
    showNotification(`Error: ${error.message}`, "error");
  } finally {
    // Re-enable the submit button - use the appropriate modal
    const submitBtn = modalElement
      ? modalElement.querySelector("button[type=submit]")
      : document.querySelector("#transfer-room-form button[type=submit]");

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Transfer Room";
    }
  }
}

// Initialize the quick transfer button
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(initQuickTransferButton, 1000);
});

// Also initialize after fetchData
const originalFetchData = window.fetchData;
if (typeof originalFetchData === "function") {
  window.fetchData = async function () {
    const result = await originalFetchData.apply(this, arguments);
    setTimeout(initQuickTransferButton, 300);
    return result;
  };
}
