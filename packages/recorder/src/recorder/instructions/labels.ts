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
  uploadAssetTitle: 'Upload asset',
  uploadAssetHelp: 'Select the case asset that should be uploaded into this file input.',
  uploadAssetSingleFileOnly: 'This input accepts one file, so only one asset can be selected.',
  uploadAssetNoBoundAssets: 'No upload assets are bound to this task.',
  uploadAssetSelectBeforeConfirm: 'Select at least one asset before confirming this action.',
  uploadAssetApplying: 'Applying selected files to the current page...',
  uploadAssetApplyFailed: 'Could not apply selected files to the current page.',
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
  uploadAssetTitle: '上传资产',
  uploadAssetHelp: '选择要上传到这个文件输入框的用例资产。',
  uploadAssetSingleFileOnly: '这个输入框只支持单文件，因此只能选择一个资产。',
  uploadAssetNoBoundAssets: '没有绑定到这个任务的上传资产。',
  uploadAssetSelectBeforeConfirm: '请先选择至少一个资产，再确认这个动作。',
  uploadAssetApplying: '正在将选中文件应用到当前页面...',
  uploadAssetApplyFailed: '无法将选中文件应用到当前页面。',
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
  uploadAssetTitle: '上傳資產',
  uploadAssetHelp: '選擇要上傳到這個檔案輸入框的用例資產。',
  uploadAssetSingleFileOnly: '這個輸入框只支援單檔案，因此只能選擇一個資產。',
  uploadAssetNoBoundAssets: '沒有綁定到這個任務的上傳資產。',
  uploadAssetSelectBeforeConfirm: '請先選擇至少一個資產，再確認這個動作。',
  uploadAssetApplying: '正在將選取檔案套用到目前頁面...',
  uploadAssetApplyFailed: '無法將選取檔案套用到目前頁面。',
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
  uploadAssetTitle: 'アップロード資産',
  uploadAssetHelp: 'このファイル入力にアップロードするケース資産を選択してください。',
  uploadAssetSingleFileOnly: 'この入力は1つのファイルのみ受け付けるため、1つの資産だけ選択できます。',
  uploadAssetNoBoundAssets: 'このタスクに紐づいたアップロード資産はありません。',
  uploadAssetSelectBeforeConfirm: 'この操作を確定する前に、1つ以上の資産を選択してください。',
  uploadAssetApplying: '選択したファイルを現在のページに適用しています...',
  uploadAssetApplyFailed: '選択したファイルを現在のページに適用できませんでした。',
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
