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

type RecorderMessages = {
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

const messages: Record<RecorderLocale, RecorderMessages> = {
  en: {
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
  'zh-CN': {
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
  'zh-TW': {
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
  'ja-JP': {
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

export function getRecorderMessages(locale: string | null | undefined): RecorderMessages {
  return messages[normalizeRecorderLocale(locale)];
}