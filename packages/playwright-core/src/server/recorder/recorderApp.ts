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
import path from 'path';

import mime from 'mime';
import { isUnderTest } from '@utils/debug';
import { libPath } from '../../package';
import { syncLocalStorageWithSettings } from '../launchApp';
import { launchApp } from '../launchApp';
import { nullProgress, ProgressController } from '../progress';
import { ThrottledFile } from './throttledFile';
import { languageSet } from '../codegen/languages';
import { collapseActions, shouldMergeAction } from './recorderUtils';
import { generateCode } from '../codegen/language';
import { Recorder, RecorderEvent } from '../recorder';
import { BrowserContext } from '../browserContext';
import { CRPage } from '../chromium/crPage';
import { WindowsTopmostCompanion } from './windowsTopmostCompanion';
import { SelectorAuthoringSingleton } from './selectorAuthoringSingleton';

import type { Page } from '../page';
import type * as actions from '@recorder/actions';
import type { CallLog, ElementInfo, Mode, RecorderBackend, RecorderFrontend, RecorderLocale, Source } from '@recorder/recorderTypes';
import type { Language, LanguageGeneratorOptions } from '../codegen/types';
import type * as channels from '@protocol/channels';
import type { Progress } from '../progress';
import type { AriaTemplateNode } from '@isomorphic/ariaSnapshot';

export type RecorderAppParams = channels.BrowserContextEnableRecorderParams & {
  browserName: string;
  sdkLanguage: Language;
  headed: boolean;
  executablePath?: string;
  channel?: string;
};

export class RecorderApp {
  private _recorder: Recorder;
  private _page: Page;
  readonly wsEndpointForTest: string | undefined;
  private _languageGeneratorOptions: LanguageGeneratorOptions;
  private _throttledOutputFile: ThrottledFile | null = null;
  private _actions: actions.ActionInContext[] = [];
  private _userSources: Source[] = [];
  private _recorderSources: Source[] = [];
  private _primaryGeneratorId: string;
  private _selectedGeneratorId: string;
  private _frontend: RecorderFrontend;
  private _windowsTopmostCompanion: WindowsTopmostCompanion | null = null;
  private _selectorAuthoringSingleton: SelectorAuthoringSingleton | null = null;
  private _inspectedContext: BrowserContext | null = null;

  private constructor(recorder: Recorder, params: RecorderAppParams, page: Page, wsEndpointForTest: string | undefined) {
    this._page = page;
    this._recorder = recorder;
    this._frontend = createRecorderFrontend(page);
    this.wsEndpointForTest = wsEndpointForTest;

    // Make a copy of options to modify them later.
    this._languageGeneratorOptions = {
      browserName: params.browserName,
      launchOptions: { headless: false, ...params.launchOptions, tracesDir: undefined },
      contextOptions: { ...params.contextOptions },
      deviceName: params.device,
      saveStorage: params.saveStorage,
    };

    this._throttledOutputFile = params.outputFile ? new ThrottledFile(params.outputFile) : null;
    this._primaryGeneratorId = process.env.TEST_INSPECTOR_LANGUAGE || params.language || determinePrimaryGeneratorId(params.sdkLanguage);
    this._selectedGeneratorId = this._primaryGeneratorId;
    for (const languageGenerator of languageSet()) {
      if (languageGenerator.id === this._primaryGeneratorId)
        this._recorder.setLanguage(languageGenerator.highlighter);
    }
  }

  private async _init(inspectedContext: BrowserContext) {
    this._inspectedContext = inspectedContext;
    await syncLocalStorageWithSettings(this._page, 'recorder');

    const controller = new ProgressController();
    await controller.run(async progress => {
      await this._page.addRequestInterceptor(progress, route => {
        if (!route.request().url().startsWith('https://playwright/')) {
          route.continue({ isFallback: true }).catch(() => {});
          return;
        }

        const uri = route.request().url().substring('https://playwright/'.length);
        const file = path.join(libPath('vite', 'recorder'), uri);
        fs.promises.readFile(file).then(buffer => {
          route.fulfill({
            status: 200,
            headers: [
              { name: 'Content-Type', value: mime.getType(path.extname(file)) || 'application/octet-stream' }
            ],
            body: buffer.toString('base64'),
            isBase64: true
          }).catch(() => {});
        });
      });

      await this._createDispatcher(progress, inspectedContext);

      this._page.once('close', () => {
        void this._releaseSelectorAuthoringSingleton();
        void this._releaseWindowsTopmostCompanion();
        this._recorder.close();
        inspectedContext.close(nullProgress, { reason: 'Selector authoring window closed' }).catch(() => {});
        this._page.browserContext.close(nullProgress, { reason: 'Recorder window closed' }).catch(() => {});
        delete (inspectedContext as any)[recorderAppSymbol];
      });

      await this._page.mainFrame().goto(progress, 'https://playwright/index.html');
    });

    const url = this._recorder.url();
    this._frontend.localeChanged({
      locale: await resolveSelectorAuthoringLocale(
        process.env.TEST_BOT_SELECTOR_AUTHORING_UI_LOCALE,
        inspectedContext,
        this._languageGeneratorOptions.contextOptions.locale,
      ),
    });
    if (url)
      this._frontend.pageNavigated({ url });
    this._frontend.modeChanged({ mode: this._recorder.mode() });
    this._frontend.pauseStateChanged({ paused: this._recorder.paused() });
    this._updateActions('reveal');
    // Update paused sources *after* generated ones, to reveal the currently paused source if any.
    this._onUserSourcesChanged(this._recorder.userSources(), this._recorder.pausedSourceId());
    this._frontend.callLogsUpdated({ callLogs: this._recorder.callLog() });
    this._wireListeners(this._recorder);
  }

  private async _createDispatcher(progress: Progress, inspectedContext: BrowserContext) {
    const dispatcher: RecorderBackend = {
      clear: async () => {
        this._actions = [];
        this._updateActions('reveal');
        this._recorder.clear();
      },
      fileChanged: async (params: { fileId: string }) => {
        const source = [...this._recorderSources, ...this._userSources].find(s => s.id === params.fileId);
        if (source) {
          if (source.isRecorded)
            this._selectedGeneratorId = source.id;
          await this._recorder.setLanguage(source.language);
        }
      },
      setAutoExpect: async (params: { autoExpect: boolean }) => {
        this._languageGeneratorOptions.generateAutoExpect = params.autoExpect;
        this._updateActions();
      },
      setMode: async (params: { mode: Mode }) => {
        await this._recorder.setMode(params.mode);
      },
      resume: async () => {
        this._recorder.resume();
      },
      pause: async () => {
        this._recorder.pause();
      },
      step: async () => {
        this._recorder.step();
      },
      highlightRequested: async (params: { selector?: string; ariaTemplate?: AriaTemplateNode }) => {
        if (params.selector)
          await this._recorder.setHighlightedSelector(params.selector);
        if (params.ariaTemplate)
          await this._recorder.setHighlightedAriaTemplate(params.ariaTemplate);
      },
      closeSelectorAuthoringSession: async () => {
        await inspectedContext.close(nullProgress, { reason: 'Selector authoring finished from tool window' });
      },
    };

    await this._page.exposeBinding(progress, 'sendCommand', false, async (_, data: any) => {
      const { method, params } = data as { method: string; params: any };
      return await (dispatcher as any)[method].call(dispatcher, params);
    });
  }

  static async show(context: BrowserContext, params: channels.BrowserContextEnableRecorderParams) {
    const recorder = await Recorder.forContext(context, params);
    if (process.env.PW_CODEGEN_NO_INSPECTOR || params.hideInspector)
      return;
    if (params.recorderMode === 'api') {
      const browserName = context._browser.options.name;
      await ProgrammaticRecorderApp.run(context, recorder, browserName, params);
      return;
    }
    await RecorderApp._show(recorder, context, params);
  }

  async close() {
    await this._releaseSelectorAuthoringSingleton();
    await this._releaseWindowsTopmostCompanion();
    await this._page.close(nullProgress);
  }

  static showInspectorNoReply(context: BrowserContext) {
    if (process.env.PW_CODEGEN_NO_INSPECTOR)
      return;
    void Recorder.forContext(context, {}).then(recorder => RecorderApp._show(recorder, context, {})).catch(() => {});
  }

  private static async _show(recorder: Recorder, inspectedContext: BrowserContext, params: channels.BrowserContextEnableRecorderParams) {
    if ((inspectedContext as any)[recorderAppSymbol])
      return;
    (inspectedContext as any)[recorderAppSymbol] = true;
    const sdkLanguage = inspectedContext._browser.sdkLanguage();
    const isChromium = inspectedContext._browser.options.browserType === 'chromium';
    const headed = !!inspectedContext._browser.options.headful;
    const { createPlaywright } = require('../playwright') as typeof import('../playwright');
    const recorderPlaywright = createPlaywright({ sdkLanguage: 'javascript', isInternalPlaywright: true });
    const { context: appContext, page } = await launchApp(recorderPlaywright.chromium, {
      sdkLanguage,
      windowSize: { width: 580, height: 760 },
      windowPosition: { x: 1020, y: 10 },
      persistentContextOptions: {
        noDefaultViewport: true,
        headless: !!process.env.PWTEST_CLI_HEADLESS || (isUnderTest() && !headed),
        cdpPort: isUnderTest() ? 0 : undefined,
        handleSIGINT: params.handleSIGINT,
        args: [
          '--disable-translate',
          '--disable-features=Translate,TranslateUI',
        ],
        chromiumProfilePreferences: {
          translate: {
            enabled: false,
          },
        },
        executablePath: isChromium ? inspectedContext._browser.options.customExecutablePath : undefined,
        // Use the same channel as the inspected context to guarantee that the browser is installed.
        channel: isChromium ? inspectedContext._browser.options.channel : undefined,
      }
    });
    const controller = new ProgressController();
    await controller.run(async progress => {
      await appContext._browser._defaultContext!.loadDefaultContextAsIs(progress);
    });

    const appParams = {
      browserName: inspectedContext._browser.options.name,
      sdkLanguage: inspectedContext._browser.sdkLanguage(),
      wsEndpointForTest: inspectedContext._browser.options.wsEndpoint,
      headed: !!inspectedContext._browser.options.headful,
      executablePath: isChromium ? inspectedContext._browser.options.customExecutablePath : undefined,
      channel: isChromium ? inspectedContext._browser.options.channel : undefined,
      ...params,
    };

    const recorderApp = new RecorderApp(recorder, appParams, page, appContext._browser.options.wsEndpoint);
    await recorderApp._init(inspectedContext);
    if (params.hideToolbar) {
      recorderApp._selectorAuthoringSingleton = await SelectorAuthoringSingleton.start(async () => {
        await recorderApp.activate();
      }).catch(error => {
        console.warn(`[selector-authoring] Failed to start singleton server: ${error instanceof Error ? error.message : String(error)}`); // eslint-disable-line no-console
        return null;
      });
      await dockSelectorAuthoringWindows(inspectedContext, page);
      const attachResult = await WindowsTopmostCompanion.attachIfNeeded(inspectedContext, page);
      recorderApp._windowsTopmostCompanion = attachResult.companion;
      if (attachResult.error) {
        console.warn(`[selector-authoring] ${attachResult.error.message}`); // eslint-disable-line no-console
        recorderApp._frontend.selectorAuthoringDiagnosticChanged({
          diagnostic: {
            severity: 'warning',
            message: `Windows topmost companion was unavailable, so selector authoring is using the standard docked layout without always-on-top behavior. ${attachResult.error.message}`,
          },
        });
      }
    }
    (inspectedContext as any).recorderAppForTest = recorderApp;
  }

  private _wireListeners(recorder: Recorder) {
    recorder.on(RecorderEvent.ActionAdded, (action: actions.ActionInContext) => {
      this._onActionAdded(action);
    });

    recorder.on(RecorderEvent.SignalAdded, (signal: actions.SignalInContext) => {
      this._onSignalAdded(signal);
    });

    recorder.on(RecorderEvent.PageNavigated, (url: string) => {
      this._frontend.pageNavigated({ url });
    });

    recorder.on(RecorderEvent.ContextClosed, () => {
      void this._releaseSelectorAuthoringSingleton();
      void this._releaseWindowsTopmostCompanion();
      this._throttledOutputFile?.flush();
      this._page.browserContext.close(nullProgress, { reason: 'Recorder window closed' }).catch(() => {});
    });

    recorder.on(RecorderEvent.ModeChanged, (mode: Mode) => {
      this._frontend.modeChanged({ mode });
    });

    recorder.on(RecorderEvent.PausedStateChanged, (paused: boolean) => {
      this._frontend.pauseStateChanged({ paused });
    });

    recorder.on(RecorderEvent.UserSourcesChanged, (sources: Source[], pausedSourceId?: string) => {
      this._onUserSourcesChanged(sources, pausedSourceId);
    });

    recorder.on(RecorderEvent.ElementPicked, (elementInfo: ElementInfo, userGesture?: boolean) => {
      if (userGesture)
        this._page.bringToFront(nullProgress).catch(() => {});
      this._frontend.elementPicked({ elementInfo, userGesture });
    });

    recorder.on(RecorderEvent.CallLogsUpdated, (callLogs: CallLog[]) => {
      this._frontend.callLogsUpdated({ callLogs });
    });
  }

  private _onActionAdded(action: actions.ActionInContext) {
    this._actions.push(action);
    this._updateActions('reveal');
  }

  private _onSignalAdded(signal: actions.SignalInContext) {
    const lastAction = this._actions.findLast(a => a.frame.pageGuid === signal.frame.pageGuid);
    if (lastAction)
      lastAction.action.signals.push(signal.signal);
    this._updateActions();
  }

  private _onUserSourcesChanged(sources: Source[], pausedSourceId: string | undefined) {
    if (!sources.length && !this._userSources.length)
      return;
    this._userSources = sources;
    this._pushAllSources();
    this._revealSource(pausedSourceId);
  }

  private _pushAllSources() {
    const sources = [...this._userSources, ...this._recorderSources];
    this._frontend.sourcesUpdated({ sources });
  }

  private _revealSource(sourceId: string | undefined) {
    if (!sourceId)
      return;
    this._frontend.sourceRevealRequested({ sourceId });
  }

  private _updateActions(reveal?: 'reveal') {
    const recorderSources = [];
    const actions = collapseActions(this._actions);

    let revealSourceId: string | undefined;
    for (const languageGenerator of languageSet()) {
      const { header, footer, actionTexts, text } = generateCode(actions, languageGenerator, this._languageGeneratorOptions);
      const source: Source = {
        isRecorded: true,
        label: languageGenerator.name,
        group: languageGenerator.groupName,
        id: languageGenerator.id,
        text,
        header,
        footer,
        actions: actionTexts,
        language: languageGenerator.highlighter,
        highlight: []
      };
      source.revealLine = text.split('\n').length - 1;
      recorderSources.push(source);
      if (languageGenerator.id === this._primaryGeneratorId)
        this._throttledOutputFile?.setContent(source.text);
      if (reveal === 'reveal' && source.id === this._selectedGeneratorId)
        revealSourceId = source.id;
    }

    this._recorderSources = recorderSources;
    this._pushAllSources();
    this._revealSource(revealSourceId);
  }

  private async _releaseWindowsTopmostCompanion() {
    const companion = this._windowsTopmostCompanion;
    this._windowsTopmostCompanion = null;
    await companion?.restoreAndRelease();
  }

  private async _releaseSelectorAuthoringSingleton() {
    const singleton = this._selectorAuthoringSingleton;
    this._selectorAuthoringSingleton = null;
    await singleton?.close().catch(() => {});
  }

  async activate() {
    const inspectedPage = this._inspectedContext?.pages()[0];
    await restoreWindowIfMinimized(inspectedPage).catch(() => {});
    const browserTitle = await inspectedPage?.mainFrame().title(nullProgress).catch(() => '') || '';
    await this._windowsTopmostCompanion?.activateWindowByTitlePrefix(browserTitle).catch(() => {});
    await inspectedPage?.bringToFront(nullProgress).catch(() => {});
  }
}

// For example, if the SDK language is 'javascript', this returns 'playwright-test'.
function determinePrimaryGeneratorId(sdkLanguage: Language): string {
  for (const language of languageSet()) {
    if (language.highlighter === sdkLanguage)
      return language.id;
  }
  return sdkLanguage;
}

export class ProgrammaticRecorderApp {
  static async run(inspectedContext: BrowserContext, recorder: Recorder, browserName: string, params: channels.BrowserContextEnableRecorderParams) {
    let lastAction: actions.ActionInContext | null = null;
    const languages = [...languageSet()];

    const languageGeneratorOptions = {
      browserName: browserName,
      launchOptions: { headless: false, ...params.launchOptions, tracesDir: undefined },
      contextOptions: { ...params.contextOptions },
      deviceName: params.device,
      saveStorage: params.saveStorage,
    };
    const languageGenerator = languages.find(l => l.id === params.language) ?? languages.find(l => l.id === 'playwright-test')!;

    recorder.on(RecorderEvent.ActionAdded, action => {
      const page = findPageByGuid(inspectedContext, action.frame.pageGuid);
      if (!page)
        return;
      const { actionTexts } = generateCode([action], languageGenerator, languageGeneratorOptions);
      if (!lastAction || !shouldMergeAction(action, lastAction))
        inspectedContext.emit(BrowserContext.Events.RecorderEvent, { event: 'actionAdded', data: action, page, code: actionTexts.join('\n') });
      else
        inspectedContext.emit(BrowserContext.Events.RecorderEvent, { event: 'actionUpdated', data: action, page, code: actionTexts.join('\n') });
      lastAction = action;
    });
    recorder.on(RecorderEvent.SignalAdded, signal => {
      const page = findPageByGuid(inspectedContext, signal.frame.pageGuid);
      if (!page)
        return;
      inspectedContext.emit(BrowserContext.Events.RecorderEvent, { event: 'signalAdded', data: signal, page, code: '' });
    });
  }
}

function findPageByGuid(context: BrowserContext, guid: string) {
  return context.pages().find(p => p.guid === guid);
}

function createRecorderFrontend(page: Page): RecorderFrontend {
  return new Proxy({} as RecorderFrontend, {
    get: (_target, prop: string | symbol) => {
      if (typeof prop !== 'string')
        return undefined;
      return (params: any) => {
        page.mainFrame().evaluateExpression(nullProgress, ((event: { method: string, params?: any }) => {
          window.dispatch(event);
        }).toString(), { isFunction: true }, { method: prop, params }).catch(() => {});
      };
    },
  });
}

async function resolveSelectorAuthoringLocale(explicitLocale: string | undefined, inspectedContext: BrowserContext, fallbackLocale: string | undefined): Promise<RecorderLocale> {
  if ((explicitLocale || '').trim())
    return normalizeSelectorAuthoringLocale(explicitLocale);

  const inspectedPage = inspectedContext.pages()[0];
  if (!inspectedPage)
    return normalizeSelectorAuthoringLocale(fallbackLocale);

  const payload = await inspectedPage.mainFrame().evaluateExpression(nullProgress, String(() => {
    return {
      documentLanguage: document.documentElement.lang || '',
      navigatorLanguage: navigator.language || '',
    };
  }), { isFunction: true, world: 'utility' }).catch(() => null) as { documentLanguage?: string; navigatorLanguage?: string } | null;

  return normalizeSelectorAuthoringLocale(
    payload?.documentLanguage
    || payload?.navigatorLanguage
    || fallbackLocale
  );
}

function normalizeSelectorAuthoringLocale(input: string | null | undefined): RecorderLocale {
  const normalized = (input || '').trim().replaceAll('_', '-').toLowerCase();
  if (!normalized)
    return 'en';
  if (normalized === 'ja' || normalized.startsWith('ja-'))
    return 'ja-JP';
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-hans' || normalized.startsWith('zh-cn-') || normalized.startsWith('zh-hans') || normalized.startsWith('zh-sg'))
    return 'zh-CN';
  if (normalized === 'zh-tw' || normalized === 'zh-hk' || normalized === 'zh-hant' || normalized.startsWith('zh-tw-') || normalized.startsWith('zh-hk-') || normalized.startsWith('zh-hant'))
    return 'zh-TW';
  return 'en';
}

const recorderAppSymbol = Symbol('recorderApp');

type DockableWindowBounds = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

async function dockSelectorAuthoringWindows(inspectedContext: BrowserContext, toolPage: Page): Promise<void> {
  if (inspectedContext._browser.options.browserType !== 'chromium')
    return;

  const inspectedPage = inspectedContext.pages()[0];
  if (!inspectedPage)
    return;

  const inspectedBounds = await getWindowBounds(inspectedPage).catch(() => null);
  if (!inspectedBounds)
    return;

  const hostLeft = inspectedBounds.left ?? 0;
  const hostTop = inspectedBounds.top ?? 0;
  const hostWidth = clamp(inspectedBounds.width ?? 1280, 900, 2400);
  const hostHeight = clamp(inspectedBounds.height ?? 900, 600, 1600);

  const toolWidth = clamp(Math.round(hostWidth * 0.36), 580, 680);
  const inspectedWidth = Math.max(720, hostWidth - toolWidth);

  await Promise.all([
    setWindowBounds(inspectedPage, {
      left: hostLeft,
      top: hostTop,
      width: inspectedWidth,
      height: hostHeight,
    }),
    setWindowBounds(toolPage, {
      left: hostLeft + inspectedWidth,
      top: hostTop,
      width: toolWidth,
      height: hostHeight,
    }),
  ]).catch(() => {});

  await toolPage.bringToFront(nullProgress).catch(() => {});
  await inspectedPage.bringToFront(nullProgress).catch(() => {});
}

async function getWindowBounds(page: Page): Promise<DockableWindowBounds> {
  const client = chromiumWindowClient(page);
  const { bounds } = await client.send('Browser.getWindowForTarget');
  return bounds;
}

async function restoreWindowIfMinimized(page: Page | undefined): Promise<void> {
  if (!page)
    return;
  const client = chromiumWindowClient(page);
  const { windowId, bounds } = await client.send('Browser.getWindowForTarget');
  if (bounds.windowState !== 'minimized')
    return;
  await client.send('Browser.setWindowBounds', {
    windowId,
    bounds: {
      windowState: 'normal',
    },
  });
}

async function setWindowBounds(page: Page, bounds: DockableWindowBounds): Promise<void> {
  const client = chromiumWindowClient(page);
  const { windowId } = await client.send('Browser.getWindowForTarget');
  await client.send('Browser.setWindowBounds', {
    windowId,
    bounds,
  });
}

function chromiumWindowClient(page: Page) {
  return (page.delegate as CRPage)._mainFrameSession._client;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

