import { render } from 'ink';
import React from 'react';

import { loadSettings } from '../utils/app-settings';
import { inspectCopilotIntegration } from '../utils/copilot-settings';

import { App } from './App';

export async function runTui(): Promise<void> {
    const [settings, integration] = await Promise.all([
        loadSettings({ createIfMissing: true }),
        inspectCopilotIntegration().catch(() => null)
    ]);
    const instance = render(React.createElement(App, { settings, integration }));
    await instance.waitUntilExit();
}
