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

import net from 'net';
import readline from 'readline';

import { makeSocketPath } from '../utils/fileUtils';
import { resolveAuthoringModeConfig, type AuthoringMode } from './authoringMode';

type ActivationRequest = {
  kind: 'activate';
};

type ActivationResponse = {
  ok: boolean;
  error?: string;
};

const kActivationTimeoutMs = 1500;

export async function tryActivateExistingAuthoringInstance(mode: AuthoringMode): Promise<boolean> {
  const config = resolveAuthoringModeConfig(mode);
  const singletonPath = makeSocketPath(config.singletonDomain, config.singletonName);
  return await new Promise<boolean>(resolve => {
    const socket = net.createConnection(singletonPath);
    let settled = false;

    const finish = (result: boolean) => {
      if (settled)
        return;
      settled = true;
      resolve(result);
    };

    socket.once('error', () => {
      socket.destroy();
      finish(false);
    });

    socket.once('connect', () => {
      const stdout = readline.createInterface({ input: socket });
      const timeout = setTimeout(() => {
        stdout.close();
        socket.destroy();
        finish(false);
      }, kActivationTimeoutMs);

      stdout.once('line', line => {
        clearTimeout(timeout);
        stdout.close();
        socket.end();
        try {
          const response = JSON.parse(line) as ActivationResponse;
          finish(!!response.ok);
        } catch {
          finish(false);
        }
      });

      const request: ActivationRequest = { kind: 'activate' };
      socket.write(`${JSON.stringify(request)}\n`);
    });
  });
}

export async function tryActivateExistingSelectorAuthoringInstance(): Promise<boolean> {
  return tryActivateExistingAuthoringInstance('selector');
}

export class AuthoringSingleton {
  private readonly _server: net.Server;
  private readonly _singletonPath: string;

  private constructor(mode: AuthoringMode, private readonly _onActivate: () => Promise<void>) {
    const config = resolveAuthoringModeConfig(mode);
    this._singletonPath = makeSocketPath(config.singletonDomain, config.singletonName);
    this._server = net.createServer(socket => {
      void this._handleConnection(socket);
    });
  }

  static async start(mode: AuthoringMode, onActivate: () => Promise<void>): Promise<AuthoringSingleton> {
    const singleton = new AuthoringSingleton(mode, onActivate);
    await singleton._listen();
    return singleton;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this._server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async _listen(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this._server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        this._server.off('error', onError);
        resolve();
      };
      this._server.once('error', onError);
      this._server.once('listening', onListening);
      this._server.listen(this._singletonPath);
    });
  }

  private async _handleConnection(socket: net.Socket): Promise<void> {
    const input = readline.createInterface({ input: socket });
    input.once('line', async line => {
      let response: ActivationResponse;
      try {
        const request = JSON.parse(line) as ActivationRequest;
        if (request.kind !== 'activate')
          throw new Error(`Unsupported authoring singleton command: ${request.kind}`);
        await this._onActivate();
        response = { ok: true };
      } catch (error) {
        response = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      socket.write(`${JSON.stringify(response)}\n`, () => {
        input.close();
        socket.end();
      });
    });
  }
}

export class SelectorAuthoringSingleton {
  private constructor(private readonly _inner: AuthoringSingleton) {
  }

  static async start(onActivate: () => Promise<void>): Promise<SelectorAuthoringSingleton> {
    return new SelectorAuthoringSingleton(await AuthoringSingleton.start('selector', onActivate));
  }

  async close(): Promise<void> {
    await this._inner.close();
  }
}
