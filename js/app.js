// Expense and Budget Visualizer
// MVC-lite pattern organized into namespace objects

/**
 * Color map for the three supported expense categories.
 * Used by Model.computeChartData and Chart rendering.
 */
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};

// Model namespace — internal `transactions` array is scoped to this closure
const Model = (function () {
  let transactions = [];

  const model = {};

  /**
   * Prepend a transaction to the internal array.
   * @param {Transaction} transaction
   * @returns {Transaction[]} shallow copy of the updated array
   */
  model.addTransaction = function (transaction) {
    transactions.unshift(transaction);
    return [...transactions];
  };

  /**
   * Remove a transaction by its id.
   * @param {string} id
   * @returns {Transaction[]} shallow copy of the updated array
   */
  model.deleteTransaction = function (id) {
    transactions = transactions.filter(function (t) { return t.id !== id; });
    return [...transactions];
  };

  /**
   * Return a shallow copy of all transactions.
   * @returns {Transaction[]}
   */
  model.getAll = function () {
    return [...transactions];
  };

  /**
   * Load transactions from localStorage via Storage.load().
   * Assigns to internal array if result is a valid array.
   * @returns {boolean} true if data was loaded successfully, false otherwise
   */
  model.loadFromStorage = function () {
    const data = Storage.load();
    if (Array.isArray(data)) {
      transactions = data;
      return true;
    }
    return false;
  };

  /**
   * Persist the current transactions array to localStorage via Storage.save().
   */
  model.saveToStorage = function () {
    Storage.save(transactions);
  };

  /**
   * Compute the sum of all transaction amounts.
   * Returns 0 for an empty array; result is rounded to two decimal places.
   * @returns {number}
   */
  model.computeBalance = function () {
    if (transactions.length === 0) {
      return 0;
    }
    const sum = transactions.reduce(function (acc, t) {
      return acc + t.amount;
    }, 0);
    return parseFloat(sum.toFixed(2));
  };

  /**
   * Group transaction amounts by category and return chart-ready data.
   * @returns {{ labels: string[], data: number[], colors: string[] }}
   */
  model.computeChartData = function () {
    if (transactions.length === 0) {
      return { labels: [], data: [], colors: [] };
    }

    // Accumulate totals per category in insertion order
    const totals = {};
    transactions.forEach(function (t) {
      if (Object.prototype.hasOwnProperty.call(totals, t.category)) {
        totals[t.category] += t.amount;
      } else {
        totals[t.category] = t.amount;
      }
    });

    const labels = Object.keys(totals);
    const data   = labels.map(function (cat) {
      return parseFloat(totals[cat].toFixed(2));
    });
    const colors = labels.map(function (cat) {
      return CATEGORY_COLORS[cat] || '#AAAAAA';
    });

    return { labels, data, colors };
  };

  return model;
}());

const Validator = {};

/**
 * Validate the item name field.
 * Trims whitespace, then accepts lengths between 1 and 100 characters.
 * @param {string} value
 * @returns {{ valid: boolean, error: string|null }}
 */
Validator.validateName = function (value) {
  const trimmed = (value || '').trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Item name is required.' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Item name must be 100 characters or fewer.' };
  }
  return { valid: true, error: null };
};

/**
 * Validate the amount field.
 * Parses the value to a float and accepts finite numbers in [0.01, 999999999.99].
 * @param {string|number} value
 * @returns {{ valid: boolean, error: string|null }}
 */
Validator.validateAmount = function (value) {
  const num = parseFloat(value);
  if (!isFinite(num)) {
    return { valid: false, error: 'Amount must be a valid number.' };
  }
  if (num < 0.01) {
    return { valid: false, error: 'Amount must be at least 0.01.' };
  }
  if (num > 999999999.99) {
    return { valid: false, error: 'Amount must not exceed 999,999,999.99.' };
  }
  return { valid: true, error: null };
};

/**
 * Validate the category field.
 * Accepts exactly "Food", "Transport", or "Fun".
 * @param {string} value
 * @returns {{ valid: boolean, error: string|null }}
 */
Validator.validateCategory = function (value) {
  const allowed = ['Food', 'Transport', 'Fun'];
  if (!allowed.includes(value)) {
    return { valid: false, error: 'Category must be Food, Transport, or Fun.' };
  }
  return { valid: true, error: null };
};

/**
 * Validate all form fields at once.
 * @param {{ name: string, amount: string|number, category: string }} formData
 * @returns {{ valid: boolean, errors: { name: FieldValidation, amount: FieldValidation, category: FieldValidation } }}
 */
Validator.validateForm = function (formData) {
  const nameResult     = Validator.validateName(formData.name);
  const amountResult   = Validator.validateAmount(formData.amount);
  const categoryResult = Validator.validateCategory(formData.category);

  const valid = nameResult.valid && amountResult.valid && categoryResult.valid;

  return {
    valid,
    errors: {
      name:     nameResult,
      amount:   amountResult,
      category: categoryResult,
    },
  };
};

const View = {};

/**
 * Rebuild the transaction list in the DOM.
 * Displays an empty-state message when there are no transactions.
 * @param {Transaction[]} transactions
 */
View.renderList = function (transactions) {
  const list = document.getElementById('transaction-list');
  if (!list) return;

  // Clear existing contents
  list.innerHTML = '';

  // Empty state
  if (!transactions || transactions.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'empty-state';
    emptyItem.textContent = 'No transactions yet';
    list.appendChild(emptyItem);
    return;
  }

  // Render one <li> per transaction (most recent first — array order preserved)
  transactions.forEach(function (transaction) {
    const li = document.createElement('li');
    li.className = 'transaction-item';

    // Item name, truncated to 100 chars
    const nameSpan = document.createElement('span');
    nameSpan.className = 'transaction-name';
    nameSpan.textContent = transaction.name.slice(0, 100);

    // Amount formatted to 2 decimal places
    const amountSpan = document.createElement('span');
    amountSpan.className = 'transaction-amount';
    amountSpan.textContent = transaction.amount.toFixed(2);

    // Category label
    const categorySpan = document.createElement('span');
    categorySpan.className = 'transaction-category';
    categorySpan.textContent = transaction.category;

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.dataset.id = transaction.id;

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  });
};

/**
 * Update the balance display element with the given amount.
 * Adds 'negative' CSS class when amount is below zero, removes it otherwise.
 * @param {number} amount
 */
View.renderBalance = function (amount) {
  const el = document.getElementById('balance-display');
  if (!el) return;

  el.textContent = amount.toFixed(2);

  if (amount < 0) {
    el.classList.add('negative');
  } else {
    el.classList.remove('negative');
  }
};

/**
 * Display inline validation errors for the transaction form fields.
 * Sets aria-invalid on invalid inputs and clears it on valid ones.
 * @param {{ name: FieldValidation, amount: FieldValidation, category: FieldValidation }} errors
 */
View.showFormErrors = function (errors) {
  const fields = [
    { key: 'name',     inputId: 'item-name',     errorId: 'item-name-error' },
    { key: 'amount',   inputId: 'item-amount',   errorId: 'item-amount-error' },
    { key: 'category', inputId: 'item-category', errorId: 'item-category-error' },
  ];

  fields.forEach(function (field) {
    const input    = document.getElementById(field.inputId);
    const errorEl  = document.getElementById(field.errorId);
    const result   = errors[field.key];

    if (!result) return;

    if (!result.valid) {
      if (errorEl) errorEl.textContent = result.error;
      if (input)   input.setAttribute('aria-invalid', 'true');
    } else {
      if (errorEl) errorEl.textContent = '';
      if (input)   input.removeAttribute('aria-invalid');
    }
  });
};

/**
 * Clear all inline form error messages and remove aria-invalid attributes.
 */
View.clearFormErrors = function () {
  const errorSpans = document.querySelectorAll('.field-error');
  errorSpans.forEach(function (span) {
    span.textContent = '';
  });

  const inputIds = ['item-name', 'item-amount', 'item-category'];
  inputIds.forEach(function (id) {
    const input = document.getElementById(id);
    if (input) input.removeAttribute('aria-invalid');
  });
};

/**
 * Reset the transaction form to its default state and clear all inline errors.
 */
View.resetForm = function () {
  const form = document.getElementById('transaction-form');
  if (!form) return;
  form.reset();
  View.clearFormErrors();
};

/**
 * Display a temporary toast notification appended to the document body.
 * The notification is automatically removed after 4 seconds.
 * @param {string} message
 * @param {string} type  - e.g. 'success', 'error', 'info'
 */
View.showNotification = function (message, type) {
  const div = document.createElement('div');
  div.className = 'notification notification--' + type;
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(function () {
    // Guard: element may have been removed before the timeout fires
    if (div.parentNode) {
      div.parentNode.removeChild(div);
    }
  }, 4000);
};

/**
 * Replace the contents of a section element with a fallback message paragraph.
 * Logs a warning when the section element cannot be found.
 * @param {string} sectionId
 * @param {string} [message]
 */
View.showSectionFallback = function (sectionId, message) {
  const defaultMessage = 'This section could not be loaded.';
  const el = document.getElementById(sectionId);

  if (!el) {
    console.warn('View.showSectionFallback: element not found for id "' + sectionId + '"');
    return;
  }

  const p = document.createElement('p');
  p.className = 'fallback-message';
  p.textContent = message !== undefined ? message : defaultMessage;

  el.innerHTML = '';
  el.appendChild(p);
};

/**
 * Update the pie chart display based on the provided chart data.
 * If Chart.js is unavailable (CDN failure), shows a section fallback instead.
 * If chartData has no labels, renders the placeholder message.
 * Otherwise shows the canvas and delegates to ChartManager.update().
 * @param {{ labels: string[], data: number[], colors: string[] }} chartData
 */
View.renderChart = function (chartData) {
  // Guard: Chart.js failed to load from CDN
  if (typeof window.Chart === 'undefined') {
    View.showSectionFallback('chart-section', 'Chart could not be loaded. Please check your internet connection.');
    return;
  }

  if (chartData.labels.length === 0) {
    View.renderChartPlaceholder();
    return;
  }

  // Show canvas and render chart
  const canvas = document.getElementById('expense-chart');
  if (canvas) {
    canvas.style.display = '';
  }

  // Remove any existing placeholder paragraph
  const section = document.getElementById('chart-section');
  if (section) {
    const existing = section.querySelectorAll('p');
    existing.forEach(function (p) {
      if (p.textContent === 'No data to display') {
        p.parentNode.removeChild(p);
      }
    });
  }

  ChartManager.update(chartData);
};

/**
 * Show a "No data to display" placeholder in #chart-section and hide the canvas.
 * Destroys any existing Chart.js instance to free canvas memory.
 * Removes any existing placeholder paragraph before adding a new one (no duplicates).
 */
View.renderChartPlaceholder = function () {
  ChartManager.destroy();

  const canvas = document.getElementById('expense-chart');
  if (canvas) {
    canvas.style.display = 'none';
  }

  const section = document.getElementById('chart-section');
  if (section) {
    // Remove any existing "No data" paragraphs to avoid duplicates
    const existing = section.querySelectorAll('p');
    existing.forEach(function (p) {
      if (p.textContent === 'No data to display') {
        p.parentNode.removeChild(p);
      }
    });

    const p = document.createElement('p');
    p.textContent = 'No data to display';
    section.appendChild(p);
  }
};

const Storage = {};

// The key used to store transactions in localStorage
Storage.STORAGE_KEY = 'expense_visualizer_transactions';

/**
 * Serialize and persist transactions to localStorage.
 * @param {Transaction[]} transactions
 */
Storage.save = function (transactions) {
  localStorage.setItem(Storage.STORAGE_KEY, JSON.stringify(transactions));
};

/**
 * Read and deserialize transactions from localStorage.
 * Returns null if the key is absent or the data is corrupted.
 * @returns {Transaction[]|null}
 */
Storage.load = function () {
  const raw = localStorage.getItem(Storage.STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Storage.load: failed to parse stored data, clearing.', err);
    Storage.clear();
    return null;
  }
};

/**
 * Remove the transactions entry from localStorage.
 */
Storage.clear = function () {
  localStorage.removeItem(Storage.STORAGE_KEY);
};

const ChartManager = (function () {
  let chartInstance = null;

  const manager = {};

  /**
   * Build a Chart.js config object for a pie chart.
   * @param {ChartData} chartData
   * @returns {Object} Chart.js configuration object
   */
  manager.getConfig = function (chartData) {
    return {
      type: 'pie',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            data: chartData.data,
            backgroundColor: chartData.colors,
          },
        ],
      },
      options: {
        plugins: {
          tooltip: {
            enabled: true,
          },
        },
      },
    };
  };

  /**
   * Update the chart with new data.
   * If a chart instance already exists, update its data in place.
   * Otherwise create a new Chart.js instance on the canvas element.
   * @param {ChartData} chartData
   */
  manager.update = function (chartData) {
    const canvas = document.getElementById('expense-chart');

    if (chartInstance) {
      chartInstance.data.labels = chartData.labels;
      chartInstance.data.datasets[0].data = chartData.data;
      chartInstance.data.datasets[0].backgroundColor = chartData.colors;
      chartInstance.update();
    } else {
      const config = manager.getConfig(chartData);
      chartInstance = new Chart(canvas, config);
    }
  };

  /**
   * Destroy the current chart instance and release canvas memory.
   * Sets chartInstance to null after destruction.
   */
  manager.destroy = function () {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  };

  return manager;
}());

const Controller = {};

/**
 * Handle the transaction form submit event.
 * Validates form data, and on success builds and persists a transaction
 * before re-rendering all three views (list, balance, chart).
 * @param {Event} event
 */
Controller.handleFormSubmit = function (event) {
  event.preventDefault();

  // Read raw field values
  const nameEl     = document.getElementById('item-name');
  const amountEl   = document.getElementById('item-amount');
  const categoryEl = document.getElementById('item-category');

  const name     = nameEl     ? nameEl.value     : '';
  const amount   = amountEl   ? amountEl.value   : '';
  const category = categoryEl ? categoryEl.value : '';

  // Validate
  const result = Validator.validateForm({ name: name, amount: amount, category: category });

  if (!result.valid) {
    View.showFormErrors(result.errors);
    return;
  }

  // Build transaction object
  const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : Date.now().toString();

  const transaction = {
    id:        id,
    name:      name.trim(),
    amount:    parseFloat(amount),
    category:  category,
    timestamp: Date.now(),
  };

  // Mutate model
  Model.addTransaction(transaction);
  Model.saveToStorage();

  // Re-render all views
  View.renderList(Model.getAll());
  View.renderBalance(Model.computeBalance());
  View.renderChart(Model.computeChartData());

  // Reset form to default state
  View.resetForm();
};

/**
 * Delete a transaction by id, persist the change, and re-render all views.
 * @param {string} transactionId
 */
Controller.handleDelete = function (transactionId) {
  Model.deleteTransaction(transactionId);
  Model.saveToStorage();

  View.renderList(Model.getAll());
  View.renderBalance(Model.computeBalance());
  View.renderChart(Model.computeChartData());
};

/**
 * Initialise the application: load persisted data, perform initial render,
 * attach event listeners, and set a slow-load safety timeout.
 */
Controller.init = function () {
  // Flag that is set to true once init completes; prevents the slow-load
  // notification from firing if the timeout callback runs after we finish.
  let slowLoadCleared = false;

  // Safety timeout — if rendering takes longer than 5 s, warn the user
  const slowLoadTimeout = setTimeout(function () {
    if (!slowLoadCleared) {
      View.showNotification(
        'The app is taking longer than expected to load. Please refresh.',
        'error'
      );
    }
  }, 5000);

  // Load persisted data; notify the user if storage was corrupted / unavailable
  const loaded = Model.loadFromStorage();
  if (!loaded) {
    View.showNotification(
      'Your saved data could not be loaded and has been reset.',
      'error'
    );
  }

  // Render list — isolated try/catch so one section failure does not block others
  try {
    View.renderList(Model.getAll());
  } catch (e) {
    console.error(e);
    View.showSectionFallback('list-section');
  }

  // Render balance
  try {
    View.renderBalance(Model.computeBalance());
  } catch (e) {
    console.error(e);
    View.showSectionFallback('balance-section');
  }

  // Render chart
  try {
    View.renderChart(Model.computeChartData());
  } catch (e) {
    console.error(e);
    View.showSectionFallback('chart-section');
  }

  // Mark init as complete so the slow-load timeout will not fire
  clearTimeout(slowLoadTimeout);
  slowLoadCleared = true;

  // Wire up form submission
  const form = document.getElementById('transaction-form');
  if (form) {
    form.addEventListener('submit', Controller.handleFormSubmit);
  }

  // Wire up list delete via event delegation — detect any element with a data-id attribute
  const list = document.getElementById('transaction-list');
  if (list) {
    list.addEventListener('click', function (event) {
      const target = event.target.closest('[data-id]');
      if (!target) return;
      const id = target.dataset.id;
      if (!id) return;
      Controller.handleDelete(id);
    });
  }
};

document.addEventListener('DOMContentLoaded', Controller.init);
