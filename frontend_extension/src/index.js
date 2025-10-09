import { findTextInPage } from './utils.js';
import { extractAmexChecking } from './extractors/amex.js';
import { extractFuture } from './extractors/future.js';
import { extractRobinhood } from './extractors/robinhood.js';

const API_BASE_URL = 'http://127.0.0.1:5000';

// Create and inject styles
const style = document.createElement('style');
style.textContent = `
  .credit-balance-dialog {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 10px;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    z-index: 100000;
    min-width: 200px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    color: black;
  }

  .credit-balance-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .credit-balance-header h3 {
    font-size: 13px;
  }

  .credit-balance-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: #666;
    padding: 0 4px;
  }

  .credit-balance-item {
    margin: 4px 0;
    padding: 3px 0;
    border-bottom: 1px solid #eee;
    font-size: 12px;
  }
  .credit-balance-item:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .credit-balance-amount {
    float: right;
    font-weight: bold;
  }

  .credit-balance-amount.negative {
    color: #dc3545;
  }

  .credit-balance-amount.positive {
    color: #28a745;
  }
  .credit-balance-item button {
    width: 100%;
    text-align: center;
    background-color: #007bff;
    color: white;
    border: none;
    padding: 5px;
    border-radius: 4px;
    cursor: pointer;
  }
  
`;
document.head.appendChild(style);

// Create and inject dialog
function createBalanceDialog(account) {
  const dialog = document.createElement('div');
  dialog.className = 'credit-balance-dialog';

  const header = document.createElement('div');
  header.className = 'credit-balance-header';

  const title = document.createElement('h3');
  title.textContent = 'Account Balances';
  title.style.margin = '0';

  const closeButton = document.createElement('button');
  closeButton.className = 'credit-balance-close';
  closeButton.innerHTML = '×';
  closeButton.onclick = () => dialog.remove();

  header.appendChild(title);
  header.appendChild(closeButton);
  dialog.appendChild(header);

  // Fetch and display balances
  fetch(`${API_BASE_URL}/mars-universe-bank/extension/MarsDashboard/get_balance?account=${account}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Extension-Key': 'your-secret-key-here'
    },
    credentials: 'include'
  })
    .then(response => response.json())
    .then(data => {
      Object.entries(data).forEach(([account, balance]) => {
        const item = document.createElement('div');
        item.className = 'credit-balance-item';

        // Extract account name after last colon
        const accountParts = account.split(':');
        const accountName = accountParts.slice(-2).join(':');

        // Format balance as currency
        const absBalance = Math.abs(balance);
        const formattedBalance = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(absBalance);

        item.innerHTML = `
          ${accountName}
          <span class="credit-balance-amount ${balance < 0 ? 'negative' : 'positive'}">
            ${balance < 0 ? '-' : ''}${formattedBalance}
          </span>
        `;

        dialog.appendChild(item);
        document.body.appendChild(dialog);
      });

      if (findTextInPage('American Express Rewards Checking')) {
        const item = document.createElement('div');
        item.className = 'credit-balance-item';
        const extractButton = document.createElement('button');
        extractButton.textContent = 'Extract';
        extractButton.className = 'credit-balance-extract';
        extractButton.onclick = () => {
          extractAmexChecking();
        };
        item.appendChild(extractButton);
        dialog.appendChild(item);
        document.body.appendChild(dialog);
      }

      if (window.location.href.startsWith("https://robinhood.com/account/history")) {
        const item = document.createElement('div');
        item.className = 'credit-balance-item';
        const extractButton = document.createElement('button');
        extractButton.textContent = 'Extract';
        extractButton.className = 'credit-balance-extract';
        extractButton.onclick = () => {
          extractRobinhood();
        };
        item.appendChild(extractButton);
        dialog.appendChild(item);
        document.body.appendChild(dialog);
      }

      if (window.location.host === "secure.future.green") {
        const item = document.createElement('div');
        item.className = 'credit-balance-item';
        const extractButton = document.createElement('button');
        extractButton.textContent = 'Extract';
        extractButton.className = 'credit-balance-extract';
        extractButton.onclick = () => {
          extractFuture();
        };
        item.appendChild(extractButton);
        dialog.appendChild(item);
        document.body.appendChild(dialog);
      }
    })
    .catch(error => {
      console.error('Error fetching balances:', error);
      dialog.innerHTML += '<div style="color: red">Error loading balances</div>';
    });

}

const url = window.location.host;
let account = null;
if (url.includes("americanexpress")) {
  account = "amex";
} else if (url.includes("chase")) {
  account = "chase";
} else if (url.includes("bankofamerica")) {
  account = "bofa";
} else if (url.includes("wellsfargo")) {
  account = "bilt";
} else if (url.includes("discover")) {
  account = "discover";
} else if (url.includes("robinhood")) {
  account = "robinhood";
} else if (url.includes("future")) {
  account = "future";
} else if (url.includes("td.com") || url.includes("tdbank.com")) {
  account = "td";
}

if (account) {
  console.log("account", account);
  // checkApiAvailability().then(isAvailable => {
  // if (isAvailable) {
  createBalanceDialog(account);
  // } else {
  // console.warn('Balance API is not available');
  // }
  // });
}
