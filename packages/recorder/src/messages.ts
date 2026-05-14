/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { RecorderLocale } from './recorderTypes';

type AuthoringCommonMessages = {
  authoringToolName: string;
};

type SelectorAuthoringMessages = {
  windowTitle: string;
  pickSelector: string;
  stopPicking: string;
  savedCount: (count: number) => string;
  clearAll: string;
  copied: string;
  copy: string;
  remove: string;
  notePlaceholder: string;
  emptyTitle: string;
  emptyPrefix: string;
  emptySuffix: string;
};

type RecorderAuthoringMessages = {
  windowTitle: string;
  recorderPlaceholderTitle: string;
  recorderPlaceholderBody: string;
  record: string;
  stop: string;
  assertVisible: string;
  assertText: string;
  assertValue: string;
  assertAria: string;
  recordScroll: string;
  clear: string;
  save: string;
  noLaunchContext: string;
  launchContextTimeout: string;
  noRecordedActionsYet: string;
  recordAtLeastOneActionOrAssertion: string;
  saveFailed: string;
  saved: (recordingId?: string) => string;
  savingOverlayTitle: string;
  savingOverlayDescription: string;
  countSummary: (actionCount: number, assertionCount: number) => string;
  failureAdvice: {
    retrySave: string;
    rerecord: string;
    checkClient: string;
    checkServer: string;
    checkStorage: string;
    checkScript: string;
  };
  tooltip: {
    record: string;
    stop: string;
    assertVisible: string;
    assertText: string;
    assertValue: string;
    assertAria: string;
    recordScroll: string;
    clear: string;
    save: string;
    deleteAction: string;
  };
  status: {
    idle: string;
    loadingPage: string;
    ready: string;
    recording: string;
    stopped: string;
    generating: string;
    uploading: string;
    committing: string;
  };
};

type AuthoringMessages = {
  common: AuthoringCommonMessages;
  selector: SelectorAuthoringMessages;
  recorder: RecorderAuthoringMessages;
};

const messages: Record<RecorderLocale, AuthoringMessages> = {
  en: {
    common: {
      authoringToolName: 'Authoring Tool',
    },
    selector: {
      windowTitle: 'Selector Authoring Tool',
      pickSelector: 'Pick selector',
      stopPicking: 'Stop picking',
      savedCount: count => `${count} saved`,
      clearAll: 'Clear all',
      copied: 'Copied',
      copy: 'Copy',
      remove: 'Remove',
      notePlaceholder: 'Add an optional note here',
      emptyTitle: 'No selectors saved yet',
      emptyPrefix: 'Start with ',
      emptySuffix: ', then click elements in the page to build a reusable selector list.',
    },
    recorder: {
      windowTitle: 'Recorder Authoring Tool',
      recorderPlaceholderTitle: 'Recorder mode is not available yet',
      recorderPlaceholderBody: 'This authoring mode is reserved for recorded step replay. Selector mode remains available.',
      record: 'Actions',
      stop: 'Stop',
      assertVisible: 'Visible',
      assertText: 'Text',
      assertValue: 'Value',
      assertAria: 'ARIA',
      recordScroll: 'Scroll',
      clear: 'Clear',
      save: 'Save',
      noLaunchContext: 'No launch context',
      launchContextTimeout: 'Recorder launch context did not arrive in time. Keep the Client running, close this recorder window, and open recording again.',
      noRecordedActionsYet: 'No recorded actions yet',
      recordAtLeastOneActionOrAssertion: 'Record at least one action or assertion before saving.',
      saveFailed: 'Recording save failed.',
      saved: recordingId => `Saved ${recordingId ?? ''}`.trim(),
      savingOverlayTitle: 'Saving recording',
      savingOverlayDescription: 'Please keep this window open while the recorded script is being saved.',
      countSummary: (actionCount, assertionCount) => `${actionCount} actions, ${assertionCount} assertions`,
      failureAdvice: {
        retrySave: 'Retry Save after the temporary issue is resolved.',
        rerecord: 'Clear and record this step again if the generated script looks wrong.',
        checkClient: 'Keep the local Client running, then retry Save.',
        checkServer: 'Check the Web Console or Orchestrator service, then retry Save.',
        checkStorage: 'Check the recording storage grant or S3/MinIO connectivity, then retry Save.',
        checkScript: 'Clear and record again; the generated script failed validation.',
      },
      tooltip: {
        record: 'Record browser actions such as clicks, typing, selections, and navigation.',
        stop: 'Stop recording new browser interactions.',
        assertVisible: 'Pick an element and record an assertion that it should be visible.',
        assertText: 'Pick an element and record an assertion for its current text.',
        assertValue: 'Pick a form control and record an assertion for its current value.',
        assertAria: 'Pick a region and record an ARIA snapshot assertion for its accessibility structure.',
        recordScroll: 'When enabled, page scrolling is recorded along with the active action or assertion mode.',
        clear: 'Clear all recorded actions and assertions in this session.',
        save: 'Generate and save the recorded script for this step.',
        deleteAction: 'Remove this recorded action or assertion from the script.',
      },
      status: {
        idle: 'idle',
        loadingPage: 'loading page',
        ready: 'ready',
        recording: 'recording',
        stopped: 'stopped',
        generating: 'generating',
        uploading: 'uploading',
        committing: 'committing',
      },
    },
  },
  'zh-CN': {
    common: {
      authoringToolName: '创作工具',
    },
    selector: {
      windowTitle: '选择器工具',
      pickSelector: '选择元素',
      stopPicking: '停止选择',
      savedCount: count => `已保存 ${count} 个`,
      clearAll: '清空全部',
      copied: '已复制',
      copy: '复制',
      remove: '移除',
      notePlaceholder: '可选备注',
      emptyTitle: '还没有保存任何选择器',
      emptyPrefix: '先点击',
      emptySuffix: '，再点击页面中的元素，即可建立可复用的选择器列表。',
    },
    recorder: {
      windowTitle: '录制工具',
      recorderPlaceholderTitle: '录制模式暂未开放',
      recorderPlaceholderBody: '这里是录制回放模组的预留入口。当前选择器模式仍可正常使用。',
      record: '操作',
      stop: '停止',
      assertVisible: '可见性',
      assertText: '文本',
      assertValue: '值',
      assertAria: 'ARIA',
      recordScroll: '滚动',
      clear: '清空',
      save: '保存',
      noLaunchContext: '没有启动上下文',
      launchContextTimeout: '录制启动上下文获取超时。请保持本地 Client 正在运行，关闭当前录制窗口后重新打开录制。',
      noRecordedActionsYet: '还没有录制任何操作',
      recordAtLeastOneActionOrAssertion: '保存前请至少录制一个操作或断言。',
      saveFailed: '录制保存失败。',
      saved: recordingId => `已保存 ${recordingId ?? ''}`.trim(),
      savingOverlayTitle: '正在保存录制',
      savingOverlayDescription: '正在提交录制脚本，请保持窗口打开。',
      countSummary: (actionCount, assertionCount) => `${actionCount} 个操作，${assertionCount} 个断言`,
      failureAdvice: {
        retrySave: '临时问题恢复后，请重试保存。',
        rerecord: '如果生成的脚本看起来不正确，请清空后重新录制这个步骤。',
        checkClient: '请保持本地 Client 正在运行，然后重试保存。',
        checkServer: '请检查 Web Console 或 Orchestrator 服务，然后重试保存。',
        checkStorage: '请检查录制存储授权或 S3/MinIO 连接，然后重试保存。',
        checkScript: '请清空并重新录制；生成的脚本没有通过校验。',
      },
      tooltip: {
        record: '录制点击、输入、选择、导航等页面行为。',
        stop: '停止继续录制新的浏览器操作。',
        assertVisible: '选择页面元素，并录制“该元素应该可见”的断言。',
        assertText: '选择页面元素，并录制它当前文本内容的断言。',
        assertValue: '选择表单控件，并录制它当前 value 的断言。',
        assertAria: '选择页面区域，并录制它无障碍语义结构的 ARIA snapshot 断言。',
        recordScroll: '开启后，页面滚动会跟随当前操作或断言模式一起录制。',
        clear: '清空当前会话里已经录制的所有操作和断言。',
        save: '为当前步骤生成并保存录制脚本。',
        deleteAction: '从脚本中移除这条已录制的操作或断言。',
      },
      status: {
        idle: '空闲',
        loadingPage: '页面加载中',
        ready: '就绪',
        recording: '录制中',
        stopped: '已停止',
        generating: '生成中',
        uploading: '上传中',
        committing: '提交中',
      },
    },
  },
  'zh-TW': {
    common: {
      authoringToolName: '創作工具',
    },
    selector: {
      windowTitle: '選擇器工具',
      pickSelector: '選取元素',
      stopPicking: '停止選取',
      savedCount: count => `已儲存 ${count} 個`,
      clearAll: '清空全部',
      copied: '已複製',
      copy: '複製',
      remove: '移除',
      notePlaceholder: '可選備註',
      emptyTitle: '尚未儲存任何選擇器',
      emptyPrefix: '先點擊',
      emptySuffix: '，再點擊頁面中的元素，即可建立可重複使用的選擇器清單。',
    },
    recorder: {
      windowTitle: '錄製工具',
      recorderPlaceholderTitle: '錄製模式尚未開放',
      recorderPlaceholderBody: '這裡是錄製回放模組的預留入口。現在選擇器模式仍可正常使用。',
      record: '操作',
      stop: '停止',
      assertVisible: '可見性',
      assertText: '文字',
      assertValue: '值',
      assertAria: 'ARIA',
      recordScroll: '捲動',
      clear: '清空',
      save: '儲存',
      noLaunchContext: '沒有啟動上下文',
      launchContextTimeout: '錄製啟動上下文取得逾時。請保持本機 Client 正在執行，關閉目前錄製視窗後重新開啟錄製。',
      noRecordedActionsYet: '尚未錄製任何操作',
      recordAtLeastOneActionOrAssertion: '儲存前請至少錄製一個操作或斷言。',
      saveFailed: '錄製儲存失敗。',
      saved: recordingId => `已儲存 ${recordingId ?? ''}`.trim(),
      savingOverlayTitle: '正在儲存錄製',
      savingOverlayDescription: '正在提交錄製腳本，請保持視窗開啟。',
      countSummary: (actionCount, assertionCount) => `${actionCount} 個操作，${assertionCount} 個斷言`,
      failureAdvice: {
        retrySave: '暫時性問題恢復後，請重試儲存。',
        rerecord: '如果產生的腳本看起來不正確，請清空後重新錄製這個步驟。',
        checkClient: '請保持本機 Client 正在執行，然後重試儲存。',
        checkServer: '請檢查 Web Console 或 Orchestrator 服務，然後重試儲存。',
        checkStorage: '請檢查錄製儲存授權或 S3/MinIO 連線，然後重試儲存。',
        checkScript: '請清空並重新錄製；產生的腳本未通過校驗。',
      },
      tooltip: {
        record: '錄製點擊、輸入、選擇、導覽等頁面行為。',
        stop: '停止繼續錄製新的瀏覽器操作。',
        assertVisible: '選取頁面元素，並錄製「該元素應可見」的斷言。',
        assertText: '選取頁面元素，並錄製它目前文字內容的斷言。',
        assertValue: '選取表單控制項，並錄製它目前 value 的斷言。',
        assertAria: '選取頁面區域，並錄製它無障礙語意結構的 ARIA snapshot 斷言。',
        recordScroll: '開啟後，頁面捲動會跟隨目前操作或斷言模式一起錄製。',
        clear: '清空目前工作階段已錄製的所有操作和斷言。',
        save: '為目前步驟生成並儲存錄製腳本。',
        deleteAction: '從腳本中移除這條已錄製的操作或斷言。',
      },
      status: {
        idle: '閒置',
        loadingPage: '頁面載入中',
        ready: '就緒',
        recording: '錄製中',
        stopped: '已停止',
        generating: '生成中',
        uploading: '上傳中',
        committing: '提交中',
      },
    },
  },
  'ja-JP': {
    common: {
      authoringToolName: 'オーサリングツール',
    },
    selector: {
      windowTitle: 'セレクターツール',
      pickSelector: '要素を選択',
      stopPicking: '選択を停止',
      savedCount: count => `${count} 件保存済み`,
      clearAll: 'すべてクリア',
      copied: 'コピー済み',
      copy: 'コピー',
      remove: '削除',
      notePlaceholder: '任意のメモ',
      emptyTitle: '保存済みのセレクターはまだありません',
      emptyPrefix: 'まず',
      emptySuffix: 'を押してから、ページ内の要素をクリックして再利用可能なセレクター一覧を作成します。',
    },
    recorder: {
      windowTitle: 'レコーダーツール',
      recorderPlaceholderTitle: 'レコーダーモードはまだ利用できません',
      recorderPlaceholderBody: 'この authoring mode は recorded step replay 用の予約入口です。セレクターモードは引き続き利用できます。',
      record: '操作',
      stop: '停止',
      assertVisible: '表示',
      assertText: 'テキスト',
      assertValue: '値',
      assertAria: 'ARIA',
      recordScroll: 'スクロール',
      clear: 'クリア',
      save: '保存',
      noLaunchContext: '起動コンテキストがありません',
      launchContextTimeout: '録画の起動コンテキストを時間内に取得できませんでした。ローカル Client を起動したまま、この録画ウィンドウを閉じてもう一度開いてください。',
      noRecordedActionsYet: '録画された操作はまだありません',
      recordAtLeastOneActionOrAssertion: '保存する前に、操作またはアサーションを少なくとも1つ録画してください。',
      saveFailed: '録画の保存に失敗しました。',
      saved: recordingId => `保存済み ${recordingId ?? ''}`.trim(),
      savingOverlayTitle: '録画を保存しています',
      savingOverlayDescription: '録画スクリプトを送信しています。このウィンドウは開いたままにしてください。',
      countSummary: (actionCount, assertionCount) => `${actionCount} 件の操作、${assertionCount} 件のアサーション`,
      failureAdvice: {
        retrySave: '一時的な問題が解消したら、保存を再試行してください。',
        rerecord: '生成されたスクリプトが正しくなさそうな場合は、クリアしてこのステップを録画し直してください。',
        checkClient: 'ローカル Client を起動したまま、保存を再試行してください。',
        checkServer: 'Web Console または Orchestrator サービスを確認してから、保存を再試行してください。',
        checkStorage: '録画ストレージ権限または S3/MinIO 接続を確認してから、保存を再試行してください。',
        checkScript: 'クリアして録画し直してください。生成されたスクリプトが検証に失敗しました。',
      },
      tooltip: {
        record: 'クリック、入力、選択、ナビゲーションなどのページ操作を録画します。',
        stop: '新しいブラウザー操作の録画を停止します。',
        assertVisible: '要素を選択し、その要素が表示されていることを確認するアサーションを録画します。',
        assertText: '要素を選択し、現在のテキスト内容を確認するアサーションを録画します。',
        assertValue: 'フォームコントロールを選択し、現在の value を確認するアサーションを録画します。',
        assertAria: '領域を選択し、アクセシビリティ構造の ARIA snapshot アサーションを録画します。',
        recordScroll: 'オンにすると、現在の操作またはアサーションモードと一緒にページスクロールを録画します。',
        clear: 'このセッションで録画済みの操作とアサーションをすべてクリアします。',
        save: 'このステップ用の録画スクリプトを生成して保存します。',
        deleteAction: 'この録画済みの操作またはアサーションをスクリプトから削除します。',
      },
      status: {
        idle: '待機中',
        loadingPage: 'ページ読み込み中',
        ready: '準備完了',
        recording: '録画中',
        stopped: '停止済み',
        generating: '生成中',
        uploading: 'アップロード中',
        committing: 'コミット中',
      },
    },
  },
};

export function normalizeRecorderLocale(input: string | null | undefined): RecorderLocale {
  const normalized = (input || '').trim().replaceAll('_', '-').toLowerCase();
  if (!normalized)
    return 'en';
  if (normalized === 'ja' || normalized.startsWith('ja-'))
    return 'ja-JP';
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-hans' || normalized.startsWith('zh-cn-') || normalized.startsWith('zh-hans') || normalized.startsWith('zh-sg'))
    return 'zh-CN';
  if (normalized === 'zh-tw' || normalized === 'zh-hk' || normalized === 'zh-hant' || normalized.startsWith('zh-tw-') || normalized.startsWith('zh-hk-') || normalized.startsWith('zh-hant'))
    return 'zh-TW';
  return 'en';
}

export function getAuthoringMessages(locale: string | null | undefined): AuthoringMessages {
  return messages[normalizeRecorderLocale(locale)];
}

export function getSelectorAuthoringMessages(locale: string | null | undefined): SelectorAuthoringMessages {
  return getAuthoringMessages(locale).selector;
}

export function getRecorderAuthoringMessages(locale: string | null | undefined): RecorderAuthoringMessages {
  return getAuthoringMessages(locale).recorder;
}
