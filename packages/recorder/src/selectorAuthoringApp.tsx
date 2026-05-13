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
import * as React from 'react';
import './recorder.css';
import { getSelectorAuthoringMessages, normalizeRecorderLocale } from './messages';
import { createRecorderBackend } from './recorderBackend';
import { copySelectorToClipboard } from './selectorAuthoring';

import type { RecorderBackend, RecorderFrontend, RecorderLocale, SelectorAuthoringDiagnostic } from './recorderTypes';

type SelectorEntry = {
  id: string;
  note: string;
  selector: string;
  selectedAt: string;
};

export const SelectorAuthoringApp: React.FC = () => {
  const [, setSources] = React.useState<Source[]>([]);
  const [mode, setMode] = React.useState<Mode>('none');
  const backend = React.useMemo(createRecorderBackend, []);
  const [locale, setLocale] = React.useState<RecorderLocale>(() => normalizeRecorderLocale(window.navigator.language));
  const [entries, setEntries] = React.useState<SelectorEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | undefined>();
  const [pageUrl, setPageUrl] = React.useState<string | undefined>();
  const [copiedEntryId, setCopiedEntryId] = React.useState<string | undefined>();
  const [selectorAuthoringDiagnostic, setSelectorAuthoringDiagnostic] = React.useState<SelectorAuthoringDiagnostic | null>(null);
  const nextEntryId = React.useRef(0);
  const i18n = React.useMemo(() => getSelectorAuthoringMessages(locale), [locale]);

  React.useEffect(() => {
    if (!copiedEntryId)
      return;
    const timeout = window.setTimeout(() => setCopiedEntryId(undefined), 1500);
    return () => window.clearTimeout(timeout);
  }, [copiedEntryId]);

  React.useLayoutEffect(() => {
    const dispatcher: RecorderFrontend = {
      localeChanged: ({ locale }) => setLocale(locale),
      modeChanged: ({ mode }) => setMode(mode),
      selectorAuthoringDiagnosticChanged: ({ diagnostic }) => setSelectorAuthoringDiagnostic(diagnostic),
      sourcesUpdated: ({ sources }) => {
        setSources(sources);
        window.playwrightSourcesEchoForTest = sources;
      },
      pageNavigated: ({ url }) => setPageUrl(url),
      pauseStateChanged: () => {},
      callLogsUpdated: (_params: { callLogs: CallLog[] }) => {},
      sourceRevealRequested: () => {},
      elementPicked: ({ elementInfo }) => {
        const entry: SelectorEntry = {
          id: `selector-${++nextEntryId.current}`,
          note: '',
          selector: elementInfo.selector,
          selectedAt: new Date().toISOString(),
        };
        setEntries(current => [...current, entry]);
        setSelectedEntryId(entry.id);
        setCopiedEntryId(undefined);
        if (mode === 'inspecting' || mode === 'recording-inspecting')
          backend.setMode({ mode: 'standby' }).catch(() => { });
      },
    };
    window.dispatch = (data: { method: string; params?: any }) => {
      (dispatcher as any)[data.method].call(dispatcher, data.params);
    };
  }, [backend, mode]);

  React.useEffect(() => {
    document.title = pageUrl ? `${i18n.windowTitle} - ${pageUrl}` : i18n.windowTitle;
  }, [i18n.windowTitle, pageUrl]);

  const isPicking = mode === 'inspecting' || mode === 'recording-inspecting';
  const selectEntry = React.useCallback((entryId: string) => {
    const entry = entries.find(candidate => candidate.id === entryId);
    setSelectedEntryId(entryId);
    setCopiedEntryId(undefined);
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
    const nextEntry = nextSelectedEntryId ? nextEntries.find(entry => entry.id === nextSelectedEntryId) : undefined;
    void backend.highlightRequested(nextEntry?.selector ? { selector: nextEntry.selector } : {});
  }, [backend, entries, selectedEntryId]);

  const updateEntryNote = React.useCallback((entryId: string, note: string) => {
    setEntries(current => current.map(entry => entry.id === entryId ? { ...entry, note } : entry));
  }, []);

  const clearEntries = React.useCallback(() => {
    setEntries([]);
    setSelectedEntryId(undefined);
    setCopiedEntryId(undefined);
    void backend.highlightRequested({});
  }, [backend]);

  return <div className='recorder'>
    <div className='selector-authoring-main'>
      {selectorAuthoringDiagnostic ? (
        <div className={`selector-authoring-message ${selectorAuthoringDiagnostic.severity}`}>
          {selectorAuthoringDiagnostic.message}
        </div>
      ) : null}

      <div className='selector-authoring-panel'>
        <div className='selector-authoring-collection-header'>
          <div className='selector-authoring-header-main'>
            <div className='selector-authoring-header-actions'>
              <button
                className={`selector-authoring-primary-button ${isPicking ? 'toggled' : ''}`}
                onClick={() => {
                  backend.setMode({ mode: isPicking ? 'standby' : 'inspecting' }).catch(() => { });
                }}
                type='button'
              >
                {isPicking ? i18n.stopPicking : i18n.pickSelector}
              </button>
            </div>
          </div>
          <div className='selector-authoring-header-side'>
            <span className='selector-authoring-count'>{i18n.savedCount(entries.length)}</span>
            <button className='selector-authoring-text-button' disabled={!entries.length} onClick={clearEntries} type='button'>{i18n.clearAll}</button>
          </div>
        </div>

        <div className='selector-authoring-collection'>
          {entries.length ? entries.map((entry, index) => {
            const isSelected = entry.id === selectedEntryId;
            const copyLabel = copiedEntryId === entry.id ? i18n.copied : i18n.copy;
            return (
              <div className={`selector-authoring-entry ${isSelected ? 'selected' : ''}`} key={entry.id}>
                <div
                  className='selector-authoring-entry-main'
                  onClick={() => selectEntry(entry.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ')
                      selectEntry(entry.id);
                  }}
                  role='button'
                  tabIndex={0}
                >
                  <div className='selector-authoring-entry-top'>
                    <div className='selector-authoring-entry-order'>{index + 1}</div>
                    <input
                      className='selector-authoring-entry-note'
                      onChange={event => updateEntryNote(entry.id, event.target.value)}
                      onClick={event => event.stopPropagation()}
                      onFocus={() => selectEntry(entry.id)}
                      onKeyDown={event => event.stopPropagation()}
                      placeholder={i18n.notePlaceholder}
                      type='text'
                      value={entry.note}
                    />
                    <div className='selector-authoring-entry-time'>{formatTimestamp(entry.selectedAt)}</div>
                  </div>
                  <div className='selector-authoring-entry-selector'>
                    <div className='selector-authoring-entry-code' title={entry.selector}>{entry.selector}</div>
                  </div>
                </div>
                <div className='selector-authoring-entry-actions'>
                  <button className='selector-authoring-secondary-button' onClick={() => copyEntry(entry)} type='button'>{copyLabel}</button>
                  <button className='selector-authoring-secondary-button danger' onClick={() => removeEntry(entry.id)} type='button'>{i18n.remove}</button>
                </div>
              </div>
            );
          }) : (
            <div className='selector-authoring-empty'>
              <div className='selector-authoring-empty-title'>{i18n.emptyTitle}</div>
              <div className='selector-authoring-empty-copy'>
                {i18n.emptyPrefix}<strong>{i18n.pickSelector}</strong>{i18n.emptySuffix}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>;
};

function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return value;
  }
}
