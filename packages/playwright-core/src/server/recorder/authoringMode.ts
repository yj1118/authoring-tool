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

export type AuthoringMode = 'selector' | 'recorder';

export type AuthoringModeConfig = {
  mode: AuthoringMode;
  singletonDomain: string;
  singletonName: string;
  sessionIdPrefix: string;
  toolTitlePrefix: string;
  dockWindows: boolean;
};

const authoringModeConfigs: Record<AuthoringMode, AuthoringModeConfig> = {
  selector: {
    mode: 'selector',
    singletonDomain: 'selector-authoring',
    singletonName: 'singleton',
    sessionIdPrefix: 'selector-authoring',
    toolTitlePrefix: 'Selector Authoring Tool',
    dockWindows: true,
  },
  recorder: {
    mode: 'recorder',
    singletonDomain: 'recorder-authoring',
    singletonName: 'singleton',
    sessionIdPrefix: 'recorder-authoring',
    toolTitlePrefix: 'Recorder Authoring Tool',
    dockWindows: true,
  },
};

export function normalizeAuthoringMode(input: string | null | undefined): AuthoringMode | null {
  const normalized = (input || '').trim().toLowerCase();
  if (normalized === 'selector' || normalized === 'recorder')
    return normalized;
  return null;
}

export function resolveAuthoringModeConfig(mode: AuthoringMode): AuthoringModeConfig {
  return authoringModeConfigs[mode];
}

export function resolveAuthoringModeConfigFromEnv(): AuthoringModeConfig | null {
  const explicitMode = normalizeAuthoringMode(process.env.AUTHORING_TOOL_MODE);
  if (explicitMode)
    return resolveAuthoringModeConfig(explicitMode);
  if (process.env.AUTHORING_TOOL_SELECTOR_ENABLED === '1')
    return resolveAuthoringModeConfig('selector');
  return null;
}

export function resolveAuthoringLocaleFromEnv(): string | undefined {
  return process.env.AUTHORING_TOOL_UI_LOCALE;
}
