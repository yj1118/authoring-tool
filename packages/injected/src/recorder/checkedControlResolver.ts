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

export type CheckedControlResolutionKind =
  | 'self'
  | 'label_control'
  | 'label_descendant'
  | 'descendant'
  | 'ancestor_descendant';

export type CheckedControlResolution =
  | {
    ok: true;
    control: HTMLInputElement;
    highlightElement: Element;
    kind: CheckedControlResolutionKind;
    matchCount: number;
  }
  | {
    ok: false;
    reason: 'unsupported' | 'ambiguous';
    kind: CheckedControlResolutionKind | null;
    matchCount: number;
  };

const checkedControlSelector = 'input[type=checkbox], input[type=radio]';

export function resolveCheckedControlTarget(target: Element | null): CheckedControlResolution {
  if (!target)
    return unresolved('unsupported', null, 0);

  const self = asCheckedInput(target);
  if (self)
    return resolved(self, target, 'self');

  const label = typeof target.closest === 'function' ? target.closest('label') : null;
  if (label) {
    const labelControl = asCheckedInput((label as HTMLLabelElement).control);
    if (labelControl)
      return resolved(labelControl, label, 'label_control');
    const labelDescendants = checkedInputsIn(label);
    const labelResolved = resolveUniqueCandidate(labelDescendants, label, 'label_descendant');
    if (labelResolved)
      return labelResolved;
  }

  const descendants = checkedInputsIn(target);
  const descendantResolved = resolveUniqueCandidate(descendants, target, 'descendant');
  if (descendantResolved)
    return descendantResolved;

  let ancestor = target.parentElement ?? null;
  let depth = 0;
  while (ancestor && depth < 3) {
    const ancestorDescendants = checkedInputsIn(ancestor);
    const ancestorResolved = resolveUniqueCandidate(ancestorDescendants, ancestor, 'ancestor_descendant');
    if (ancestorResolved)
      return ancestorResolved;
    ancestor = ancestor.parentElement;
    ++depth;
  }

  return unresolved('unsupported', null, 0);
}

function checkedInputsIn(scope: Element): HTMLInputElement[] {
  if (typeof scope.querySelectorAll !== 'function')
    return [];
  return [...scope.querySelectorAll(checkedControlSelector)].map(asCheckedInput).filter((input): input is HTMLInputElement => !!input);
}

function resolveUniqueCandidate(candidates: HTMLInputElement[], highlightElement: Element, kind: CheckedControlResolutionKind): CheckedControlResolution | null {
  if (!candidates.length)
    return null;
  if (candidates.length === 1)
    return resolved(candidates[0], highlightElement, kind);
  return unresolved('ambiguous', kind, candidates.length);
}

function resolved(control: HTMLInputElement, highlightElement: Element, kind: CheckedControlResolutionKind): CheckedControlResolution {
  return { ok: true, control, highlightElement, kind, matchCount: 1 };
}

function unresolved(reason: 'unsupported' | 'ambiguous', kind: CheckedControlResolutionKind | null, matchCount: number): CheckedControlResolution {
  return { ok: false, reason, kind, matchCount };
}

function asCheckedInput(element: Element | null): HTMLInputElement | null {
  if (!element || element.nodeName !== 'INPUT')
    return null;
  const input = element as HTMLInputElement;
  const type = input.type.toLowerCase();
  return type === 'checkbox' || type === 'radio' ? input : null;
}
