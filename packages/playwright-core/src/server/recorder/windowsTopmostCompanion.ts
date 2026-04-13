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

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { spawn } from 'child_process';

import { BrowserContext } from '../browserContext';

import type { Page } from '../page';
import type { ChildProcessWithoutNullStreams } from 'child_process';

type CompanionCommand =
  | {
    kind: 'attachSession';
    sessionId: string;
    toolPid: number;
    toolTitlePrefix: string;
  }
  | {
    kind: 'activateWindowByTitlePrefix';
    sessionId: string;
    titlePrefix: string;
  }
  | {
    kind: 'restoreToolWindow';
    sessionId: string;
  }
  | {
    kind: 'setToolTopmost';
    sessionId: string;
    enabled: boolean;
  }
  | {
    kind: 'restoreAndRelease';
    sessionId: string;
  }
  | {
    kind: 'release';
    sessionId: string;
  };

type CompanionResponse = {
  ok: boolean;
  requestId?: number;
  kind?: string;
  error?: string;
};

const kCompanionPathEnv = 'TEST_BOT_WINDOWS_TOPMOST_COMPANION_PATH';
const kLegacyCompanionScriptEnv = 'TEST_BOT_WINDOWS_TOPMOST_COMPANION_SCRIPT';
const kSelectorAuthoringToolTitlePrefix = 'Selector Authoring Tool';
const kAttachRetryCount = 5;
const kAttachRetryDelayMs = 150;

export type WindowsTopmostCompanionAttachResult = {
  companion: WindowsTopmostCompanion | null;
  error?: Error;
};

export class WindowsTopmostCompanion {
  private readonly _sessionId: string;
  private readonly _companionPath: string;
  private readonly _child: ChildProcessWithoutNullStreams;
  private readonly _spawnedPromise: Promise<void>;
  private readonly _pending = new Map<number, { resolve: () => void, reject: (error: Error) => void }>();
  private readonly _stderr: string[] = [];
  private _nextRequestId = 0;
  private _disposed = false;

  private constructor(companionPath: string, sessionId: string) {
    this._companionPath = companionPath;
    this._sessionId = sessionId;
    const { command, args } = resolveCompanionLaunch(companionPath);
    this._child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this._spawnedPromise = new Promise<void>((resolve, reject) => {
      this._child.once('spawn', () => resolve());
      this._child.once('error', error => reject(error));
    });

    const stdout = readline.createInterface({ input: this._child.stdout });
    stdout.on('line', line => this._handleStdoutLine(line));

    this._child.stderr.on('data', chunk => {
      const text = chunk.toString().trim();
      if (text)
        this._stderr.push(text);
    });

    this._child.once('exit', () => {
      const error = new Error(this._formatExitError());
      for (const { reject } of this._pending.values())
        reject(error);
      this._pending.clear();
      this._disposed = true;
    });
  }

  static async attachIfNeeded(inspectedContext: BrowserContext, toolPage: Page): Promise<WindowsTopmostCompanionAttachResult> {
    const companionPath = process.env[kCompanionPathEnv]?.trim() || process.env[kLegacyCompanionScriptEnv]?.trim();
    if (process.platform !== 'win32' || !companionPath || !fs.existsSync(companionPath))
      return { companion: null };

    const toolPid = toolPage.browserContext._browser.options.browserProcess.process?.pid;
    if (!toolPid)
      return { companion: null, error: new Error('Windows topmost companion could not attach because toolPid is missing') };

    const companion = new WindowsTopmostCompanion(companionPath, `selector-authoring-${inspectedContext.guid}`);
    try {
      await companion._waitForSpawn();
      await companion._attachSession(toolPid);
      await companion._send({
        kind: 'setToolTopmost',
        sessionId: companion._sessionId,
        enabled: true,
      });
      return { companion };
    } catch (error) {
      await companion.dispose();
      return {
        companion: null,
        error: new Error([
          'Windows topmost companion attach failed.',
          `path=${companionPath}`,
          `toolPid=${toolPid}`,
          `cause=${error instanceof Error ? error.message : String(error)}`,
        ].join(' ')),
      };
    }
  }

  async restoreAndRelease(): Promise<void> {
    if (this._disposed)
      return;
    try {
      await this._send({
        kind: 'restoreAndRelease',
        sessionId: this._sessionId,
      });
    } catch {
    }
    await this.dispose();
  }

  async restoreToolWindow(): Promise<void> {
    if (this._disposed)
      return;
    await this._send({
      kind: 'restoreToolWindow',
      sessionId: this._sessionId,
    });
  }

  async activateWindowByTitlePrefix(titlePrefix: string): Promise<void> {
    if (this._disposed || !titlePrefix.trim())
      return;
    await this._send({
      kind: 'activateWindowByTitlePrefix',
      sessionId: this._sessionId,
      titlePrefix,
    });
  }

  async dispose(): Promise<void> {
    if (this._disposed)
      return;
    this._disposed = true;
    this._child.stdin.end();
    if (!this._child.killed)
      this._child.kill();
    this._pending.clear();
  }

  private async _waitForSpawn(): Promise<void> {
    await this._spawnedPromise;
  }

  private async _attachSession(toolPid: number): Promise<void> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < kAttachRetryCount; ++attempt) {
      try {
        await this._send({
          kind: 'attachSession',
          sessionId: this._sessionId,
          toolPid,
          toolTitlePrefix: kSelectorAuthoringToolTitlePrefix,
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === kAttachRetryCount - 1)
          break;
        await new Promise(resolve => setTimeout(resolve, kAttachRetryDelayMs));
      }
    }
    throw lastError ?? new Error('Windows topmost companion attach failed');
  }

  private async _send(command: CompanionCommand): Promise<void> {
    if (this._disposed)
      throw new Error('Windows topmost companion is not available');

    const requestId = ++this._nextRequestId;
    const payload = JSON.stringify({ ...command, requestId });
    await new Promise<void>((resolve, reject) => {
      this._pending.set(requestId, { resolve, reject });
      this._child.stdin.write(`${payload}\n`, error => {
        if (error) {
          this._pending.delete(requestId);
          reject(error);
        }
      });
    });
  }

  private _handleStdoutLine(line: string) {
    if (!line.trim())
      return;
    let response: CompanionResponse;
    try {
      response = JSON.parse(line) as CompanionResponse;
    } catch {
      return;
    }

    if (typeof response.requestId !== 'number')
      return;
    const pending = this._pending.get(response.requestId);
    if (!pending)
      return;
    this._pending.delete(response.requestId);

    if (response.ok) {
      pending.resolve();
      return;
    }

    pending.reject(new Error(response.error || 'Windows topmost companion command failed'));
  }

  private _formatExitError(): string {
    const stderr = this._stderr.join('\n').trim();
    return stderr
      ? `Windows topmost companion exited unexpectedly: ${stderr}`
      : 'Windows topmost companion exited unexpectedly';
  }
}

function resolveCompanionLaunch(companionPath: string): { command: string, args: string[] } {
  const extension = path.extname(companionPath).toLowerCase();
  if (extension === '.exe')
    return { command: companionPath, args: [] };
  return {
    command: 'powershell.exe',
    args: [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      companionPath,
    ],
  };
}

