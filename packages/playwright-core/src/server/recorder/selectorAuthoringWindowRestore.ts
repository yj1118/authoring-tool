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

import readline from 'readline';
import { spawn } from 'child_process';
import path from 'path';
import { resolveAuthoringModeConfig, type AuthoringMode } from './authoringMode';

type CompanionResponse = {
  ok?: boolean;
  error?: string;
};

const kCompanionPathEnv = 'TEST_BOT_WINDOWS_TOPMOST_COMPANION_PATH';
const kLegacyCompanionScriptEnv = 'TEST_BOT_WINDOWS_TOPMOST_COMPANION_SCRIPT';

export async function tryEnsureExistingAuthoringToolWindowVisible(mode: AuthoringMode): Promise<boolean> {
  if (process.platform !== 'win32')
    return false;
  const config = resolveAuthoringModeConfig(mode);

  const companionPath = process.env[kCompanionPathEnv]?.trim() || process.env[kLegacyCompanionScriptEnv]?.trim();
  if (!companionPath)
    return false;

  const isPowerShell = path.extname(companionPath).toLowerCase() === '.ps1';
  const child = spawn(
      isPowerShell ? 'powershell.exe' : companionPath,
      isPowerShell ? [
        '-NoLogo',
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', companionPath,
      ] : [],
      {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      }
  );

  return await new Promise<boolean>(resolveRestore => {
    let settled = false;

    const finish = (result: boolean) => {
      if (settled)
        return;
      settled = true;
      child.kill();
      resolveRestore(result);
    };

    child.once('error', () => finish(false));

    const stdout = readline.createInterface({ input: child.stdout });
    stdout.once('line', line => {
      stdout.close();
      try {
        const response = JSON.parse(line) as CompanionResponse;
        finish(!!response.ok);
      } catch {
        finish(false);
      }
    });

    child.once('spawn', () => {
      child.stdin.write(`${JSON.stringify({
        requestId: 1,
        kind: 'ensureWindowByTitlePrefixVisible',
        sessionId: `${config.sessionIdPrefix}-restore`,
        toolTitlePrefix: config.toolTitlePrefix,
      })}\n`);
      child.stdin.end();
    });
  });
}

export async function tryEnsureExistingSelectorAuthoringToolWindowVisible(): Promise<boolean> {
  return tryEnsureExistingAuthoringToolWindowVisible('selector');
}
