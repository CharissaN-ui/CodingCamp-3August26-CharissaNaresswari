# Design Document: Expense and Budget Visualizer

## Overview

The Expense and Budget Visualizer is a single-page web application (SPA) built entirely with HTML, CSS, and Vanilla JavaScript. It runs in the browser with no backend, no build pipeline, and no framework dependencies. All data is persisted to the browser's `localStorage` API and the spending chart is rendered via Chart.js loaded from a CDN.

The application solves a single problem: let a user quickly record expenses, see their running total, and understand their category breakdown at a glance — all without creating an account or installing anything.

### Key Design Decisions

- **No framework, no bundler**: Keeps the deliverable a set of static files that can be opened by double-clicking `index.html`. Aligns with TC-1.
- **Chart.js via CDN**: Provides a mature, accessible pie chart with built-in tooltip support without shipping a local bundle. Aligns with Req 5.7.
- **Synchronous localStorage writes**: Every mutation writes to storage before returning, ensuring data integrity even if the tab is closed mid-interaction. Aligns with Req 6.1–6.2.
- **Module pattern with a single JS file**: Avoids ES module complications (CORS on `file://`) while keeping concerns separated through closures and named function groups.

---

## Architecture

The application follows a simple **MVC-lite** pattern within a single JavaScript file, organized into three logical layers:

```
┌─────────────────────────────────────────────┐
│                   index.html                │
│  (DOM structure + Chart.js CDN script tag)  │
└──────────────┬──────────────────────────────┘
               │ loads
┌──────────────▼──────────────────────────────┐
│               js/app.js                     │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Model   │  │Controller│  │   View    │ │
│  │          │◄─┤          ├─►│           │ │
│  │transactions│ │event     │ │render*()  │ │
│  │(in-memory│  │handlers  │ │functions  │ │
│  │ array)   │  │          │ │           │ │
│  └────┬─────┘  └──────────┘ └───────────┘ │
│       │                                    │
│  ┌────▼─────────────┐                     │
│  │  Storage Layer   │                     │
│  │  (localStorage)  │                     │
│  └──────────────────┘                     │
└─────────────────────────────────────────────┘
               │ styles
┌──────────────▼──────────────────────────────┐
│               css/style.css                 │
│  (layout, typography, responsive rules)     │
└─────────────────────────────────────────────┘
```

**Data flow for a "add transaction" action:**

```
User fills form → submit event → Validator.validate(formData)
  → if invalid: View.showErrors(errors)
  → if valid:   Model.addTransaction(transaction)
                  → Storage.save(Model.getAll())
                  → View.renderList(Model.getAll())
                  → View.renderBalance(Model.computeBalance())
                  → View.renderChart(Model.computeChartData())
                  → View.resetForm()
```

---

## Components and Interfaces

### 1. Model (`model` namespace / closure)

Owns the canonical in-memory `transactions` array. All state mutations go through Model functions.

```javascript
// Internal state
let transactions = []; // Transaction[]

// Public API
Model.addTransaction(transaction)    // prepend to array, return new array
Model.deleteTransaction(id)          // remove by id, return new array
Model.getAll()                       // return shallow copy of array
Model.computeBalance()               // return Number (sum of amounts)
Model.computeChartData()             // return { labels, data, colors }
Model.loadFromStorage()              // read + parse localStorage, return boolean success
Model.saveToStorage()                // serialize + write to localStorage
```

### 2. Validator (`Validator` namespace)

Pure functions — no side effects. Takes raw form field values, returns a validation result.

```javascript
Validator.validateName(value)        // returns { valid: bool, error: string|null }
Validator.validateAmount(value)      // returns { valid: bool, error: string|null }
Validator.validateCategory(value)    // returns { valid: bool, error: string|null }
Validator.validateForm(formData)     // returns { valid: bool, errors: { name, amount, category } }
```

### 3. View (`View` namespace)

All DOM mutations live here. Receives data, returns nothing (side effects only).

```javascript
View.renderList(transactions)        // rebuild transaction list DOM
View.renderBalance(amount)           // update balance element text + class
View.renderChart(chartData)          // update/destroy+recreate Chart.js instance
View.renderChartPlaceholder()        // show "No data" message, hide canvas
View.showFormErrors(errors)          // set inline error text per field
View.clearFormErrors()               // remove all inline error text
View.resetForm()                     // reset HTML form to default state
View.showNotification(message, type) // show temporary toast notification
View.showSectionFallback(sectionId)  // show fallback message within a section
```

### 4. Storage (`Storage` namespace)

Thin wrapper around `localStorage`. All calls are synchronous.

```javascript
Storage.STORAGE_KEY = 'expense_visualizer_transactions'

Storage.save(transactions)           // JSON.stringify + localStorage.setItem
Storage.load()                       // localStorage.getItem + JSON.parse, returns array or null
Storage.clear()                      // localStorage.removeItem
```

### 5. Controller (`Controller` / event wiring)

Wires DOM events to Model + View. Called once on `DOMContentLoaded`.

```javascript
Controller.init()                    // attach all event listeners, run initial load
Controller.handleFormSubmit(event)   // validate → mutate → render pipeline
Controller.handleDelete(transactionId) // delete → render pipeline
```

### 6. Chart Manager

Manages the Chart.js lifecycle (create, update, destroy) to avoid canvas memory leaks.

```javascript
// Internal reference
let chartInstance = null;

ChartManager.update(chartData)       // if instance exists: update data; else: create new
ChartManager.destroy()               // destroy and null the instance
ChartManager.getConfig(chartData)    // build Chart.js config object
```

---

## Data Models

### Transaction

```javascript
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - Unique identifier (crypto.randomUUID() or Date.now().toString())
 * @property {string}  name      - Item name, 1–100 characters
 * @property {number}  amount    - Positive number, 0.01–999,999,999.99
 * @property {string}  category  - One of: "Food" | "Transport" | "Fun"
 * @property {number}  timestamp - Unix ms timestamp of creation (Date.now())
 */
```

### ChartData

```javascript
/**
 * @typedef {Object} ChartData
 * @property {string[]} labels   - Category names with at least one transaction
 * @property {number[]} data     - Total amount per category (same order as labels)
 * @property {string[]} colors   - Hex color per category (same order as labels)
 */
```

### ValidationResult

```javascript
/**
 * @typedef {Object} FieldValidation
 * @property {boolean}     valid
 * @property {string|null} error  - Human-readable error message, null if valid
 *
 * @typedef {Object} FormValidation
 * @property {boolean} valid
 * @property {{ name: FieldValidation, amount: FieldValidation, category: FieldValidation }} errors
 */
```

### Category Color Map

```javascript
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};
```

### localStorage Schema

The entire transaction list is stored under a single key as a JSON array:

```
Key:   "expense_visualizer_transactions"
Value: JSON.stringify(Transaction[])
```

Example:
```json
[
  {
    "id": "1720000000000",
    "name": "Coffee",
    "amount": 4.50,
    "category": "Food",
    "timestamp": 1720000000000
  }
]
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Name validation rejects out-of-range lengths

*For any* string input to the item name field, the validator SHALL accept it if and only if its trimmed length is between 1 and 100 characters (inclusive), and reject all other strings.

**Validates: Requirements 2.1**

---

### Property 2: Amount validation enforces numeric range

*For any* value input to the amount field, the validator SHALL accept it if and only if it parses to a finite number in the range [0.01, 999,999,999.99], and reject all other values (non-numeric, zero, negative, above maximum).

**Validates: Requirements 2.2**

---

### Property 3: Adding a valid transaction always appends it to the list

*For any* valid transaction (name, amount, category), after calling `Model.addTransaction()`, the resulting transaction list SHALL contain that transaction as its first element, and all previously existing transactions SHALL remain present in their original relative order.

**Validates: Requirements 2.4, 3.1**

---

### Property 4: Transaction render invariant

*For any* non-empty transaction list, `View.renderList()` SHALL produce DOM output where each transaction item contains: the item name truncated to at most 100 characters, the amount formatted to exactly two decimal places, the category label, and a delete button.

**Validates: Requirements 3.2, 3.4**

---

### Property 5: Delete preserves relative order of remaining items

*For any* transaction list of length N ≥ 1 and any index i in [0, N-1], after deleting the transaction at index i, the resulting list SHALL have length N-1 and the relative order of all other transactions SHALL be unchanged.

**Validates: Requirements 3.5**

---

### Property 6: Balance equals the precise sum of all transaction amounts

*For any* array of transactions, `Model.computeBalance()` SHALL return a value equal to the arithmetic sum of all `amount` fields, formatted to exactly two decimal places, including the case where the array is empty (returning 0.00).

**Validates: Requirements 4.1, 4.4**

---

### Property 7: Chart data proportions are consistent with transaction totals

*For any* non-empty transaction list, `Model.computeChartData()` SHALL return data where: the sum of all `data` values equals `Model.computeBalance()`, each label corresponds to a category with at least one transaction, and each value is the exact sum of amounts for that category.

**Validates: Requirements 5.1**

---

### Property 8: localStorage round-trip preserves all transaction data

*For any* array of transactions, serializing it to localStorage with `Storage.save()` and then reading it back with `Storage.load()` SHALL return an array that is deeply equal to the original (same ids, names, amounts, categories, timestamps, and order).

**Validates: Requirements 6.1, 6.2, 6.3**

---

## Error Handling

### Corrupted localStorage

When `Storage.load()` catches a `JSON.parse` error or finds data that is not an array:

1. Log the error to `console.warn`.
2. Call `Storage.clear()` to remove the corrupted key.
3. Return `null` to the caller.
4. Controller initializes with an empty state.
5. `View.showNotification('Your saved data could not be loaded and has been reset.', 'error')` displays a visible toast.

### Chart.js Load Failure (CDN unavailable)

If `window.Chart` is `undefined` after the page loads (CDN blocked or offline):

1. `View.showSectionFallback('chart-section')` renders a message: *"Chart could not be loaded. Please check your internet connection."*
2. The rest of the application (form, list, balance) continues to function normally.

### Section Render Failure

Each `View.render*()` function is wrapped in a `try/catch`. On failure:

1. `console.error` logs the exception.
2. `View.showSectionFallback(sectionId)` replaces the section content with a fallback message.

### Form Validation Errors

Inline error messages are shown adjacent to the invalid field. Errors are cleared on the next valid submission or when the field value changes.

### Slow Load / Render Timeout

A 5-second `setTimeout` is set during `Controller.init()`. If the main render pipeline has not completed by then, a visible error banner is shown: *"The app is taking longer than expected to load. Please refresh."*

---

## Testing Strategy

### Unit Tests (Example-Based)

Use a simple test harness (plain JS assertions or a lightweight library like [uvu](https://github.com/lukeed/uvu)) to cover:

- `Validator.validateName`: empty string, 1-char string, 100-char string, 101-char string, whitespace-only string
- `Validator.validateAmount`: `"0"`, `"0.001"`, `"0.01"`, `"999999999.99"`, `"1000000000"`, `"abc"`, `"-1"`
- `Model.computeBalance`: empty array, single item, multiple items with floating-point values
- `Model.computeChartData`: all same category, all different categories, empty array
- `Storage.load`: valid JSON array, empty string, `null`, malformed JSON, non-array JSON

### Property-Based Tests

Use [fast-check](https://fast-check.io/) (loaded via CDN or in a test runner context) to test universal properties. Each test runs a **minimum of 100 iterations**.

**Library**: `fast-check` — mature, well-maintained, zero-dependency property testing library for JavaScript.

| Property | fast-check Arbitraries |
|---|---|
| P1: Name validation | `fc.string()`, `fc.stringOf(fc.char(), {minLength: 1, maxLength: 100})` |
| P2: Amount validation | `fc.float()`, `fc.string()`, `fc.integer()` |
| P3: Add inserts at head | `fc.array(validTransactionArb)`, `validTransactionArb` |
| P4: Render invariant | `fc.array(validTransactionArb, {minLength: 1})` |
| P5: Delete preserves order | `fc.array(validTransactionArb, {minLength: 1})`, `fc.nat()` |
| P6: Balance correctness | `fc.array(validAmountArb)` |
| P7: Chart data consistency | `fc.array(validTransactionArb, {minLength: 1})` |
| P8: localStorage round-trip | `fc.array(validTransactionArb)` |

Each property test MUST be tagged with a comment in the following format:

```javascript
// Feature: expense-budget-visualizer, Property 1: Name validation rejects out-of-range lengths
```

### Integration / Smoke Tests

Manual checklist covering:
- Cross-browser rendering (Chrome, Firefox, Edge, Safari)
- Responsive layout at 320px, 768px, 1280px, 1920px
- 500+ transaction performance benchmark (add/delete ≤100ms)
- Initial load time under 2 seconds on 25 Mbps connection
- Chart.js CDN failure fallback
- Accessibility audit: contrast ratio, font sizes (Lighthouse or axe)

### Test File Location

```
js/
  app.js
tests/
  unit/
    validator.test.js
    model.test.js
    storage.test.js
  property/
    validator.property.test.js
    model.property.test.js
    storage.property.test.js
```

Since the project uses no build tools, property tests can be run via a standalone HTML test runner or by temporarily using `npx fast-check` in Node.js against the exported module functions.
