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

import * as React from 'react';
import './recorder.css';
import { getRecorderAuthoringMessages, normalizeRecorderLocale } from './messages';
import type { RecorderLocale } from './recorderTypes';

export const RecorderAuthoringApp: React.FC = () => {
  const [locale] = React.useState<RecorderLocale>(() => normalizeRecorderLocale(window.navigator.language));
  const i18n = React.useMemo(() => getRecorderAuthoringMessages(locale), [locale]);

  React.useEffect(() => {
    document.title = i18n.windowTitle;
  }, [i18n.windowTitle]);

  return <div className='recorder'>
    <div className='selector-authoring-main'>
      <div className='selector-authoring-panel'>
        <div className='selector-authoring-empty'>
          <div className='selector-authoring-empty-title'>{i18n.recorderPlaceholderTitle}</div>
          <div className='selector-authoring-empty-copy'>{i18n.recorderPlaceholderBody}</div>
        </div>
      </div>
    </div>
  </div>;
};
