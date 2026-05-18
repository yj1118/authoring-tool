import { createRecordingAuthoringError, RecordingAuthoringError, recordingReasonCodes } from '../errors/recordingErrors';

type UnsupportedPattern = {
  reason: string;
  pattern: RegExp;
};

const unsupportedPatterns: UnsupportedPattern[] = [
  {
    reason: 'Playwright Test wrapper',
    pattern: /\btest\s*(?:\.|\()/u,
  },
  {
    reason: 'browser launch lifecycle',
    pattern: /\b(?:chromium|firefox|webkit)\.(?:launch|launchPersistentContext)\s*\(/u,
  },
  {
    reason: 'new browser context lifecycle',
    pattern: /\b(?:browser|context)\.newContext\s*\(/u,
  },
  {
    reason: 'new page lifecycle',
    pattern: /\b(?:browser|context)\.newPage\s*\(/u,
  },
  {
    reason: 'explicit browser/context/page close',
    pattern: /\b(?:browser|context|page)\.close\s*\(/u,
  },
  {
    reason: 'file chooser lifecycle',
    pattern: /\bwaitForEvent\s*\(\s*['"]filechooser['"]\s*\)|\bfileChooser\./u,
  },
  {
    reason: 'local file upload path',
    pattern: /\bsetInputFiles\s*\(/u,
  },
  {
    reason: 'static module import',
    pattern: /^\s*import\s.+from\s+['"][^'"]+['"]/mu,
  },
  {
    reason: 'dynamic module import',
    pattern: /\bimport\s*\(/u,
  },
  {
    reason: 'CommonJS require',
    pattern: /\brequire\s*\(/u,
  },
];

function stripExportDefaultForSyntaxCheck(scriptText: string): string {
  const replaced = scriptText.replace(
      /export\s+default\s+async\s+function\s+recording\s*\(/u,
      'async function recording(',
  );
  if (replaced === scriptText) {
    throw createRecordingAuthoringError({
      reasonCode: recordingReasonCodes.scriptValidationFailed,
      message: 'Recorded script must export default async function recording(page, context).',
      details: {
        expectedExport: 'export default async function recording(page, context)',
      },
    });
  }
  return replaced;
}

export function validateRecordedActionBlock(actionText: string): void {
  for (const unsupported of unsupportedPatterns) {
    const match = unsupported.pattern.exec(actionText);
    if (match) {
      throw createRecordingAuthoringError({
        reasonCode: recordingReasonCodes.scriptValidationFailed,
        message: `Recorded action uses unsupported ${unsupported.reason}.`,
        details: {
          unsupported: unsupported.reason,
          match: match[0],
        },
      });
    }
  }
}

export function validateGeneratedModuleHandlerScript(scriptText: string): void {
  if (!/export\s+default\s+async\s+function\s+recording\s*\(\s*page\s*,\s*context\s*\)/u.test(scriptText)) {
    throw createRecordingAuthoringError({
      reasonCode: recordingReasonCodes.scriptValidationFailed,
      message: 'Recorded script must export default async function recording(page, context).',
      details: {
        expectedExport: 'export default async function recording(page, context)',
      },
    });
  }

  validateRecordedActionBlock(scriptText);

  try {
    // Parses the generated script without invoking the recording handler.
    // eslint-disable-next-line no-new-func
    new Function(stripExportDefaultForSyntaxCheck(scriptText));
  } catch (error) {
    if (error instanceof RecordingAuthoringError)
      throw error;
    throw createRecordingAuthoringError({
      reasonCode: recordingReasonCodes.scriptValidationFailed,
      message: 'Recorded script has invalid JavaScript syntax.',
      details: {
        parserMessage: error instanceof Error ? error.message : String(error),
      },
      cause: error,
    });
  }
}
