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

import { resolveCheckedControlTarget } from './checkedControlResolver';

import type * as actions from '@recorder/actions';
import type { HighlightModelWithSelector, Recorder, RecorderTool } from './recorder';

const checkedStateHighlightColor = '#8acae480';

export class CheckedStateAssertionTool implements RecorderTool {
  private _hoverHighlight: HighlightModelWithSelector | null = null;
  private _recorder: Recorder;
  private _expectedChecked: boolean;

  constructor(recorder: Recorder, expectedChecked: boolean) {
    this._recorder = recorder;
    this._expectedChecked = expectedChecked;
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
    const action = this._generateAction(this._recorder.deepEventTarget(event));
    if (!action)
      return;
    const mode = this._expectedChecked ? 'assertingChecked' : 'assertingUnchecked';
    void this._recorder.recordAction(action);
    this._recorder.setMode(this._recorder.modeAfterAssertion(mode));
    this._recorder.overlay?.flashToolSucceeded(mode);
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

  private _generateAction(target: Element): actions.AssertCheckedAction | null {
    const highlight = this._buildHighlight(target);
    if (!highlight)
      return null;
    return {
      name: 'assertChecked',
      selector: highlight.selector,
      signals: [],
      checked: this._expectedChecked,
    };
  }

  private _buildHighlight(target: Element): HighlightModelWithSelector | null {
    const resolution = resolveCheckedControlTarget(target);
    if (!resolution.ok)
      return null;
    const generated = this._recorder.injectedScript.generateSelector(resolution.control, { testIdAttributeName: this._recorder.state.testIdAttributeName });
    if (!generated.selector)
      return null;
    return {
      selector: generated.selector,
      elements: [resolution.highlightElement],
      color: checkedStateHighlightColor,
      tooltipText: generated.selector,
    };
  }
}

function consumeEvent(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}
