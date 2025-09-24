// Revenue Protection - Mobile-friendly version
(function () {
  // Password for revealing revenue (change this to your preferred password)
  const PASSWORD = "admin123";

  // Flag to track if revenue is visible
  let revenueVisible = false;

  // Save original values
  const originalValues = {};

  // List of ONLY the total revenue elements to protect
  const revenueSelectors = [
    "#today-revenue", // Today's total revenue
    "#total-revenue", // All-time total revenue
  ];

  // Create a custom password modal for mobile friendliness
  function createPasswordModal() {
    const modal = document.createElement("div");
    modal.id = "revenue-password-modal";
    modal.className = "revenue-password-modal";
    modal.innerHTML = `
      <div class="revenue-password-content">
        <div class="revenue-password-header">
          <h3>Enter Password</h3>
          <button class="revenue-password-close">&times;</button>
        </div>
        <div class="revenue-password-body">
          <input type="password" id="revenue-password-input" placeholder="Enter password" class="revenue-password-input">
          <div class="revenue-password-message"></div>
        </div>
        <div class="revenue-password-footer">
          <button class="revenue-password-cancel">Cancel</button>
          <button class="revenue-password-submit">Submit</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    const closeBtn = modal.querySelector(".revenue-password-close");
    const cancelBtn = modal.querySelector(".revenue-password-cancel");
    const submitBtn = modal.querySelector(".revenue-password-submit");
    const input = modal.querySelector("#revenue-password-input");

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
      input.value = "";
    });

    cancelBtn.addEventListener("click", () => {
      modal.style.display = "none";
      input.value = "";
    });

    submitBtn.addEventListener("click", () => {
      validatePassword();
    });

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        validatePassword();
      }
    });

    function validatePassword() {
      const password = input.value;
      const messageElement = modal.querySelector(".revenue-password-message");

      if (password === PASSWORD) {
        messageElement.textContent = "Password correct!";
        messageElement.style.color = "#28a745";

        setTimeout(() => {
          modal.style.display = "none";
          input.value = "";
          messageElement.textContent = "";
          showRevenue();
        }, 500);
      } else {
        messageElement.textContent = "Incorrect password!";
        messageElement.style.color = "#dc3545";
        input.value = "";

        // Clear message after 2 seconds
        setTimeout(() => {
          messageElement.textContent = "";
        }, 2000);
      }
    }

    return modal;
  }

  // Function to show password modal
  function showPasswordModal() {
    const modal = document.getElementById("revenue-password-modal");
    modal.style.display = "flex";

    // Focus on input
    setTimeout(() => {
      const input = document.getElementById("revenue-password-input");
      if (input) input.focus();
    }, 100);
  }

  // Function to hide only total revenue elements
  function hideRevenue() {
    if (revenueVisible) return;

    revenueSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        // Save original value if not already saved
        if (!originalValues[selector]) {
          originalValues[selector] = element.textContent;
        }

        // Hide the value
        element.textContent = "₹***";
        element.classList.add("protected-revenue");
      });
    });
  }

  // Function to show protected revenue
  function showRevenue() {
    revenueVisible = true;

    revenueSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        if (originalValues[selector]) {
          element.textContent = originalValues[selector];
        }
        element.classList.remove("protected-revenue");
      });
    });

    // Automatically hide after timeout
    setTimeout(() => {
      revenueVisible = false;
      hideRevenue();
    }, 15000); // 15 seconds
  }

  // Run protection setup
  function setupProtection() {
    // Add CSS for protected elements and modal
    const style = document.createElement("style");
    style.textContent = `
      .protected-revenue {
        background-color: #f0f0f0;
        border-radius: 4px;
        cursor: pointer;
        position: relative;
      }
      
      .protected-revenue:hover {
        background-color: #e0e0e0;
      }
      
      .protected-revenue:after {
        content: "🔒";
        font-size: 10px;
        position: absolute;
        top: 2px;
        right: 2px;
      }
      
      /* Modal Styles */
      .revenue-password-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
        z-index: 10000;
        justify-content: center;
        align-items: center;
        touch-action: none;
      }
      
      .revenue-password-content {
        background-color: white;
        width: 90%;
        max-width: 350px;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }
      
      .revenue-password-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background-color: #f8f9fa;
        border-bottom: 1px solid #dee2e6;
      }
      
      .revenue-password-header h3 {
        margin: 0;
        font-size: 18px;
      }
      
      .revenue-password-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6c757d;
      }
      
      .revenue-password-body {
        padding: 16px;
      }
      
      .revenue-password-input {
        width: 100%;
        padding: 12px;
        font-size: 16px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        box-sizing: border-box;
      }
      
      .revenue-password-message {
        margin-top: 8px;
        min-height: 20px;
        font-size: 14px;
      }
      
      .revenue-password-footer {
        display: flex;
        justify-content: flex-end;
        padding: 12px 16px;
        background-color: #f8f9fa;
        border-top: 1px solid #dee2e6;
        gap: 8px;
      }
      
      .revenue-password-cancel,
      .revenue-password-submit {
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
      }
      
      .revenue-password-cancel {
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
      }
      
      .revenue-password-submit {
        background-color: var(--primary);
        color: white;
        border: none;
      }
    `;
    document.head.appendChild(style);

    // Create password modal
    createPasswordModal();

    // Initial hide
    hideRevenue();

    // Set up continuous protection
    setInterval(hideRevenue, 1000);

    // Add global click listener for protected elements
    document.addEventListener("click", function (e) {
      if (e.target.classList.contains("protected-revenue")) {
        showPasswordModal();
      }
    });

    // Override renderLogs to protect revenue after logs are rendered
    if (typeof window.renderLogs === "function") {
      const originalRenderLogs = window.renderLogs;
      window.renderLogs = function () {
        originalRenderLogs.apply(this, arguments);
        setTimeout(hideRevenue, 50);
      };
    }

    // Override updateStats to protect revenue after stats are updated
    if (typeof window.updateStats === "function") {
      const originalUpdateStats = window.updateStats;
      window.updateStats = function () {
        originalUpdateStats.apply(this, arguments);

        // Save the updated values first
        revenueSelectors.forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => {
            originalValues[selector] = element.textContent;
          });
        });

        // Then hide if necessary
        if (!revenueVisible) {
          setTimeout(hideRevenue, 50);
        }
      };
    }
  }

  // Run setup when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupProtection);
  } else {
    setupProtection();
  }
})();
