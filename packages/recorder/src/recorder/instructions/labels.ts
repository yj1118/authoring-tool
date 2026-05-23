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
  disabledAssertionTitle: 'Disabled state assertion',
  expectedDisabledState: 'Expected state',
  disabledState: 'Disabled',
  notDisabledState: 'Not disabled',
  checkedAssertionTitle: 'Checked state assertion',
  textAssertionTitle: 'Text assertion',
  valueAssertionTitle: 'Value assertion',
  passwordInputAssertionTitle: 'Password input assertion',
  selectOptionsAssertionTitle: 'Select options assertion',
  expectedText: 'Expected text',
  expectedValue: 'Expected value',
  expectedCheckedState: 'Expected state',
  optionTexts: 'Option text',
  optionValues: 'Option value',
  containsText: 'Contains text',
  containsValue: 'Contains value',
  assertPasswordValue: 'Verify value',
  matchByText: 'Match by text',
  matchByValue: 'Match by value',
  exactOptions: 'Full match',
  containsOptions: 'Contains items',
  checkedState: 'Checked',
  uncheckedState: 'Unchecked',
  confirm: 'Confirm',
  edit: 'Edit',
  reset: 'Reset',
  confirmed: 'Confirmed',
  needsConfirmation: 'Needs confirmation',
  confirmBeforeSave: 'Confirm assertion settings before saving.',
};

const simplifiedChineseLabels: RecorderInstructionLabels = {
  disabledAssertionTitle: '\u7981\u7528\u72b6\u6001\u65ad\u8a00',
  expectedDisabledState: '\u671f\u671b\u72b6\u6001',
  disabledState: '\u7981\u7528',
  notDisabledState: '\u975e\u7981\u7528',
  checkedAssertionTitle: '勾选状态断言',
  textAssertionTitle: '文本断言',
  valueAssertionTitle: '值断言',
  passwordInputAssertionTitle: '密码框断言',
  selectOptionsAssertionTitle: '下拉选项断言',
  expectedText: '期望文本',
  expectedValue: '期望值',
  expectedCheckedState: '期望状态',
  optionTexts: '选项文本',
  optionValues: '选项值',
  containsText: '包含文本',
  containsValue: '包含值',
  assertPasswordValue: '校验输入值',
  matchByText: '按文本匹配',
  matchByValue: '按值匹配',
  exactOptions: '完整匹配',
  containsOptions: '只包含项',
  checkedState: '勾选',
  uncheckedState: '未勾选',
  confirm: '确认',
  edit: '编辑',
  reset: '重置',
  confirmed: '已确认',
  needsConfirmation: '待确认',
  confirmBeforeSave: '请先确认断言配置，再保存。',
};

const traditionalChineseLabels: RecorderInstructionLabels = {
  disabledAssertionTitle: '\u505c\u7528\u72c0\u614b\u65b7\u8a00',
  expectedDisabledState: '\u671f\u671b\u72c0\u614b',
  disabledState: '\u505c\u7528',
  notDisabledState: '\u975e\u505c\u7528',
  checkedAssertionTitle: '勾選狀態斷言',
  textAssertionTitle: '文字斷言',
  valueAssertionTitle: '值斷言',
  passwordInputAssertionTitle: '密碼框斷言',
  selectOptionsAssertionTitle: '下拉選項斷言',
  expectedText: '期望文字',
  expectedValue: '期望值',
  expectedCheckedState: '期望狀態',
  optionTexts: '選項文字',
  optionValues: '選項值',
  containsText: '包含文字',
  containsValue: '包含值',
  assertPasswordValue: '校驗輸入值',
  matchByText: '按文字比對',
  matchByValue: '按值比對',
  exactOptions: '完整比對',
  containsOptions: '只包含項',
  checkedState: '勾選',
  uncheckedState: '未勾選',
  confirm: '確認',
  edit: '編輯',
  reset: '重設',
  confirmed: '已確認',
  needsConfirmation: '待確認',
  confirmBeforeSave: '請先確認斷言設定，再儲存。',
};

const japaneseLabels: RecorderInstructionLabels = {
  disabledAssertionTitle: '\u7121\u52b9\u72b6\u614b\u30a2\u30b5\u30fc\u30b7\u30e7\u30f3',
  expectedDisabledState: '\u671f\u5f85\u72b6\u614b',
  disabledState: '\u7121\u52b9',
  notDisabledState: '\u975e\u7121\u52b9',
  checkedAssertionTitle: 'チェック状態アサーション',
  textAssertionTitle: 'テキストアサーション',
  valueAssertionTitle: '値アサーション',
  passwordInputAssertionTitle: 'パスワード入力欄アサーション',
  selectOptionsAssertionTitle: 'セレクト項目アサーション',
  expectedText: '期待するテキスト',
  expectedValue: '期待する値',
  expectedCheckedState: '期待状態',
  optionTexts: '項目テキスト',
  optionValues: '項目値',
  containsText: 'テキストを含む',
  containsValue: '値を含む',
  assertPasswordValue: '値を検証',
  matchByText: 'テキストで照合',
  matchByValue: '値で照合',
  exactOptions: '完全一致',
  containsOptions: '項目を含む',
  checkedState: 'チェック済み',
  uncheckedState: '未チェック',
  confirm: '確認',
  edit: '編集',
  reset: 'リセット',
  confirmed: '確認済み',
  needsConfirmation: '確認待ち',
  confirmBeforeSave: '保存する前にアサーション設定を確認してください。',
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
