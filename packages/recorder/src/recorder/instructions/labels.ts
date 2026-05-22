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

import type { RecorderLocale } from '../../recorderTypes';
import type { RecorderInstructionLabels } from './types';

const englishLabels: RecorderInstructionLabels = {
  textAssertionTitle: 'Text assertion',
  valueAssertionTitle: 'Value assertion',
  expectedText: 'Expected text',
  expectedValue: 'Expected value',
  containsText: 'Contains text',
  containsValue: 'Contains value',
  assertEmptyValue: 'Assert empty value',
  confirm: 'Confirm',
  edit: 'Edit',
  reset: 'Reset',
  confirmed: 'Confirmed',
  needsConfirmation: 'Needs confirmation',
  confirmBeforeSave: 'Confirm text/value assertion settings before saving.',
};

const simplifiedChineseLabels: RecorderInstructionLabels = {
  textAssertionTitle: '文本断言',
  valueAssertionTitle: '值断言',
  expectedText: '期望文本',
  expectedValue: '期望值',
  containsText: '包含文本',
  containsValue: '包含值',
  assertEmptyValue: '断言为空值',
  confirm: '确认',
  edit: '编辑',
  reset: '重置',
  confirmed: '已确认',
  needsConfirmation: '待确认',
  confirmBeforeSave: '请先确认文本/值断言配置，再保存。',
};

const traditionalChineseLabels: RecorderInstructionLabels = {
  textAssertionTitle: '文字斷言',
  valueAssertionTitle: '值斷言',
  expectedText: '期望文字',
  expectedValue: '期望值',
  containsText: '包含文字',
  containsValue: '包含值',
  assertEmptyValue: '斷言為空值',
  confirm: '確認',
  edit: '編輯',
  reset: '重設',
  confirmed: '已確認',
  needsConfirmation: '待確認',
  confirmBeforeSave: '請先確認文字/值斷言設定，再儲存。',
};

const japaneseLabels: RecorderInstructionLabels = {
  textAssertionTitle: 'テキストアサーション',
  valueAssertionTitle: '値アサーション',
  expectedText: '期待するテキスト',
  expectedValue: '期待する値',
  containsText: 'テキストを含む',
  containsValue: '値を含む',
  assertEmptyValue: '空の値を確認',
  confirm: '確認',
  edit: '編集',
  reset: 'リセット',
  confirmed: '確認済み',
  needsConfirmation: '確認待ち',
  confirmBeforeSave: '保存する前にテキスト/値アサーション設定を確認してください。',
};

export function recorderInstructionLabels(locale: RecorderLocale): RecorderInstructionLabels {
  if (locale === 'zh-CN')
    return simplifiedChineseLabels;
  if (locale === 'zh-TW')
    return traditionalChineseLabels;
  if (locale === 'ja-JP')
    return japaneseLabels;
  return englishLabels;
}
