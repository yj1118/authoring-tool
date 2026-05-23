/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
  assertPasswordInput: string;
  assertSelectOptions: string;
  assertAria: string;
  tooltip: {
    assertVisible: string;
    assertDisabled: string;
    assertNotDisabled: string;
    assertChecked: string;
    assertUnchecked: string;
    assertText: string;
    assertValue: string;
    assertPasswordInput: string;
    assertSelectOptions: string;
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
    { mode: 'assertingPasswordInput', label: i18n.assertPasswordInput, tooltip: i18n.tooltip.assertPasswordInput },
    { mode: 'assertingSelectOptions', label: i18n.assertSelectOptions, tooltip: i18n.tooltip.assertSelectOptions },
    { mode: 'assertingSnapshot', label: i18n.assertAria, tooltip: i18n.tooltip.assertAria },
  ];
}
