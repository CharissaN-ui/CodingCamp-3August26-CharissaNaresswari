/**
 * Unit tests for Model namespace
 * Run with: node tests/unit/model.test.js
 *
 * Covers Requirements: 2.4, 3.1, 3.5, 6.1, 6.2
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
// Bootstrap Model + Storage from app.js in a controlled Node.js environment.
// localStorage is stubbed so Storage.save/load/clear work without a browser.
// ---------------------------------------------------------------------------
const fs   = require('fs');
const path = require('path');

const appSource = fs.readFileSync(
  path.join(__dirname, '../../js/app.js'),
  'utf8'
);

// Minimal in-memory localStorage stub
function makeLocalStorage() {
  const store = {};
  return {
    getItem:    (k)    => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k)    => { delete store[k]; },
    clear:      ()     => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

// We need to inject `localStorage`, `document`, and `console` so app.js runs.
// We also need to capture Model and Storage after execution.
function buildContext() {
  const localStorage = makeLocalStorage();
  const captured = {};

  // Provide enough of the browser globals for app.js to parse cleanly
  const ctx = {
    localStorage,
    document: {
      addEventListener: function () { /* no-op — skip DOMContentLoaded wiring */ },
    },
    console,
  };

  // Wrap the source so Model and Storage are accessible after execution
  const wrapped = `
    ${appSource}
    __captured__.Model   = Model;
    __captured__.Storage = Storage;
  `;

  // eslint-disable-next-line no-new-func
  new Function(
    'localStorage',
    'document',
    'console',
    '__captured__',
    wrapped
  )(ctx.localStorage, ctx.document, ctx.console, captured);

  return { Model: captured.Model, Storage: captured.Storage, localStorage };
}

// ---------------------------------------------------------------------------
// Helper to make a minimal valid transaction object
// ---------------------------------------------------------------------------
function makeTx(id, name, amount, category) {
  return { id: String(id), name, amount, category, timestamp: Date.now() };
}

// ---------------------------------------------------------------------------
// Model.addTransaction
// ---------------------------------------------------------------------------
describe('Model.addTransaction — prepends to list (Req 2.4, 3.1)', () => {
  const { Model } = buildContext();

  const t1 = makeTx('1', 'Coffee', 4.5, 'Food');
  const result1 = Model.addTransaction(t1);
  assert(Array.isArray(result1), 'returns an array');
  assert(result1.length === 1, 'array length is 1 after first add');
  assert(result1[0].id === '1', 'first element has the correct id');

  const t2 = makeTx('2', 'Bus', 1.5, 'Transport');
  const result2 = Model.addTransaction(t2);
  assert(result2.length === 2, 'array length is 2 after second add');
  assert(result2[0].id === '2', 'most recent transaction is at index 0 (prepend)');
  assert(result2[1].id === '1', 'previous transaction is still at index 1');
});

describe('Model.addTransaction — returns a shallow copy, not internal reference', () => {
  const { Model } = buildContext();

  const t = makeTx('a', 'Tea', 2, 'Fun');
  const result = Model.addTransaction(t);
  result.push(makeTx('extra', 'x', 1, 'Food')); // mutate the returned copy
  assert(Model.getAll().length === 1, 'mutating returned array does not affect internal state');
});

// ---------------------------------------------------------------------------
// Model.deleteTransaction
// ---------------------------------------------------------------------------
describe('Model.deleteTransaction — removes by id (Req 3.5)', () => {
  const { Model } = buildContext();

  const t1 = makeTx('10', 'Lunch', 12, 'Food');
  const t2 = makeTx('11', 'Taxi',  8,  'Transport');
  const t3 = makeTx('12', 'Movie', 15, 'Fun');
  Model.addTransaction(t1);
  Model.addTransaction(t2);
  Model.addTransaction(t3);
  // Internal order after three prepends: [t3, t2, t1]

  const after = Model.deleteTransaction('11');
  assert(after.length === 2, 'length decreases by 1 after delete');
  assert(after.every((t) => t.id !== '11'), 'deleted transaction is no longer present');

  // Relative order of remaining items must be preserved
  assert(after[0].id === '12', 'first remaining item (t3) is still at index 0');
  assert(after[1].id === '10', 'second remaining item (t1) is still at index 1');
});

describe('Model.deleteTransaction — deleting non-existent id leaves list unchanged', () => {
  const { Model } = buildContext();

  Model.addTransaction(makeTx('99', 'Snack', 3, 'Food'));
  const before = Model.getAll();
  const after  = Model.deleteTransaction('does-not-exist');
  assert(after.length === before.length, 'list length unchanged when id not found');
  assert(after[0].id === '99', 'existing transaction still present');
});

describe('Model.deleteTransaction — returns a shallow copy', () => {
  const { Model } = buildContext();

  Model.addTransaction(makeTx('5', 'Cake', 5, 'Fun'));
  const result = Model.deleteTransaction('999'); // non-existent id
  result.push(makeTx('extra', 'x', 1, 'Food'));
  assert(Model.getAll().length === 1, 'mutating returned array does not affect internal state');
});

// ---------------------------------------------------------------------------
// Model.getAll
// ---------------------------------------------------------------------------
describe('Model.getAll — returns shallow copy of all transactions', () => {
  const { Model } = buildContext();

  assert(Model.getAll().length === 0, 'empty array before any transactions added');

  Model.addTransaction(makeTx('1', 'A', 1, 'Food'));
  Model.addTransaction(makeTx('2', 'B', 2, 'Transport'));
  const all = Model.getAll();
  assert(all.length === 2, 'returns all transactions');

  all.push(makeTx('extra', 'x', 1, 'Fun'));
  assert(Model.getAll().length === 2, 'mutating returned array does not affect internal state');
});

// ---------------------------------------------------------------------------
// Model.loadFromStorage / Model.saveToStorage
// ---------------------------------------------------------------------------
describe('Model.loadFromStorage — loads valid array from Storage (Req 6.1, 6.2)', () => {
  const { Model, Storage, localStorage } = buildContext();

  // Pre-populate localStorage with a valid JSON array
  const saved = [makeTx('a', 'Saved', 9.99, 'Food')];
  localStorage.setItem(Storage.STORAGE_KEY, JSON.stringify(saved));

  const result = Model.loadFromStorage();
  assert(result === true, 'returns true when valid array is loaded');
  const all = Model.getAll();
  assert(all.length === 1, 'internal state has 1 transaction after load');
  assert(all[0].id === 'a', 'loaded transaction has correct id');
  assert(all[0].name === 'Saved', 'loaded transaction has correct name');
});

describe('Model.loadFromStorage — returns false when Storage has no data', () => {
  const { Model } = buildContext(); // fresh context, empty localStorage

  const result = Model.loadFromStorage();
  assert(result === false, 'returns false when Storage.load() returns null');
  assert(Model.getAll().length === 0, 'internal state remains empty');
});

describe('Model.loadFromStorage — returns false for non-array data', () => {
  const { Model, Storage, localStorage } = buildContext();

  localStorage.setItem(Storage.STORAGE_KEY, JSON.stringify({ not: 'an array' }));
  const result = Model.loadFromStorage();
  assert(result === false, 'returns false when stored data is not an array');
  assert(Model.getAll().length === 0, 'internal state remains empty for non-array data');
});

describe('Model.saveToStorage — persists current state (Req 6.1, 6.2)', () => {
  const { Model, Storage, localStorage } = buildContext();

  Model.addTransaction(makeTx('x', 'Persist me', 7, 'Fun'));
  Model.saveToStorage();

  const raw     = localStorage.getItem(Storage.STORAGE_KEY);
  const parsed  = JSON.parse(raw);
  assert(Array.isArray(parsed), 'localStorage contains a JSON array after save');
  assert(parsed.length === 1, 'saved array has 1 transaction');
  assert(parsed[0].id === 'x', 'saved transaction has correct id');
});

describe('Model.saveToStorage — round-trip through loadFromStorage restores data', () => {
  // Save in one context, load in another that shares the same localStorage
  const ctx1 = buildContext();
  ctx1.Model.addTransaction(makeTx('r1', 'Round-trip', 42, 'Transport'));
  ctx1.Model.saveToStorage();

  // Copy the stored value to a fresh context's localStorage
  const raw = ctx1.localStorage.getItem(ctx1.Storage.STORAGE_KEY);

  const ctx2 = buildContext();
  ctx2.localStorage.setItem(ctx2.Storage.STORAGE_KEY, raw);
  const loaded = ctx2.Model.loadFromStorage();

  assert(loaded === true, 'loadFromStorage returns true in second context');
  const all = ctx2.Model.getAll();
  assert(all.length === 1, 'restored list has 1 transaction');
  assert(all[0].id === 'r1',          'id preserved through round-trip');
  assert(all[0].name === 'Round-trip','name preserved through round-trip');
  assert(all[0].amount === 42,        'amount preserved through round-trip');
  assert(all[0].category === 'Transport', 'category preserved through round-trip');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Model.computeBalance (Req 4.1, 4.4)
// ---------------------------------------------------------------------------
describe('Model.computeBalance — empty array returns 0 (Req 4.4)', () => {
  const { Model } = buildContext();

  assert(Model.computeBalance() === 0, 'returns 0 when no transactions exist');
});

describe('Model.computeBalance — single transaction (Req 4.1)', () => {
  const { Model } = buildContext();

  Model.addTransaction(makeTx('1', 'Coffee', 4.5, 'Food'));
  assert(Model.computeBalance() === 4.5, 'returns correct amount for single transaction');
});

describe('Model.computeBalance — multiple transactions summed correctly (Req 4.1)', () => {
  const { Model } = buildContext();

  Model.addTransaction(makeTx('1', 'Lunch',  12.00, 'Food'));
  Model.addTransaction(makeTx('2', 'Bus',     1.50, 'Transport'));
  Model.addTransaction(makeTx('3', 'Cinema', 15.00, 'Fun'));
  assert(Model.computeBalance() === 28.5, 'returns sum of all amounts');
});

describe('Model.computeBalance — floating-point values rounded to 2 decimal places (Req 4.1)', () => {
  const { Model } = buildContext();

  // 0.1 + 0.2 in JS = 0.30000000000000004 without rounding
  Model.addTransaction(makeTx('a', 'A', 0.1, 'Food'));
  Model.addTransaction(makeTx('b', 'B', 0.2, 'Food'));
  assert(Model.computeBalance() === 0.3, 'floating-point sum is rounded to 2 decimal places');
});

describe('Model.computeBalance — updates after delete (Req 4.1)', () => {
  const { Model } = buildContext();

  Model.addTransaction(makeTx('1', 'A', 10, 'Food'));
  Model.addTransaction(makeTx('2', 'B', 5,  'Transport'));
  Model.deleteTransaction('2');
  assert(Model.computeBalance() === 10, 'balance reflects deleted transaction');
});

// ---------------------------------------------------------------------------
// Model.computeChartData (Req 5.1, 5.2)
// ---------------------------------------------------------------------------
describe('Model.computeChartData — empty array returns empty structure (Req 5.1)', () => {
  const { Model } = buildContext();

  const result = Model.computeChartData();
  assert(Array.isArray(result.labels) && result.labels.length === 0, 'labels is empty array');
  assert(Array.isArray(result.data)   && result.data.length   === 0, 'data is empty array');
  assert(Array.isArray(result.colors) && result.colors.length === 0, 'colors is empty array');
});

describe('Model.computeChartData — single category (Req 5.1)', () => {
  const { Model } = buildContext();

  Model.addTransaction(makeTx('1', 'Lunch', 12, 'Food'));
  Model.addTransaction(makeTx('2', 'Snack',  3, 'Food'));

  const result = Model.computeChartData();
  assert(result.labels.length === 1,       'one label for one category');
  assert(result.labels[0] === 'Food',      'label is Food');
  assert(result.data[0] === 15,            'data sums both Food transactions');
  assert(result.colors[0] === '#FF6384',   'Food color is correct');
});

describe('Model.computeChartData — multiple categories (Req 5.1, 5.2)', () => {
  const { Model } = buildContext();

  Model.addTransaction(makeTx('1', 'Lunch', 10, 'Food'));
  Model.addTransaction(makeTx('2', 'Bus',    5, 'Transport'));
  Model.addTransaction(makeTx('3', 'Movie', 15, 'Fun'));

  const result = Model.computeChartData();
  assert(result.labels.length === 3, 'three labels for three categories');

  const foodIdx      = result.labels.indexOf('Food');
  const transportIdx = result.labels.indexOf('Transport');
  const funIdx       = result.labels.indexOf('Fun');

  assert(foodIdx      !== -1, 'Food label present');
  assert(transportIdx !== -1, 'Transport label present');
  assert(funIdx       !== -1, 'Fun label present');

  assert(result.data[foodIdx]      === 10, 'Food total is 10');
  assert(result.data[transportIdx] === 5,  'Transport total is 5');
  assert(result.data[funIdx]       === 15, 'Fun total is 15');

  assert(result.colors[foodIdx]      === '#FF6384', 'Food color is correct');
  assert(result.colors[transportIdx] === '#36A2EB', 'Transport color is correct');
  assert(result.colors[funIdx]       === '#FFCE56', 'Fun color is correct');
});

describe('Model.computeChartData — labels, data, colors arrays are same length (Req 5.1)', () => {
  const { Model } = buildContext();

  Model.addTransaction(makeTx('1', 'Lunch', 10, 'Food'));
  Model.addTransaction(makeTx('2', 'Bus',    5, 'Transport'));

  const result = Model.computeChartData();
  assert(
    result.labels.length === result.data.length &&
    result.data.length   === result.colors.length,
    'labels, data, and colors arrays have the same length'
  );
});

describe('Model.computeChartData — data amounts rounded to 2 decimal places (Req 5.1)', () => {
  const { Model } = buildContext();

  Model.addTransaction(makeTx('a', 'A', 0.1, 'Food'));
  Model.addTransaction(makeTx('b', 'B', 0.2, 'Food'));

  const result = Model.computeChartData();
  assert(result.data[0] === 0.3, 'category total rounded to 2 decimal places');
});
