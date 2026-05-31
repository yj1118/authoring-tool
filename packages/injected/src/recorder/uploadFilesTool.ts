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

import type * as actions from '@recorder/actions';
import type { HighlightModelWithSelector, Recorder, RecorderTool } from './recorder';

const uploadFilesHighlightColor = '#8acae480';

type UploadInputResolution = {
  input: HTMLInputElement;
};

export class UploadFilesTool implements RecorderTool {
  private _hoverHighlight: HighlightModelWithSelector | null = null;
  private _recorder: Recorder;

  constructor(recorder: Recorder) {
    this._recorder = recorder;
  }

  cursor() {
    return 'pointer';
  }

  uninstall() {
    this._hoverHighlight = null;
  }

  allowsPositionActionRecording() {
    return true;
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);
    if (event.button)
      return;
    this._commitUploadTarget();
  }

  onMouseDown(event: MouseEvent) {
    if (this._buildHighlight(this._recorder.deepEventTarget(event)))
      event.preventDefault();
  }

  onMouseMove(event: MouseEvent) {
    const target = this._recorder.deepEventTarget(event);
    const hoverHighlight = this._buildHighlight(target);
    if (this._hoverHighlight?.elements[0] === hoverHighlight?.elements[0] && this._hoverHighlight?.selector === hoverHighlight?.selector)
      return;
    this._hoverHighlight = hoverHighlight;
    this._recorder.updateHighlight(this._hoverHighlight, true);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape')
      this._recorder.setMode('recording');
    consumeEvent(event);
  }

  onScroll(_event: Event) {
    this._recorder.updateHighlight(this._hoverHighlight, false);
  }

  private _targetInput(): HTMLInputElement | null {
    const target = this._hoverHighlight?.elements[0];
    return target && isFileInput(target) ? target : null;
  }

  private _generateAction(): actions.UploadFilesAction | null {
    const target = this._targetInput();
    if (!target)
      return null;
    const generated = this._recorder.injectedScript.generateSelector(target, { testIdAttributeName: this._recorder.state.testIdAttributeName });
    if (!generated.selector)
      return null;
    return {
      name: 'uploadFiles',
      selector: generated.selector,
      signals: [],
      acceptsMultiple: target.multiple,
    };
  }

  private _buildHighlight(target: Element): HighlightModelWithSelector | null {
    const resolution = resolveUploadInputTarget(target);
    if (!resolution)
      return null;
    const generated = this._recorder.injectedScript.generateSelector(resolution.input, { testIdAttributeName: this._recorder.state.testIdAttributeName });
    if (!generated.selector)
      return null;
    return {
      selector: generated.selector,
      elements: [resolution.input],
      color: uploadFilesHighlightColor,
      tooltipText: generated.selector,
    };
  }

  private _commitUploadTarget() {
    const action = this._generateAction();
    if (!action)
      return;
    void this._recorder.recordAction(action);
    const mode = 'uploadingFiles';
    this._recorder.setMode('recording');
    this._recorder.overlay?.flashToolSucceeded(mode);
  }
}

function resolveUploadInputTarget(target: Element): UploadInputResolution | null {
  const direct = asFileInput(target);
  if (direct)
    return { input: direct };

  const label = target.closest('label');
  if (label) {
    const associated = asFileInput((label as HTMLLabelElement).control);
    if (associated)
      return { input: associated };
    const labelledDescendant = uniqueFileInput(label);
    if (labelledDescendant)
      return { input: labelledDescendant };
  }

  const descendant = uniqueFileInput(target);
  if (descendant)
    return { input: descendant };

  return null;
}

function uniqueFileInput(root: Element): HTMLInputElement | null {
  const inputs = [...root.querySelectorAll('input')].filter(isFileInput);
  return inputs.length === 1 ? inputs[0] : null;
}

function asFileInput(element: Element | null): HTMLInputElement | null {
  return element && isFileInput(element) ? element : null;
}

function isFileInput(element: Element): element is HTMLInputElement {
  return element.nodeName === 'INPUT' && (element as HTMLInputElement).type.toLowerCase() === 'file';
}

function consumeEvent(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}
