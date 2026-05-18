import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RECORDING_EXPECT_FACTORY_NAME,
  RECORDING_EXPECT_RUNTIME_SOURCE,
} from './recordingExpectRuntime';

type RecordingExpectation = {
  not: RecordingExpectation;
  toBeVisible(): Promise<void>;
  toBeChecked(): Promise<void>;
  toBeDisabled(): Promise<void>;
  toHaveText(expected: unknown): Promise<void>;
  toContainText(expected: unknown): Promise<void>;
  toHaveValue(expected: unknown): Promise<void>;
  toBeEmpty(): Promise<void>;
  toMatchAriaSnapshot(expected: unknown): Promise<void>;
};

type RecordingExpectFactory = (locator: unknown, negated?: boolean) => RecordingExpectation;

function loadRuntimeExpect(): RecordingExpectFactory {
  // Parses the embedded helper exactly as it appears in generated recording scripts.
  // eslint-disable-next-line no-new-func
  return new Function(`${RECORDING_EXPECT_RUNTIME_SOURCE}\nreturn ${RECORDING_EXPECT_FACTORY_NAME};`)() as RecordingExpectFactory;
}

function createLocator(state: {
  visible?: boolean;
  checked?: boolean;
  disabled?: boolean;
  text?: string;
  value?: string;
  aria?: string;
}) {
  return {
    isVisible: async () => state.visible ?? false,
    isChecked: async () => state.checked ?? false,
    isDisabled: async () => state.disabled ?? false,
    textContent: async () => state.text ?? '',
    inputValue: async () => {
      if (state.value === undefined)
        throw new Error('input value unavailable');
      return state.value;
    },
    ariaSnapshot: async () => state.aria ?? '',
  };
}

test('recording expect runtime supports generated assertion helpers', async () => {
  const expect = loadRuntimeExpect();
  const locator = createLocator({
    visible: true,
    checked: true,
    disabled: true,
    text: '  Submit order  ',
    value: '42',
    aria: '- button "Submit order"',
  });

  await expect(locator).toBeVisible();
  await expect(locator).toBeChecked();
  await expect(locator).toBeDisabled();
  await expect(locator).toHaveText('Submit order');
  await expect(locator).toContainText('Submit');
  await expect(locator).toHaveValue(42);
  await expect(locator).toMatchAriaSnapshot('- button "Submit order"');
  await expect(createLocator({ text: '' })).toBeEmpty();
  await expect(createLocator({ visible: false })).not.toBeVisible();
  await expect(createLocator({ disabled: false })).not.toBeDisabled();
});

test('recording expect runtime reports assertion failures with stable messages', async () => {
  const expect = loadRuntimeExpect();

  await assert.rejects(
      expect(createLocator({ visible: false })).toBeVisible(),
      (error: unknown) => {
        assert.equal((error as { name?: unknown }).name, 'RecordingAssertionError');
        assert.equal((error as { reasonCode?: unknown }).reasonCode, 'recording_script_assertion_failed');
        assert.equal((error as { assertionCode?: unknown }).assertionCode, 'recording_assert.visible.expected_visible');
        assert.equal((error as { expected?: unknown }).expected, true);
        assert.equal((error as { actual?: unknown }).actual, false);
        return true;
      },
  );
  await assert.rejects(
      expect(createLocator({ checked: true })).not.toBeChecked(),
      (error: unknown) => {
        assert.equal((error as { assertionCode?: unknown }).assertionCode, 'recording_assert.checked.expected_not_checked');
        assert.equal((error as { matcher?: unknown }).matcher, 'not.toBeChecked');
        assert.equal((error as { expected?: unknown }).expected, false);
        assert.equal((error as { actual?: unknown }).actual, true);
        assert.equal((error as { negated?: unknown }).negated, true);
        return true;
      },
  );
  await assert.rejects(
      expect(createLocator({ disabled: false })).toBeDisabled(),
      (error: unknown) => {
        assert.equal((error as { assertionCode?: unknown }).assertionCode, 'recording_assert.disabled.expected_disabled');
        assert.equal((error as { matcher?: unknown }).matcher, 'toBeDisabled');
        assert.equal((error as { expected?: unknown }).expected, true);
        assert.equal((error as { actual?: unknown }).actual, false);
        return true;
      },
  );
  await assert.rejects(
      expect(createLocator({ disabled: true })).not.toBeDisabled(),
      (error: unknown) => {
        assert.equal((error as { assertionCode?: unknown }).assertionCode, 'recording_assert.disabled.expected_not_disabled');
        assert.equal((error as { matcher?: unknown }).matcher, 'not.toBeDisabled');
        assert.equal((error as { expected?: unknown }).expected, false);
        assert.equal((error as { actual?: unknown }).actual, true);
        return true;
      },
  );
});
