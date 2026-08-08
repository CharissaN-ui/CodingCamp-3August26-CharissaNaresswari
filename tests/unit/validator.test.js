/**
 * Unit tests for Validator namespace
 * Run with: node tests/unit/validator.test.js
 *
 * Covers Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
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
// Load Validator from app.js (Node.js-compatible extraction)
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const appSource = fs.readFileSync(
  path.join(__dirname, '../../js/app.js'),
  'utf8'
);

// Execute only the Validator portion in this context
const Validator = {};
// eslint-disable-next-line no-new-func
new Function('Validator', appSource)(Validator);

// ---------------------------------------------------------------------------
// validateName
// ---------------------------------------------------------------------------
describe('Validator.validateName', () => {
  // Requirement 2.1 — accept 1–100 characters (trimmed)

  assert(
    Validator.validateName('').valid === false,
    'empty string is invalid'
  );
  assert(
    typeof Validator.validateName('').error === 'string',
    'empty string returns an error message'
  );

  assert(
    Validator.validateName('   ').valid === false,
    'whitespace-only string is invalid (trimmed length = 0)'
  );

  assert(
    Validator.validateName('A').valid === true,
    '1-character string is valid'
  );
  assert(
    Validator.validateName('A').error === null,
    '1-character string has null error'
  );

  assert(
    Validator.validateName('x'.repeat(100)).valid === true,
    '100-character string is valid'
  );

  assert(
    Validator.validateName('x'.repeat(101)).valid === false,
    '101-character string is invalid'
  );
  assert(
    typeof Validator.validateName('x'.repeat(101)).error === 'string',
    '101-character string returns an error message'
  );

  assert(
    Validator.validateName('  hello  ').valid === true,
    'string with leading/trailing spaces is valid after trimming'
  );

  assert(
    Validator.validateName(null).valid === false,
    'null input is invalid'
  );

  assert(
    Validator.validateName(undefined).valid === false,
    'undefined input is invalid'
  );
});

// ---------------------------------------------------------------------------
// validateAmount
// ---------------------------------------------------------------------------
describe('Validator.validateAmount', () => {
  // Requirement 2.2 — accept finite number in [0.01, 999999999.99]

  assert(
    Validator.validateAmount('0').valid === false,
    '"0" is invalid (below minimum)'
  );

  assert(
    Validator.validateAmount('0.001').valid === false,
    '"0.001" is invalid (below 0.01)'
  );

  assert(
    Validator.validateAmount('0.01').valid === true,
    '"0.01" is valid (minimum boundary)'
  );
  assert(
    Validator.validateAmount('0.01').error === null,
    '"0.01" has null error'
  );

  assert(
    Validator.validateAmount('999999999.99').valid === true,
    '"999999999.99" is valid (maximum boundary)'
  );

  assert(
    Validator.validateAmount('1000000000').valid === false,
    '"1000000000" is invalid (above maximum)'
  );

  assert(
    Validator.validateAmount('abc').valid === false,
    'non-numeric string is invalid'
  );
  assert(
    typeof Validator.validateAmount('abc').error === 'string',
    'non-numeric string returns an error message'
  );

  assert(
    Validator.validateAmount('-1').valid === false,
    'negative value is invalid'
  );

  assert(
    Validator.validateAmount('').valid === false,
    'empty string is invalid'
  );

  assert(
    Validator.validateAmount(NaN).valid === false,
    'NaN is invalid'
  );

  assert(
    Validator.validateAmount(Infinity).valid === false,
    'Infinity is invalid'
  );

  assert(
    Validator.validateAmount(42.5).valid === true,
    'numeric 42.5 is valid'
  );
});

// ---------------------------------------------------------------------------
// validateCategory
// ---------------------------------------------------------------------------
describe('Validator.validateCategory', () => {
  // Requirement 2.3 — accept exactly "Food", "Transport", or "Fun"

  assert(
    Validator.validateCategory('Food').valid === true,
    '"Food" is valid'
  );
  assert(
    Validator.validateCategory('Food').error === null,
    '"Food" has null error'
  );

  assert(
    Validator.validateCategory('Transport').valid === true,
    '"Transport" is valid'
  );

  assert(
    Validator.validateCategory('Fun').valid === true,
    '"Fun" is valid'
  );

  assert(
    Validator.validateCategory('food').valid === false,
    'lowercase "food" is invalid (case-sensitive)'
  );

  assert(
    Validator.validateCategory('').valid === false,
    'empty string is invalid'
  );
  assert(
    typeof Validator.validateCategory('').error === 'string',
    'empty string returns an error message'
  );

  assert(
    Validator.validateCategory('Entertainment').valid === false,
    'unlisted category is invalid'
  );

  assert(
    Validator.validateCategory(null).valid === false,
    'null is invalid'
  );
});

// ---------------------------------------------------------------------------
// validateForm
// ---------------------------------------------------------------------------
describe('Validator.validateForm', () => {
  // Requirement 2.5, 2.6

  const validData = { name: 'Coffee', amount: '4.50', category: 'Food' };

  const result = Validator.validateForm(validData);
  assert(result.valid === true, 'all-valid form data returns valid=true');
  assert(result.errors.name.valid === true,     'name sub-result is valid');
  assert(result.errors.amount.valid === true,   'amount sub-result is valid');
  assert(result.errors.category.valid === true, 'category sub-result is valid');

  const emptyAll = Validator.validateForm({ name: '', amount: '', category: '' });
  assert(emptyAll.valid === false,               'all-empty form data returns valid=false');
  assert(emptyAll.errors.name.valid === false,     'name error present for empty name');
  assert(emptyAll.errors.amount.valid === false,   'amount error present for empty amount');
  assert(emptyAll.errors.category.valid === false, 'category error present for empty category');

  const badAmount = Validator.validateForm({ name: 'Tea', amount: 'xyz', category: 'Fun' });
  assert(badAmount.valid === false,             'non-numeric amount causes invalid form');
  assert(badAmount.errors.amount.valid === false, 'amount error is set');
  assert(badAmount.errors.name.valid === true,    'name remains valid');

  const badCategory = Validator.validateForm({ name: 'Tea', amount: '2.00', category: 'Misc' });
  assert(badCategory.valid === false,               'unknown category causes invalid form');
  assert(badCategory.errors.category.valid === false, 'category error is set');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
