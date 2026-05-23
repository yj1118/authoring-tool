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

const disabledStateHighlightColor = '#8acae480';

export class DisabledStateAssertionTool implements RecorderTool {
  private _committedOnPointerUp = false;
  private _hoverHighlight: HighlightModelWithSelector | null = null;
  private _pendingAction: actions.AssertDisabledAction | null = null;
  private _recorder: Recorder;

  constructor(recorder: Recorder) {
    this._recorder = recorder;
  }

  cursor() {
    return 'pointer';
  }

  uninstall() {
    this._committedOnPointerUp = false;
    this._hoverHighlight = null;
    this._pendingAction = null;
  }

  allowsPositionActionRecording() {
    return true;
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);
    if (this._committedOnPointerUp) {
      this._committedOnPointerUp = false;
      return;
    }
    if (event.button)
      return;
    const action = this._pendingAction ?? this._generateAction(this._recorder.deepEventTarget(event));
    this._pendingAction = null;
    this._commitAssertion(action);
  }

  onMouseDown(event: MouseEvent) {
    this._committedOnPointerUp = false;
    const target = this._recorder.deepEventTarget(event);
    this._pendingAction = this._generateAction(target);
    if (this._pendingAction)
      event.preventDefault();
  }

  onPointerUp(event: PointerEvent) {
    const element = this._targetElement(this._recorder.deepEventTarget(event));
    const action = this._pendingAction ?? (element ? this._generateActionForElement(element) : null);
    if (!action?.disabled || !element?.matches(':disabled'))
      return;
    consumeEvent(event);
    this._committedOnPointerUp = true;
    this._pendingAction = null;
    this._commitAssertion(action);
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

  private _generateAction(target: Element): actions.AssertDisabledAction | null {
    const element = this._targetElement(target);
    if (!element)
      return null;
    return this._generateActionForElement(element);
  }

  private _generateActionForElement(element: Element): actions.AssertDisabledAction | null {
    const generated = this._recorder.injectedScript.generateSelector(element, { testIdAttributeName: this._recorder.state.testIdAttributeName });
    if (!generated.selector)
      return null;
    return {
      name: 'assertDisabled',
      selector: generated.selector,
      signals: [],
      disabled: this._isDisabled(element),
    };
  }

  private _buildHighlight(target: Element): HighlightModelWithSelector | null {
    const element = this._targetElement(target);
    if (!element)
      return null;
    const generated = this._recorder.injectedScript.generateSelector(element, { testIdAttributeName: this._recorder.state.testIdAttributeName });
    if (!generated.selector)
      return null;
    return {
      selector: generated.selector,
      elements: generated.elements.length ? generated.elements : [element],
      color: disabledStateHighlightColor,
      tooltipText: generated.selector,
    };
  }

  private _targetElement(target: Element): Element | null {
    const element = this._recorder.injectedScript.retarget(target, 'follow-label');
    return element?.isConnected ? element : null;
  }

  private _isDisabled(element: Element): boolean {
    return this._recorder.injectedScript.elementState(element, 'disabled').matches;
  }

  private _commitAssertion(action: actions.AssertDisabledAction | null) {
    if (!action)
      return;
    const mode = 'assertingDisabled';
    void this._recorder.recordAction(action);
    this._recorder.setMode(this._recorder.modeAfterAssertion(mode));
    this._recorder.overlay?.flashToolSucceeded(mode);
  }
}

function consumeEvent(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}
