export const RECORDING_EXPECT_FACTORY_NAME = 'createRecordingExpect';
export const RECORDING_EXPECT_CALL_NAME = 'recordingExpect';

export const RECORDING_EXPECT_RUNTIME_SOURCE = `function createRecordingExpect(locator, negated = false, assertions = undefined) {
  function createAssertionError(input) {
    const error = new Error(input.message || \`Recording assertion failed: \${input.assertionCode}\`);
    error.name = 'RecordingAssertionError';
    error.reasonCode = 'recording_script_assertion_failed';
    error.assertionCode = input.assertionCode;
    error.assertionKind = input.assertionKind;
    error.matcher = input.matcher;
    error.expected = input.expected;
    error.actual = input.actual;
    error.negated = Boolean(input.negated);
    return error;
  }
  function fail(input) {
    throw createAssertionError({
      ...input,
      negated,
      message: input.message || \`Recording assertion failed: \${input.assertionCode}\`,
    });
  }
  function createAssertionRecord(input) {
    return {
      code: input.assertionCode,
      assertionKind: input.assertionKind,
      matcher: input.matcher,
      expected: input.expected,
      actual: input.actual,
      negated: Boolean(input.negated),
    };
  }
  function recordSuccess(input) {
    if (!Array.isArray(assertions))
      return;
    assertions.push(createAssertionRecord({
      ...input,
      negated,
    }));
  }
  async function readText() {
    return (await locator.textContent()) ?? '';
  }
  function matcherName(name) {
    return negated ? \`not.\${name}\` : name;
  }
  function expectedCode(kind, positiveSuffix, negatedSuffix) {
    return negated
      ? \`recording_assert.\${kind}.\${negatedSuffix}\`
      : \`recording_assert.\${kind}.\${positiveSuffix}\`;
  }
  function checkBoolean(input) {
    const expected = !negated;
    const assertion = {
      assertionCode: expectedCode(input.assertionKind, input.positiveCode, input.negatedCode),
      assertionKind: input.assertionKind,
      matcher: matcherName(input.matcher),
      expected,
      actual: input.actual,
    };
    if (input.actual !== expected) {
      fail(assertion);
      return;
    }
    recordSuccess(assertion);
  }
  function checkComparison(input) {
    const assertion = {
      assertionCode: expectedCode(input.assertionKind, input.positiveCode, input.negatedCode),
      assertionKind: input.assertionKind,
      matcher: matcherName(input.matcher),
      expected: input.expected,
      actual: input.actual,
    };
    if (negated ? input.passed : !input.passed) {
      fail(assertion);
      return;
    }
    recordSuccess(assertion);
  }
  return {
    get not() {
      return createRecordingExpect(locator, !negated, assertions);
    },
    async toBeVisible() {
      checkBoolean({
        assertionKind: 'visible',
        matcher: 'toBeVisible',
        positiveCode: 'expected_visible',
        negatedCode: 'expected_not_visible',
        actual: await locator.isVisible(),
      });
    },
    async toBeChecked() {
      checkBoolean({
        assertionKind: 'checked',
        matcher: 'toBeChecked',
        positiveCode: 'expected_checked',
        negatedCode: 'expected_not_checked',
        actual: await locator.isChecked(),
      });
    },
    async toBeDisabled() {
      checkBoolean({
        assertionKind: 'disabled',
        matcher: 'toBeDisabled',
        positiveCode: 'expected_disabled',
        negatedCode: 'expected_not_disabled',
        actual: await locator.isDisabled(),
      });
    },
    async toHaveText(expected) {
      const normalizedExpected = String(expected);
      const actual = (await readText()).trim();
      checkComparison({
        assertionKind: 'text',
        matcher: 'toHaveText',
        positiveCode: 'expected_exact',
        negatedCode: 'expected_not_exact',
        expected: normalizedExpected,
        actual,
        passed: actual === normalizedExpected,
      });
    },
    async toContainText(expected) {
      const normalizedExpected = String(expected);
      const actual = await readText();
      checkComparison({
        assertionKind: 'text',
        matcher: 'toContainText',
        positiveCode: 'expected_contains',
        negatedCode: 'expected_not_contains',
        expected: normalizedExpected,
        actual,
        passed: actual.includes(normalizedExpected),
      });
    },
    async toHaveValue(expected) {
      const normalizedExpected = String(expected);
      const actual = await locator.inputValue();
      checkComparison({
        assertionKind: 'value',
        matcher: 'toHaveValue',
        positiveCode: 'expected_exact',
        negatedCode: 'expected_not_exact',
        expected: normalizedExpected,
        actual,
        passed: actual === normalizedExpected,
      });
    },
    async toBeEmpty() {
      let actual = '';
      try {
        actual = await locator.inputValue();
      } catch {
        actual = await readText();
      }
      checkComparison({
        assertionKind: 'empty',
        matcher: 'toBeEmpty',
        positiveCode: 'expected_empty',
        negatedCode: 'expected_not_empty',
        expected: '',
        actual,
        passed: actual.length === 0,
      });
    },
    async toMatchAriaSnapshot(expected) {
      if (typeof locator.ariaSnapshot !== 'function')
        fail({
          assertionCode: 'recording_assert.runtime.aria_snapshot_unavailable',
          assertionKind: 'aria',
          matcher: matcherName('toMatchAriaSnapshot'),
          expected: 'ariaSnapshot()',
          actual: 'unavailable',
        });
      const normalizedExpected = String(expected).trim();
      const actual = await locator.ariaSnapshot();
      checkComparison({
        assertionKind: 'aria',
        matcher: 'toMatchAriaSnapshot',
        positiveCode: 'expected_snapshot',
        negatedCode: 'expected_not_snapshot',
        expected: normalizedExpected,
        actual: String(actual).trim(),
        passed: String(actual).trim() === normalizedExpected,
      });
    },
  };
}`;
