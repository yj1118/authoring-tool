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
  screenWidth?: number;
  screenHeight?: number;
};

export type SelectorAuthoringScreenMetrics = {
  workArea: SelectorAuthoringRect;
  scaleFactor: number;
  physicalWorkArea: {
    width: number;
    height: number;
  };
  screen: {
    width: number;
    height: number;
  };
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
    physicalWorkArea: {
      width: Math.max(1, Math.round(workArea.width * scaleFactor)),
      height: Math.max(1, Math.round(workArea.height * scaleFactor)),
    },
    screen: {
      width: Math.max(workArea.width, Math.round(payload.screenWidth ?? workArea.width)),
      height: Math.max(workArea.height, Math.round(payload.screenHeight ?? workArea.height)),
    },
  };
}

export function computeSelectorAuthoringDockLayout(metrics: SelectorAuthoringScreenMetrics, inspectedWidthRatio = kSelectorAuthoringInspectedWidthRatio): SelectorAuthoringDockLayout {
  const workArea = metrics.workArea;
  const inspectedWidth = Math.max(1, Math.min(workArea.width - 1, Math.round(workArea.width * inspectedWidthRatio)));
  const toolWidth = Math.max(1, workArea.width - inspectedWidth);
  return {
    inspectedBounds: {
      left: workArea.left,
      top: workArea.top,
      width: inspectedWidth,
      height: workArea.height,
    },
    toolBounds: {
      left: workArea.left + inspectedWidth,
      top: workArea.top,
      width: toolWidth,
      height: workArea.height,
    },
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
