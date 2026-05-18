import type { RecorderCaptureMode } from '../state/recorderStatus';

export type RecorderModeButton = {
  mode: RecorderCaptureMode;
  label: string;
  tooltip: string;
};

export function buildActionModeButtons(i18n: {
  record: string;
  locate: string;
  tooltip: {
    record: string;
    locate: string;
  };
}): RecorderModeButton[] {
  return [
    { mode: 'recording', label: i18n.record, tooltip: i18n.tooltip.record },
    { mode: 'scrollIntoView', label: i18n.locate, tooltip: i18n.tooltip.locate },
  ];
}

export function buildAssertionModeButtons(i18n: {
  assertVisible: string;
  assertDisabled: string;
  assertNotDisabled: string;
  assertChecked: string;
  assertUnchecked: string;
  assertText: string;
  assertValue: string;
  assertAria: string;
  tooltip: {
    assertVisible: string;
    assertDisabled: string;
    assertNotDisabled: string;
    assertChecked: string;
    assertUnchecked: string;
    assertText: string;
    assertValue: string;
    assertAria: string;
  };
}): RecorderModeButton[] {
  return [
    { mode: 'assertingVisibility', label: i18n.assertVisible, tooltip: i18n.tooltip.assertVisible },
    { mode: 'assertingDisabled', label: i18n.assertDisabled, tooltip: i18n.tooltip.assertDisabled },
    { mode: 'assertingNotDisabled', label: i18n.assertNotDisabled, tooltip: i18n.tooltip.assertNotDisabled },
    { mode: 'assertingChecked', label: i18n.assertChecked, tooltip: i18n.tooltip.assertChecked },
    { mode: 'assertingUnchecked', label: i18n.assertUnchecked, tooltip: i18n.tooltip.assertUnchecked },
    { mode: 'assertingText', label: i18n.assertText, tooltip: i18n.tooltip.assertText },
    { mode: 'assertingValue', label: i18n.assertValue, tooltip: i18n.tooltip.assertValue },
    { mode: 'assertingSnapshot', label: i18n.assertAria, tooltip: i18n.tooltip.assertAria },
  ];
}
