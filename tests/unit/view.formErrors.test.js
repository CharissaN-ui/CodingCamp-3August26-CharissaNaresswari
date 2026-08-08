/**
 * Unit tests for View.showFormErrors, View.clearFormErrors, View.resetForm
 * Run with: node tests/unit/view.formErrors.test.js
 *
 * Covers Requirements: 2.5, 2.6, 2.7
 */

// ---------------------------------------------------------------------------
// Minimal test harness (no external dependencies)
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function describe(suiteName, fn) {
  console.log(`\n${suiteName}`);
  fn();
}

// ---------------------------------------------------------------------------
// Minimal jsdom-free DOM stub
// We build a lightweight in-memory DOM that supports getElementById,
// querySelectorAll, setAttribute, removeAttribute, and form.reset().
// ---------------------------------------------------------------------------
function makeElement(tag, attrs) {
  const el = {
    tagName: tag.toUpperCase(),
    _attrs: Object.assign({}, attrs || {}),
    textContent: '',
    className: '',
    children: [],
    style: {},
    innerHTML: '',
    setAttribute: function (k, v) { this._attrs[k] = v; },
    removeAttribute: function (k) { delete this._attrs[k]; },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    hasAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); },
    appendChild: function (child) { this.children.push(child); return child; },
    querySelectorAll: function (selector) { return []; }, // stub, overridden per element
    reset: null, // set on form element
  };
  return el;
}

function buildDom() {
  // Form
  const form = makeElement('form', { id: 'transaction-form' });
  let formResetCalled = false;
  form.reset = function () { formResetCalled = true; };

  // Inputs
  const nameInput     = makeElement('input',  { id: 'item-name' });
  const amountInput   = makeElement('input',  { id: 'item-amount' });
  const categoryInput = makeElement('select', { id: 'item-category' });

  // Error spans
  const nameError     = makeElement('span', { id: 'item-name-error',     class: 'field-error' });
  const amountError   = makeElement('span', { id: 'item-amount-error',   class: 'field-error' });
  const categoryError = makeElement('span', { id: 'item-category-error', class: 'field-error' });

  // Index by id
  const byId = {
    'transaction-form':   form,
    'item-name':          nameInput,
    'item-amount':        amountInput,
    'item-category':      categoryInput,
    'item-name-error':    nameError,
    'item-amount-error':  amountError,
    'item-category-error': categoryError,
  };

  // All .field-error spans
  const fieldErrorSpans = [nameError, amountError, categoryError];

  const doc = {
    getElementById: function (id) {
      return Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : null;
    },
    querySelectorAll: function (selector) {
      if (selector === '.field-error') return fieldErrorSpans;
      return [];
    },
    addEventListener: function () { /* no-op */ },
    createElement: function (tag) { return makeElement(tag); },
    body: makeElement('body'),
  };

  return {
    doc,
    form,
    nameInput,
    amountInput,
    categoryInput,
    nameError,
    amountError,
    categoryError,
    get formResetCalled() { return formResetCalled; },
    resetCallTracked: function () { return formResetCalled; },
  };
}

// ---------------------------------------------------------------------------
// Load View from app.js in Node.js environment
// ---------------------------------------------------------------------------
const fs   = require('fs');
const path = require('path');

const appSource = fs.readFileSync(
  path.join(__dirname, '../../js/app.js'),
  'utf8'
);

function buildViewContext() {
  const dom = buildDom();
  const captured = {};

  // Stub window (needed for Chart guard in View.renderChart)
  const windowStub = { Chart: undefined };

  // eslint-disable-next-line no-new-func
  new Function(
    'document',
    'localStorage',
    'window',
    'console',
    '__captured__',
    `
    ${appSource}
    __captured__.View = View;
    `
  )(
    dom.doc,
    {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    windowStub,
    console,
    captured
  );

  return { View: captured.View, dom };
}

// ---------------------------------------------------------------------------
// View.showFormErrors
// ---------------------------------------------------------------------------
describe('View.showFormErrors — invalid fields show error text and aria-invalid (Req 2.5, 2.6)', () => {
  const { View, dom } = buildViewContext();

  const errors = {
    name:     { valid: false, error: 'Item name is required.' },
    amount:   { valid: false, error: 'Amount must be a valid number.' },
    category: { valid: false, error: 'Category must be Food, Transport, or Fun.' },
  };

  View.showFormErrors(errors);

  assert(dom.nameError.textContent     === 'Item name is required.',               'name error text is set');
  assert(dom.amountError.textContent   === 'Amount must be a valid number.',        'amount error text is set');
  assert(dom.categoryError.textContent === 'Category must be Food, Transport, or Fun.', 'category error text is set');

  assert(dom.nameInput.getAttribute('aria-invalid')     === 'true', 'name input has aria-invalid=true');
  assert(dom.amountInput.getAttribute('aria-invalid')   === 'true', 'amount input has aria-invalid=true');
  assert(dom.categoryInput.getAttribute('aria-invalid') === 'true', 'category input has aria-invalid=true');
});

describe('View.showFormErrors — valid fields clear error text and remove aria-invalid (Req 2.5)', () => {
  const { View, dom } = buildViewContext();

  // First mark everything invalid
  dom.nameInput.setAttribute('aria-invalid', 'true');
  dom.nameError.textContent = 'old error';

  const errors = {
    name:     { valid: true,  error: null },
    amount:   { valid: false, error: 'Amount must be a valid number.' },
    category: { valid: true,  error: null },
  };

  View.showFormErrors(errors);

  assert(dom.nameError.textContent === '',       'name error text cleared for valid field');
  assert(!dom.nameInput.hasAttribute('aria-invalid'), 'aria-invalid removed from valid name input');

  assert(dom.amountError.textContent === 'Amount must be a valid number.', 'amount still shows error');
  assert(dom.amountInput.getAttribute('aria-invalid') === 'true',          'amount input still aria-invalid');

  assert(dom.categoryError.textContent === '', 'category error text cleared for valid field');
  assert(!dom.categoryInput.hasAttribute('aria-invalid'), 'aria-invalid removed from valid category input');
});

describe('View.showFormErrors — missing result key is silently skipped', () => {
  const { View, dom } = buildViewContext();

  // Only provide name
  const errors = {
    name: { valid: false, error: 'Item name is required.' },
    // amount and category omitted
  };

  // Should not throw
  let threw = false;
  try {
    View.showFormErrors(errors);
  } catch (e) {
    threw = true;
  }

  assert(!threw, 'does not throw when some error keys are missing');
  assert(dom.nameError.textContent === 'Item name is required.', 'name error is still applied');
});

// ---------------------------------------------------------------------------
// View.clearFormErrors
// ---------------------------------------------------------------------------
describe('View.clearFormErrors — clears all .field-error text (Req 2.5)', () => {
  const { View, dom } = buildViewContext();

  // Pre-populate errors
  dom.nameError.textContent     = 'Name error';
  dom.amountError.textContent   = 'Amount error';
  dom.categoryError.textContent = 'Category error';

  View.clearFormErrors();

  assert(dom.nameError.textContent     === '', 'name error span cleared');
  assert(dom.amountError.textContent   === '', 'amount error span cleared');
  assert(dom.categoryError.textContent === '', 'category error span cleared');
});

describe('View.clearFormErrors — removes aria-invalid from all inputs (Req 2.5)', () => {
  const { View, dom } = buildViewContext();

  dom.nameInput.setAttribute('aria-invalid', 'true');
  dom.amountInput.setAttribute('aria-invalid', 'true');
  dom.categoryInput.setAttribute('aria-invalid', 'true');

  View.clearFormErrors();

  assert(!dom.nameInput.hasAttribute('aria-invalid'),     'aria-invalid removed from name input');
  assert(!dom.amountInput.hasAttribute('aria-invalid'),   'aria-invalid removed from amount input');
  assert(!dom.categoryInput.hasAttribute('aria-invalid'), 'aria-invalid removed from category input');
});

describe('View.clearFormErrors — safe when no errors are set (Req 2.5)', () => {
  const { View } = buildViewContext();

  let threw = false;
  try {
    View.clearFormErrors();
  } catch (e) {
    threw = true;
  }

  assert(!threw, 'does not throw when called with no existing errors');
});

// ---------------------------------------------------------------------------
// View.resetForm
// ---------------------------------------------------------------------------
describe('View.resetForm — calls form.reset() on #transaction-form (Req 2.7)', () => {
  const { View, dom } = buildViewContext();

  View.resetForm();

  assert(dom.resetCallTracked() === true, 'form.reset() was called');
});

describe('View.resetForm — clears errors after reset (Req 2.7)', () => {
  const { View, dom } = buildViewContext();

  // Pre-populate errors
  dom.nameError.textContent   = 'Some error';
  dom.nameInput.setAttribute('aria-invalid', 'true');

  View.resetForm();

  assert(dom.nameError.textContent === '', 'error text cleared by resetForm');
  assert(!dom.nameInput.hasAttribute('aria-invalid'), 'aria-invalid removed by resetForm');
});

describe('View.resetForm — safe when #transaction-form is absent', () => {
  // Build a context with no form in the DOM
  const { View } = buildViewContext();

  // Override getElementById to return null for the form
  const { dom } = buildViewContext();
  const origGetById = dom.doc.getElementById.bind(dom.doc);
  dom.doc.getElementById = function (id) {
    if (id === 'transaction-form') return null;
    return origGetById(id);
  };

  // Rebuild View with the patched doc
  const appSource2 = fs.readFileSync(
    path.join(__dirname, '../../js/app.js'), 'utf8'
  );
  const captured2 = {};
  // eslint-disable-next-line no-new-func
  new Function('document', 'localStorage', 'window', 'console', '__captured__', `
    ${appSource2}
    __captured__.View = View;
  `)(dom.doc, { getItem: () => null, setItem: () => {}, removeItem: () => {} }, { Chart: undefined }, console, captured2);

  let threw = false;
  try {
    captured2.View.resetForm();
  } catch (e) {
    threw = true;
  }

  assert(!threw, 'does not throw when #transaction-form is not in the DOM');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
