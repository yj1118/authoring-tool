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

import type { SelectorAuthoringClipboardPayload } from './recorderTypes';

export function copySelectorToClipboard(selector: string): SelectorAuthoringClipboardPayload {
  const textArea = document.createElement('textarea');
  textArea.style.position = 'absolute';
  textArea.style.zIndex = '-1000';
  textArea.value = selector;
  document.body.appendChild(textArea);
  textArea.select();

  try {
    const copied = document.execCommand('copy');
    return copied
      ? { attempted: true, ok: true }
      : { attempted: true, ok: false, errorMessage: 'document.execCommand(\'copy\') returned false' };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    textArea.remove();
  }
}
