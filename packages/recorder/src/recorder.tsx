/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { CallLog, Mode, Source } from './recorderTypes';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import { Toolbar } from '@web/components/toolbar';
import { emptySource } from '@web/components/sourceChooser';
import { ToolbarButton } from '@web/components/toolbarButton';
import * as React from 'react';
import './recorder.css';
import { asLocator } from '@isomorphic/locatorGenerators';
import { copySelectorAndSubmitAuthoringResult } from './selectorAuthoring';

import type { RecorderBackend, RecorderFrontend } from './recorderTypes';

export const Recorder: React.FC = ({}) => {
  const [sources, setSources] = React.useState<Source[]>([]);
  const [mode, setMode] = React.useState<Mode>('none');
  const [selectedFileId, setSelectedFileId] = React.useState<string | undefined>();
  const backend = React.useMemo(createRecorderBackend, []);
  const [locator, setLocator] = React.useState('');
  const [rawSelector, setRawSelector] = React.useState<string | undefined>();
  const [pageUrl, setPageUrl] = React.useState<string | undefined>();
  const [copyFeedbackVisible, setCopyFeedbackVisible] = React.useState(false);

  const source = React.useMemo(() => {
    const source = sources.find(s => s.id === selectedFileId);
    return source ?? emptySource();
  }, [sources, selectedFileId]);

  React.useEffect(() => {
    if (!copyFeedbackVisible)
      return;
    const timeout = window.setTimeout(() => setCopyFeedbackVisible(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copyFeedbackVisible]);

  React.useEffect(() => {
    setCopyFeedbackVisible(false);
  }, [locator]);

  React.useLayoutEffect(() => {
    const dispatcher: RecorderFrontend = {
      modeChanged: ({ mode }) => setMode(mode),
      sourcesUpdated: ({ sources }) => {
        setSources(sources);
        setSelectedFileId(current => current ?? sources[0]?.id);
        window.playwrightSourcesEchoForTest = sources;
      },
      pageNavigated: ({ url }) => {
        setPageUrl(url);
        document.title = url
          ? `Selector Authoring Tool - ${url}`
          : `Selector Authoring Tool`;
      },
      pauseStateChanged: () => {},
      callLogsUpdated: (_params: { callLogs: CallLog[] }) => {},
      sourceRevealRequested: ({ sourceId }) => setSelectedFileId(sourceId),
      elementPicked: ({ elementInfo }) => {
        const language = source.language;
        setRawSelector(elementInfo.selector);
        setLocator(asLocator(language, elementInfo.selector));
        if (mode === 'inspecting' || mode === 'recording-inspecting')
          backend.setMode({ mode: 'standby' }).catch(() => { });
      },
    };
    window.dispatch = (data: { method: string; params?: any }) => {
      (dispatcher as any)[data.method].call(dispatcher, data.params);
    };
  }, [backend, mode, source]);

  const onEditorChange = React.useCallback((selector: string) => {
    if (mode === 'none' || mode === 'inspecting' || mode === 'recording-inspecting')
      backend.setMode({ mode: 'standby' });
    setRawSelector(undefined);
    setLocator(selector);
    backend.highlightRequested({ selector });
  }, [mode, backend]);

  const isPicking = mode === 'inspecting' || mode === 'recording-inspecting';
  const canChangeFormat = sources.length > 1;
  const onCopy = React.useCallback(() => {
    const clipboard = copySelectorAndSubmitAuthoringResult({
      backend,
      selector: locator,
      strategy: selectedFileId,
      url: pageUrl,
    });
    setCopyFeedbackVisible(clipboard.ok);
  }, [backend, locator, pageUrl, selectedFileId]);
  const onClear = React.useCallback(() => {
    setLocator('');
    setRawSelector(undefined);
    setCopyFeedbackVisible(false);
    backend.highlightRequested({});
  }, [backend]);
  const onFormatChange = React.useCallback((fileId: string) => {
    setSelectedFileId(fileId);
    backend.fileChanged({ fileId });
    const nextSource = sources.find(candidate => candidate.id === fileId);
    if (nextSource && rawSelector)
      setLocator(asLocator(nextSource.language, rawSelector));
  }, [backend, rawSelector, sources]);

  return <div className='recorder'>
    <Toolbar>
      <ToolbarButton icon='inspect' title={isPicking ? 'Stop picking' : 'Pick selector'} toggled={isPicking} onClick={() => {
        backend.setMode({ mode: isPicking ? 'standby' : 'inspecting' }).catch(() => { });
      }}>{isPicking ? 'Stop picking' : 'Pick selector'}</ToolbarButton>
      <ToolbarButton icon='files' title='Copy selector' disabled={!locator} onClick={onCopy}>
        {copyFeedbackVisible ? 'Copied' : 'Copy selector'}
      </ToolbarButton>
      <ToolbarButton icon='clear-all' title='Clear selector' disabled={!locator} onClick={onClear}>Clear</ToolbarButton>
      <div style={{ flex: 'auto' }}></div>
      <div className='selector-authoring-status'>
        {isPicking ? 'Picking…' : 'Ready'}
      </div>
    </Toolbar>
    <div className='selector-authoring-main'>
      <div className='selector-authoring-header'>
        <div className='selector-authoring-copy'>
          <div className='selector-authoring-title'>Selector</div>
          <div className='selector-authoring-subtitle'>Pick an element in the page, optionally refine the locator, then copy it.</div>
        </div>
        <div className='selector-authoring-meta'>
          {canChangeFormat ? (
            <label className='selector-authoring-format'>
              <span>Format</span>
              <select value={selectedFileId} onChange={event => onFormatChange(event.target.value)}>
                {sources.map(candidate => <option key={candidate.id} value={candidate.id}>{formatSourceLabel(candidate.label)}</option>)}
              </select>
            </label>
          ) : null}
          {pageUrl ? <div className='selector-authoring-page' title={pageUrl}>{pageUrl}</div> : null}
        </div>
      </div>
      <div className='selector-authoring-editor'>
        <CodeMirrorWrapper text={locator} placeholder='Click Pick selector, then choose an element in the page' highlighter={source.language} focusOnChange={true} onChange={onEditorChange} wrapLines={true} />
      </div>
    </div>
  </div>;
};

function createRecorderBackend(): RecorderBackend {
  return new Proxy({} as RecorderBackend, {
    get: (_target, prop: string | symbol) => {
      if (typeof prop !== 'string')
        return undefined;
      return (params?: any) => {
        return window.sendCommand({ method: prop, params });
      };
    },
  });
}

function formatSourceLabel(label: string): string {
  return label.replace(/.*[/\\]([^/\\]+)/, '$1');
}
