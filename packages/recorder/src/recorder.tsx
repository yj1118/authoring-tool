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
import { Toolbar } from '@web/components/toolbar';
import { emptySource } from '@web/components/sourceChooser';
import { ToolbarButton } from '@web/components/toolbarButton';
import * as React from 'react';
import './recorder.css';
import { asLocator } from '@isomorphic/locatorGenerators';
import { buildSelectorAuthoringResult, copySelectorToClipboard } from './selectorAuthoring';

import type { RecorderBackend, RecorderFrontend, SelectorAuthoringDiagnostic, SelectorAuthoringState } from './recorderTypes';

type SelectorEntry = {
  id: string;
  pageUrl?: string;
  rawSelector?: string;
  selector: string;
  selectedAt: string;
};

type SubmitState = 'idle' | 'submitting' | 'submitted' | 'error';

export const Recorder: React.FC = ({}) => {
  const [sources, setSources] = React.useState<Source[]>([]);
  const [mode, setMode] = React.useState<Mode>('none');
  const [selectedFileId, setSelectedFileId] = React.useState<string | undefined>();
  const backend = React.useMemo(createRecorderBackend, []);
  const [entries, setEntries] = React.useState<SelectorEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | undefined>();
  const [pageUrl, setPageUrl] = React.useState<string | undefined>();
  const [copiedEntryId, setCopiedEntryId] = React.useState<string | undefined>();
  const [selectorAuthoringState, setSelectorAuthoringState] = React.useState<SelectorAuthoringState>({ canSubmitResult: false });
  const [selectorAuthoringDiagnostic, setSelectorAuthoringDiagnostic] = React.useState<SelectorAuthoringDiagnostic | null>(null);
  const [submitState, setSubmitState] = React.useState<SubmitState>('idle');
  const [submitMessage, setSubmitMessage] = React.useState('');
  const nextEntryId = React.useRef(0);

  const source = React.useMemo(() => {
    const selectedSource = sources.find(s => s.id === selectedFileId);
    return selectedSource ?? emptySource();
  }, [sources, selectedFileId]);

  const selectedEntry = React.useMemo(() => entries.find(entry => entry.id === selectedEntryId), [entries, selectedEntryId]);

  React.useEffect(() => {
    if (!copiedEntryId)
      return;
    const timeout = window.setTimeout(() => setCopiedEntryId(undefined), 1500);
    return () => window.clearTimeout(timeout);
  }, [copiedEntryId]);

  React.useLayoutEffect(() => {
    const dispatcher: RecorderFrontend = {
      modeChanged: ({ mode }) => setMode(mode),
      selectorAuthoringStateChanged: state => setSelectorAuthoringState(state),
      selectorAuthoringDiagnosticChanged: ({ diagnostic }) => setSelectorAuthoringDiagnostic(diagnostic),
      sourcesUpdated: ({ sources }) => {
        setSources(sources);
        setSelectedFileId(current => current ?? sources[0]?.id);
        window.playwrightSourcesEchoForTest = sources;
      },
      pageNavigated: ({ url }) => {
        setPageUrl(url);
        document.title = url
          ? `Selector Authoring Tool - ${url}`
          : 'Selector Authoring Tool';
      },
      pauseStateChanged: () => {},
      callLogsUpdated: (_params: { callLogs: CallLog[] }) => {},
      sourceRevealRequested: ({ sourceId }) => setSelectedFileId(sourceId),
      elementPicked: ({ elementInfo }) => {
        const language = source.language;
        const selector = asLocator(language, elementInfo.selector);
        const entry: SelectorEntry = {
          id: `selector-${++nextEntryId.current}`,
          pageUrl,
          rawSelector: elementInfo.selector,
          selector,
          selectedAt: new Date().toISOString(),
        };
        setEntries(current => [...current, entry]);
        setSelectedEntryId(entry.id);
        setCopiedEntryId(undefined);
        setSubmitState('idle');
        setSubmitMessage('');
        if (mode === 'inspecting' || mode === 'recording-inspecting')
          backend.setMode({ mode: 'standby' }).catch(() => { });
      },
    };
    window.dispatch = (data: { method: string; params?: any }) => {
      (dispatcher as any)[data.method].call(dispatcher, data.params);
    };
  }, [backend, mode, pageUrl, source.language]);

  const isPicking = mode === 'inspecting' || mode === 'recording-inspecting';
  const selectEntry = React.useCallback((entryId: string) => {
    const entry = entries.find(candidate => candidate.id === entryId);
    setSelectedEntryId(entryId);
    setCopiedEntryId(undefined);
    setSubmitMessage('');
    setSubmitState(current => current === 'submitted' ? current : 'idle');
    void backend.highlightRequested(entry?.selector ? { selector: entry.selector } : {});
  }, [backend, entries]);

  const copyEntry = React.useCallback((entry: SelectorEntry | undefined) => {
    if (!entry)
      return;
    const clipboard = copySelectorToClipboard(entry.selector);
    if (clipboard.ok)
      setCopiedEntryId(entry.id);
  }, []);

  const removeEntry = React.useCallback((entryId: string) => {
    const nextEntries = entries.filter(entry => entry.id !== entryId);
    const nextSelectedEntryId = selectedEntryId === entryId ? nextEntries[nextEntries.length - 1]?.id : selectedEntryId;
    setEntries(nextEntries);
    setSelectedEntryId(nextSelectedEntryId);
    setCopiedEntryId(current => current === entryId ? undefined : current);
    setSubmitMessage('');
    setSubmitState(current => current === 'submitted' ? current : 'idle');
    const nextEntry = nextSelectedEntryId ? nextEntries.find(entry => entry.id === nextSelectedEntryId) : undefined;
    void backend.highlightRequested(nextEntry?.selector ? { selector: nextEntry.selector } : {});
  }, [backend, entries, selectedEntryId]);

  const clearEntries = React.useCallback(() => {
    setEntries([]);
    setSelectedEntryId(undefined);
    setCopiedEntryId(undefined);
    setSubmitMessage('');
    setSubmitState('idle');
    void backend.highlightRequested({});
  }, [backend]);

  const submitEntry = React.useCallback(async (entry: SelectorEntry | undefined) => {
    if (!entry || !selectorAuthoringState.canSubmitResult || submitState === 'submitting' || submitState === 'submitted')
      return;

    const clipboard = copySelectorToClipboard(entry.selector);
    if (clipboard.ok)
      setCopiedEntryId(entry.id);

    setSubmitState('submitting');
    setSubmitMessage('');

    try {
      const result = buildSelectorAuthoringResult(
          entry.selector,
          clipboard,
          selectedFileId,
          entry.pageUrl ?? pageUrl
      );
      await backend.submitSelectorAuthoringResult(result);
      setSubmitState('submitted');
      setSubmitMessage('Selected locator was sent back to the DSL field. You can keep collecting more selectors.');
    } catch (error) {
      setSubmitState('error');
      setSubmitMessage(error instanceof Error ? error.message : String(error));
    }
  }, [backend, pageUrl, selectedFileId, selectorAuthoringState.canSubmitResult, submitState]);

  const closeSession = React.useCallback(() => {
    backend.closeSelectorAuthoringSession().catch(() => { });
  }, [backend]);

  return <div className='recorder'>
    <Toolbar>
      <ToolbarButton icon='inspect' title={isPicking ? 'Stop picking' : 'Pick selector'} toggled={isPicking} onClick={() => {
        backend.setMode({ mode: isPicking ? 'standby' : 'inspecting' }).catch(() => { });
      }}>{isPicking ? 'Stop picking' : 'Pick selector'}</ToolbarButton>
      <ToolbarButton icon='files' title='Copy selected locator' disabled={!selectedEntry} onClick={() => copyEntry(selectedEntry)}>
        {selectedEntry && copiedEntryId === selectedEntry.id ? 'Copied' : 'Copy selected'}
      </ToolbarButton>
      {selectorAuthoringState.canSubmitResult ? (
        <ToolbarButton icon='check' title='Use selected locator in DSL' disabled={!selectedEntry || submitState === 'submitting' || submitState === 'submitted'} onClick={() => {
          void submitEntry(selectedEntry);
        }}>
          {submitState === 'submitting' ? 'Applying...' : submitState === 'submitted' ? 'Applied' : 'Use in DSL'}
        </ToolbarButton>
      ) : null}
      <ToolbarButton icon='close' title='Close selector authoring session' onClick={closeSession}>Done</ToolbarButton>
      <div style={{ flex: 'auto' }}></div>
      <div className='selector-authoring-status'>
        {isPicking ? 'Picking...' : submitState === 'submitted' ? 'Applied' : 'Ready'}
      </div>
    </Toolbar>
    <div className='selector-authoring-main'>
      {selectorAuthoringDiagnostic ? (
        <div className={`selector-authoring-message ${selectorAuthoringDiagnostic.severity}`}>
          {selectorAuthoringDiagnostic.message}
        </div>
      ) : null}

      <div className='selector-authoring-collection-header'>
        <div className='selector-authoring-section-title'>Saved candidates</div>
        <div className='selector-authoring-collection-actions'>
          <span className='selector-authoring-count'>{entries.length} saved</span>
          <button className='selector-authoring-text-button' disabled={!entries.length} onClick={clearEntries} type='button'>Clear all</button>
        </div>
      </div>

      <div className='selector-authoring-collection'>
        {entries.length ? entries.map((entry, index) => {
          const isSelected = entry.id === selectedEntryId;
          const copyLabel = copiedEntryId === entry.id ? 'Copied' : 'Copy';
          return (
            <div className={`selector-authoring-entry ${isSelected ? 'selected' : ''}`} key={entry.id}>
              <button className='selector-authoring-entry-main' onClick={() => selectEntry(entry.id)} type='button'>
                <div className='selector-authoring-entry-order'>{index + 1}</div>
                <div className='selector-authoring-entry-content'>
                  <div className='selector-authoring-entry-selector' title={entry.selector}>{entry.selector}</div>
                  <div className='selector-authoring-entry-meta'>
                    {entry.pageUrl ? <span className='selector-authoring-entry-url' title={entry.pageUrl}>{entry.pageUrl}</span> : null}
                    <span>{formatTimestamp(entry.selectedAt)}</span>
                  </div>
                </div>
              </button>
              <div className='selector-authoring-entry-actions'>
                <button className='selector-authoring-secondary-button' onClick={() => copyEntry(entry)} type='button'>{copyLabel}</button>
                {selectorAuthoringState.canSubmitResult ? (
                  <button className='selector-authoring-secondary-button' disabled={submitState === 'submitting' || submitState === 'submitted'} onClick={() => {
                    void submitEntry(entry);
                  }} type='button'>
                    {submitState === 'submitted' && isSelected ? 'Applied' : 'Use in DSL'}
                  </button>
                ) : null}
                <button className='selector-authoring-secondary-button danger' onClick={() => removeEntry(entry.id)} type='button'>Remove</button>
              </div>
            </div>
          );
        }) : (
          <div className='selector-authoring-empty'>
            Click <strong>Pick selector</strong>, then choose elements in the page to build a reusable locator list.
          </div>
        )}
      </div>

      {submitMessage ? (
        <div className={`selector-authoring-message ${submitState === 'error' ? 'error' : 'success'}`}>
          {submitMessage}
        </div>
      ) : null}
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

function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return value;
  }
}
