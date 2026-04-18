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

export const kSelectorAuthoringInspectedWidthRatio = 0.7;

export type SelectorAuthoringRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SelectorAuthoringScreenPayload = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  devicePixelRatio?: number;
  visualLeft?: number;
  visualTop?: number;
  visualWidth?: number;
  visualHeight?: number;
  nativeLeft?: number;
  nativeTop?: number;
  nativeWidth?: number;
  nativeHeight?: number;
};

export type SelectorAuthoringInsets = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type SelectorAuthoringScreenMetrics = {
  workArea: SelectorAuthoringRect;
  scaleFactor: number;
  frameInsets: SelectorAuthoringInsets;
};

export type SelectorAuthoringDockLayout = {
  inspectedBounds: SelectorAuthoringRect;
  toolBounds: SelectorAuthoringRect;
};

export function normalizeSelectorAuthoringScreenMetrics(payload: SelectorAuthoringScreenPayload | null | undefined): SelectorAuthoringScreenMetrics | null {
  if (!payload?.width || !payload.height)
    return null;

  const workArea = {
    left: Math.round(payload.left ?? 0),
    top: Math.round(payload.top ?? 0),
    width: Math.round(payload.width),
    height: Math.round(payload.height),
  };
  const scaleFactor = normalizeScaleFactor(payload.devicePixelRatio);
  return {
    workArea,
    scaleFactor,
    frameInsets: computeFrameInsets(payload, workArea, scaleFactor),
  };
}

export function computeSelectorAuthoringDockLayout(metrics: SelectorAuthoringScreenMetrics, inspectedWidthRatio = kSelectorAuthoringInspectedWidthRatio): SelectorAuthoringDockLayout {
  const workArea = metrics.workArea;
  const inspectedWidth = Math.max(1, Math.min(workArea.width - 1, Math.round(workArea.width * inspectedWidthRatio)));
  const toolWidth = Math.max(1, workArea.width - inspectedWidth);
  return {
    inspectedBounds: applyFrameInsets({
      left: workArea.left,
      top: workArea.top,
      width: inspectedWidth,
      height: workArea.height,
    }, metrics.frameInsets),
    toolBounds: applyFrameInsets({
      left: workArea.left + inspectedWidth,
      top: workArea.top,
      width: toolWidth,
      height: workArea.height,
    }, metrics.frameInsets),
  };
}

export function computeSelectorAuthoringInitialBrowserBounds(metrics: SelectorAuthoringScreenMetrics, inspectedWidthRatio = kSelectorAuthoringInspectedWidthRatio): SelectorAuthoringRect {
  return computeSelectorAuthoringDockLayout(metrics, inspectedWidthRatio).inspectedBounds;
}

function normalizeScaleFactor(devicePixelRatio: number | undefined): number {
  if (typeof devicePixelRatio !== 'number' || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0)
    return 1;
  return devicePixelRatio;
}

function computeFrameInsets(payload: SelectorAuthoringScreenPayload, workArea: SelectorAuthoringRect, scaleFactor: number): SelectorAuthoringInsets {
  const visualBounds = normalizeOptionalRect(payload.visualLeft, payload.visualTop, payload.visualWidth, payload.visualHeight);
  const nativeBounds = normalizeOptionalRect(payload.nativeLeft, payload.nativeTop, payload.nativeWidth, payload.nativeHeight);
  if (!visualBounds || !nativeBounds)
    return zeroInsets();

  const rawInsets = {
    left: Math.max(0, visualBounds.left - nativeBounds.left),
    top: Math.max(0, visualBounds.top - nativeBounds.top),
    right: Math.max(0, rectRight(nativeBounds) - rectRight(visualBounds)),
    bottom: Math.max(0, rectBottom(nativeBounds) - rectBottom(visualBounds)),
  };

  const maxHorizontalInset = Math.max(4, Math.round(Math.min(workArea.width * 0.03, 24 * scaleFactor)));
  const maxVerticalInset = Math.max(4, Math.round(Math.min(workArea.height * 0.03, 24 * scaleFactor)));
  return {
    left: Math.min(rawInsets.left, maxHorizontalInset),
    top: Math.min(rawInsets.top, maxVerticalInset),
    right: Math.min(rawInsets.right, maxHorizontalInset),
    bottom: Math.min(rawInsets.bottom, maxVerticalInset),
  };
}

function applyFrameInsets(bounds: SelectorAuthoringRect, frameInsets: SelectorAuthoringInsets): SelectorAuthoringRect {
  return {
    left: bounds.left - frameInsets.left,
    top: bounds.top - frameInsets.top,
    width: bounds.width + frameInsets.left + frameInsets.right,
    height: bounds.height + frameInsets.top + frameInsets.bottom,
  };
}

function normalizeOptionalRect(left?: number, top?: number, width?: number, height?: number): SelectorAuthoringRect | null {
  if (![left, top, width, height].every(value => typeof value === 'number' && Number.isFinite(value)))
    return null;
  if ((width as number) <= 0 || (height as number) <= 0)
    return null;
  return {
    left: Math.round(left as number),
    top: Math.round(top as number),
    width: Math.round(width as number),
    height: Math.round(height as number),
  };
}

function rectRight(rect: SelectorAuthoringRect): number {
  return rect.left + rect.width;
}

function rectBottom(rect: SelectorAuthoringRect): number {
  return rect.top + rect.height;
}

function zeroInsets(): SelectorAuthoringInsets {
  return {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  };
}
