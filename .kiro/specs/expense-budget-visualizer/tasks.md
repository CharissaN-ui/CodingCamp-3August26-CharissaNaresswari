# Implementation Plan: Expense and Budget Visualizer

## Overview

Implement a pure client-side SPA using HTML, CSS, and Vanilla JavaScript with Chart.js via CDN. The app follows a MVC-lite pattern within a single `js/app.js` file, organized into `Model`, `Validator`, `View`, `Storage`, `ChartManager`, and `Controller` namespaces. No build tools or frameworks — the deliverable is three static files that work by opening `index.html` directly.

## Tasks

- [x] 1. Scaffold project structure
  - [x] 1.1 Create `index.html` with semantic layout
    - Add `<!DOCTYPE html>`, `<html lang="en">`, `<head>` with charset, viewport meta, and title
    - Link `css/style.css` stylesheet
    - Create semantic sections: `#form-section`, `#balance-section`, `#list-section`, `#chart-section`
    - Add `<form id="transaction-form">` with text input `#item-name`, number input `#item-amount`, `<select id="item-category">` with options Food / Transport / Fun, and a submit button
    - Add `<div id="balance-display">` for total
    - Add `<ul id="transaction-list">` for the scrollable list
    - Add `<canvas id="expense-chart">` inside `#chart-section`
    - Load Chart.js from CDN (`<script src="https://cdn.jsdelivr.net/npm/chart.js">`) before `js/app.js`
    - Load `<script src="js/app.js" defer>` at bottom of `<body>`
    - _Requirements: 1.3, 2.3_

  - [x] 1.2 Create `css/style.css` with baseline reset and section spacing
    - Box-sizing reset, font-family, min body width 320px
    - Section spacing: minimum 16px gap between `#form-section`, `#balance-section`, `#list-section`, `#chart-section`
    - Minimum body font size 14px, heading font size ≥18px
    - _Requirements: 1.3, 8.1, 8.2_

  - [x] 1.3 Create `js/app.js` skeleton with namespace stubs
    - Declare `const Model = {}`, `const Validator = {}`, `const View = {}`, `const Storage = {}`, `const ChartManager = {}`, `const Controller = {}`
    - Add `document.addEventListener('DOMContentLoaded', Controller.init)` at the bottom
    - _Requirements: 1.1, 1.3_

- [x] 2. Implement Storage layer
  - [x] 2.1 Implement `Storage.save`, `Storage.load`, `Storage.clear`
    - `Storage.STORAGE_KEY = 'expense_visualizer_transactions'`
    - `Storage.save(transactions)`: `JSON.stringify` + `localStorage.setItem`
    - `Storage.load()`: `localStorage.getItem` + `JSON.parse`; return `null` on missing key; wrap in `try/catch` — on error `console.warn`, call `Storage.clear()`, return `null`
    - `Storage.clear()`: `localStorage.removeItem(Storage.STORAGE_KEY)`
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [ ]* 2.2 Write property test for localStorage round-trip (Property 8)
    - **Property 8: localStorage round-trip preserves all transaction data**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - File: `tests/property/storage.property.test.js`
    - Use `fast-check` — generate `fc.array(validTransactionArb)`, call `Storage.save()` then `Storage.load()`, assert deep equality
    - Tag: `// Feature: expense-budget-visualizer, Property 8: localStorage round-trip preserves all transaction data`

  - [ ]* 2.3 Write unit tests for `Storage`
    - File: `tests/unit/storage.test.js`
    - Cases: valid JSON array, empty string, `null`, malformed JSON, non-array JSON
    - _Requirements: 6.4, 6.5_

- [x] 3. Implement Validator
  - [x] 3.1 Implement `Validator.validateName`, `Validator.validateAmount`, `Validator.validateCategory`, `Validator.validateForm`
    - `validateName(value)`: trim, accept length 1–100; return `{ valid, error }`
    - `validateAmount(value)`: parse to float, accept finite number in [0.01, 999999999.99]; return `{ valid, error }`
    - `validateCategory(value)`: accept `"Food"`, `"Transport"`, or `"Fun"`; return `{ valid, error }`
    - `validateForm(formData)`: call all three validators, return `{ valid, errors: { name, amount, category } }`
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [ ]* 3.2 Write property test for name validation (Property 1)
    - **Property 1: Name validation rejects out-of-range lengths**
    - **Validates: Requirements 2.1**
    - File: `tests/property/validator.property.test.js`
    - Use `fc.string()` and `fc.stringOf(fc.char(), {minLength: 1, maxLength: 100})`
    - Tag: `// Feature: expense-budget-visualizer, Property 1: Name validation rejects out-of-range lengths`

  - [ ]* 3.3 Write property test for amount validation (Property 2)
    - **Property 2: Amount validation enforces numeric range**
    - **Validates: Requirements 2.2**
    - File: `tests/property/validator.property.test.js`
    - Use `fc.float()`, `fc.string()`, `fc.integer()`
    - Tag: `// Feature: expense-budget-visualizer, Property 2: Amount validation enforces numeric range`

  - [ ]* 3.4 Write unit tests for `Validator`
    - File: `tests/unit/validator.test.js`
    - Cases: empty string, 1-char, 100-char, 101-char, whitespace-only for name; `"0"`, `"0.001"`, `"0.01"`, `"999999999.99"`, `"1000000000"`, `"abc"`, `"-1"` for amount
    - _Requirements: 2.1, 2.2_

- [x] 4. Implement Model layer
  - [x] 4.1 Implement `Model` internal state and CRUD methods
    - Internal `let transactions = []`
    - `Model.addTransaction(transaction)`: prepend to array (new entry at index 0), return shallow copy
    - `Model.deleteTransaction(id)`: filter by id, return shallow copy
    - `Model.getAll()`: return `[...transactions]`
    - `Model.loadFromStorage()`: call `Storage.load()`, assign to `transactions` if valid array, return boolean
    - `Model.saveToStorage()`: call `Storage.save(transactions)`
    - _Requirements: 2.4, 3.1, 3.5, 6.1, 6.2_

  - [x] 4.2 Implement `Model.computeBalance` and `Model.computeChartData`
    - `computeBalance()`: sum all `amount` fields; handle empty array → return `0`; use `parseFloat(sum.toFixed(2))`
    - `computeChartData()`: group amounts by category, return `{ labels, data, colors }` using `CATEGORY_COLORS`; empty array returns `{ labels: [], data: [], colors: [] }`
    - Define `const CATEGORY_COLORS = { Food: '#FF6384', Transport: '#36A2EB', Fun: '#FFCE56' }`
    - _Requirements: 4.1, 4.4, 5.1, 5.2_

  - [ ]* 4.3 Write property test for `Model.addTransaction` (Property 3)
    - **Property 3: Adding a valid transaction always appends it to the list**
    - **Validates: Requirements 2.4, 3.1**
    - File: `tests/property/model.property.test.js`
    - Use `fc.array(validTransactionArb)` + `validTransactionArb`; assert new item is at index 0 and all prior items remain
    - Tag: `// Feature: expense-budget-visualizer, Property 3: Adding a valid transaction always appends it to the list`

  - [ ]* 4.4 Write property test for `Model.deleteTransaction` (Property 5)
    - **Property 5: Delete preserves relative order of remaining items**
    - **Validates: Requirements 3.5**
    - File: `tests/property/model.property.test.js`
    - Use `fc.array(validTransactionArb, {minLength: 1})` + `fc.nat()`; assert length N-1 and relative order preserved
    - Tag: `// Feature: expense-budget-visualizer, Property 5: Delete preserves relative order of remaining items`

  - [ ]* 4.5 Write property test for `Model.computeBalance` (Property 6)
    - **Property 6: Balance equals the precise sum of all transaction amounts**
    - **Validates: Requirements 4.1, 4.4**
    - File: `tests/property/model.property.test.js`
    - Use `fc.array(validAmountArb)`; assert result equals `parseFloat(sum.toFixed(2))`
    - Tag: `// Feature: expense-budget-visualizer, Property 6: Balance equals the precise sum of all transaction amounts`

  - [ ]* 4.6 Write property test for `Model.computeChartData` (Property 7)
    - **Property 7: Chart data proportions are consistent with transaction totals**
    - **Validates: Requirements 5.1**
    - File: `tests/property/model.property.test.js`
    - Use `fc.array(validTransactionArb, {minLength: 1})`; assert sum of data values equals balance and per-category sums match
    - Tag: `// Feature: expense-budget-visualizer, Property 7: Chart data proportions are consistent with transaction totals`

  - [ ]* 4.7 Write unit tests for `Model`
    - File: `tests/unit/model.test.js`
    - Cases: `computeBalance` with empty array, single item, multiple items with floats; `computeChartData` with all same category, all different categories, empty array
    - _Requirements: 4.1, 4.4, 5.1_

- [ ] 5. Checkpoint — core logic complete
  - Ensure all unit and property tests pass (Storage, Validator, Model). Ask the user if questions arise.

- [x] 6. Implement View layer
  - [x] 6.1 Implement `View.renderList` and empty-state handling
    - Clear `#transaction-list` contents
    - If `transactions` is empty, insert `<li class="empty-state">No transactions yet</li>` and return
    - Otherwise build `<li>` per transaction: item name (truncated to 100 chars), amount formatted to 2 decimal places, category label, delete `<button data-id="...">Delete</button>`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [ ]* 6.2 Write property test for `View.renderList` (Property 4)
    - **Property 4: Transaction render invariant**
    - **Validates: Requirements 3.2, 3.4**
    - File: `tests/property/model.property.test.js` (or a dedicated `view.property.test.js`)
    - Use `fc.array(validTransactionArb, {minLength: 1})`; call `View.renderList()`, query DOM, assert name truncation ≤100 chars, amount has 2 decimal places, category label present, delete button present
    - Tag: `// Feature: expense-budget-visualizer, Property 4: Transaction render invariant`

  - [x] 6.3 Implement `View.renderBalance`
    - Format amount: `amount.toFixed(2)`
    - Update `#balance-display` text content
    - Add/remove `negative` class when amount < 0 for distinct visual indicator
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.4 Implement `View.showFormErrors`, `View.clearFormErrors`, `View.resetForm`
    - `showFormErrors(errors)`: for each field, set adjacent `<span class="field-error">` text; add `aria-invalid="true"` to input
    - `clearFormErrors()`: clear all `.field-error` text, remove `aria-invalid`
    - `resetForm()`: call `form.reset()` and `View.clearFormErrors()`
    - _Requirements: 2.5, 2.6, 2.7_

  - [x] 6.5 Implement `View.showNotification` and `View.showSectionFallback`
    - `showNotification(message, type)`: create a toast `<div class="notification notification--{type}">`, append to `<body>`, auto-remove after 4 seconds
    - `showSectionFallback(sectionId)`: find element by id, replace innerHTML with `<p class="fallback-message">{message}</p>`
    - _Requirements: 6.5, 7.4, 8.4_

- [x] 7. Implement ChartManager and chart rendering
  - [x] 7.1 Implement `ChartManager.getConfig`, `ChartManager.update`, `ChartManager.destroy`
    - `getConfig(chartData)`: return a Chart.js config object — type `'pie'`, `data.labels`, `data.datasets[0].data`, `data.datasets[0].backgroundColor`, tooltip plugin enabled
    - `ChartManager.update(chartData)`: if `chartInstance` exists, update `data` and call `chartInstance.update()`; else create new `Chart(canvas, config)` and assign to `chartInstance`
    - `ChartManager.destroy()`: if `chartInstance` exists, call `chartInstance.destroy()`, set to `null`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_

  - [x] 7.2 Implement `View.renderChart` and `View.renderChartPlaceholder`
    - `renderChart(chartData)`: if `chartData.labels.length === 0`, call `View.renderChartPlaceholder()` and return; else show canvas, call `ChartManager.update(chartData)`
    - `renderChartPlaceholder()`: call `ChartManager.destroy()`, hide canvas, show `<p>No data to display</p>` in `#chart-section`
    - Guard: if `window.Chart` is `undefined`, call `View.showSectionFallback('chart-section')` with CDN failure message and return early
    - _Requirements: 5.5, 5.7_

- [x] 8. Implement Controller and event wiring
  - [x] 8.1 Implement `Controller.handleFormSubmit`
    - Prevent default form submission
    - Read values from `#item-name`, `#item-amount`, `#item-category`
    - Call `Validator.validateForm(formData)`
    - If invalid: call `View.showFormErrors(errors)` and return
    - If valid: build transaction object with `crypto.randomUUID()` (or `Date.now().toString()` fallback) and `Date.now()` timestamp
    - Call `Model.addTransaction(transaction)` → `Model.saveToStorage()` → re-render all three views → `View.resetForm()`
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 3.1, 4.2, 5.3_

  - [x] 8.2 Implement `Controller.handleDelete`
    - Accept `transactionId`
    - Call `Model.deleteTransaction(transactionId)` → `Model.saveToStorage()` → re-render all three views
    - _Requirements: 3.5, 4.3, 5.4_

  - [x] 8.3 Implement `Controller.init`
    - Set 5-second slow-load `setTimeout` — if flag not cleared, show error banner via `View.showNotification`
    - Call `Model.loadFromStorage()`; if return is `null`, call `View.showNotification('Your saved data could not be loaded and has been reset.', 'error')`
    - Render initial state: `View.renderList`, `View.renderBalance`, `View.renderChart`
    - Clear slow-load timeout flag
    - Attach `submit` listener on `#transaction-form` → `Controller.handleFormSubmit`
    - Attach delegated `click` listener on `#transaction-list` → detect `[data-id]` button clicks → `Controller.handleDelete`
    - Wrap all render calls in `try/catch` — on error, call `View.showSectionFallback` for affected section
    - _Requirements: 6.3, 6.4, 6.5, 7.1, 7.4_

- [ ] 9. Checkpoint — full feature wired
  - Open `index.html` in a browser manually, verify: add transaction updates list + balance + chart, delete transaction updates all views, data persists on page reload. Ask the user if questions arise.

- [x] 10. Complete CSS layout and visual design
  - [x] 10.1 Implement responsive layout rules
    - Single-column layout on viewports ≤768px; two-column (form + chart side by side) on ≥769px
    - Ensure no horizontal scroll between 320px and 1920px
    - `#transaction-list` max-height with `overflow-y: auto` for scrollability
    - _Requirements: 7.3, 8.1, 8.3_

  - [x] 10.2 Implement typography, color, spacing, and accessibility styles
    - Body font ≥14px, headings ≥18px
    - Contrast ratio ≥4.5:1 for text/background pairs (verify with browser DevTools)
    - Style `.field-error` in red, `.notification--error` and `.notification--success` toast styles
    - Style `.negative` class on `#balance-display` in red
    - Style delete button, form inputs, submit button, empty-state, fallback-message
    - _Requirements: 8.2, 4.5_

- [ ] 11. Error handling and CDN failure guard
  - [ ] 11.1 Add `window.onerror` global handler and Chart.js CDN failure check
    - In `Controller.init`, check `typeof window.Chart === 'undefined'` after DOM load; if true call `View.showSectionFallback('chart-section')` with message "Chart could not be loaded. Please check your internet connection."
    - Wrap each `View.render*()` call in `Controller.init` and Controller handlers in `try/catch`; on catch call `View.showSectionFallback` for that section and `console.error`
    - _Requirements: 7.4, 8.4_

- [ ] 12. Final checkpoint — full validation
  - Run all unit tests in `tests/unit/` and property tests in `tests/property/`. Verify no console errors in Chrome, Firefox, Edge. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of working functionality
- Property tests validate universal correctness properties (Properties 1–8 from design)
- Unit tests validate specific examples and edge cases
- Since there are no build tools, property tests run via Node.js (`node tests/property/...`) with `fast-check` installed via `npm install fast-check --no-save`, or via a standalone HTML test runner
- The test file structure mirrors the design: `tests/unit/` and `tests/property/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "3.4", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4", "6.5", "7.1"] },
    { "id": 5, "tasks": ["7.2", "8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3"] },
    { "id": 7, "tasks": ["10.1", "10.2", "11.1"] }
  ]
}
```
