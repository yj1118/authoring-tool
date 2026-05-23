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

const passwordInputHighlightColor = '#8acae480';

type PasswordInputResolution = {
  input: HTMLInputElement;
};

const passwordAssertionCandidateInputTypes = new Set([
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
]);

export class PasswordInputAssertionTool implements RecorderTool {
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
    this._commitAssertion();
  }

  onMouseDown(event: MouseEvent) {
    if (this._buildHighlight(this._recorder.deepEventTarget(event)))
      event.preventDefault();
  }

  onPointerUp(_event: PointerEvent) {
    const target = this._targetInput();
    if (target?.disabled)
      this._commitAssertion();
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
    return target && isPasswordAssertionCandidateInput(target) ? target : null;
  }

  private _generateAction(): actions.AssertPasswordInputAction | null {
    const target = this._targetInput();
    if (!target)
      return null;
    const generated = this._recorder.injectedScript.generateSelector(target, { testIdAttributeName: this._recorder.state.testIdAttributeName });
    if (!generated.selector)
      return null;
    const shouldAssertValue = target.value.length === 0;
    return {
      name: 'assertPasswordInput',
      selector: generated.selector,
      signals: [],
      assertValue: shouldAssertValue,
      value: '',
    };
  }

  private _buildHighlight(target: Element): HighlightModelWithSelector | null {
    const resolution = resolvePasswordInputTarget(target);
    if (!resolution)
      return null;
    const generated = this._recorder.injectedScript.generateSelector(resolution.input, { testIdAttributeName: this._recorder.state.testIdAttributeName });
    if (!generated.selector)
      return null;
    return {
      selector: generated.selector,
      elements: [resolution.input],
      color: passwordInputHighlightColor,
      tooltipText: generated.selector,
    };
  }

  private _commitAssertion() {
    const action = this._generateAction();
    if (!action)
      return;
    void this._recorder.recordAction(action);
    const mode = 'assertingPasswordInput';
    this._recorder.setMode(this._recorder.modeAfterAssertion(mode));
    this._recorder.overlay?.flashToolSucceeded(mode);
  }
}

function resolvePasswordInputTarget(target: Element): PasswordInputResolution | null {
  const direct = asPasswordAssertionCandidateInput(target);
  if (direct)
    return { input: direct };

  const label = target.closest('label');
  if (label) {
    const associated = asPasswordAssertionCandidateInput((label as HTMLLabelElement).control);
    if (associated)
      return { input: associated };
    const labelledDescendant = uniquePasswordAssertionCandidateInput(label);
    if (labelledDescendant)
      return { input: labelledDescendant };
  }

  const descendant = uniquePasswordAssertionCandidateInput(target);
  if (descendant)
    return { input: descendant };

  return null;
}

function uniquePasswordAssertionCandidateInput(root: Element): HTMLInputElement | null {
  const inputs = [...root.querySelectorAll('input')].filter(isPasswordAssertionCandidateInput);
  return inputs.length === 1 ? inputs[0] : null;
}

function asPasswordAssertionCandidateInput(element: Element | null): HTMLInputElement | null {
  return element && isPasswordAssertionCandidateInput(element) ? element : null;
}

function isPasswordAssertionCandidateInput(element: Element): element is HTMLInputElement {
  if (element.nodeName !== 'INPUT')
    return false;
  return passwordAssertionCandidateInputTypes.has((element as HTMLInputElement).type.toLowerCase());
}

function consumeEvent(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}
