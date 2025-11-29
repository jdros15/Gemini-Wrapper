import { globalShortcut } from 'electron';
import { settingsManager } from '../config/settings';
import { toggleQuickWindow, getMainWindow } from './windows';
import { injectNewChat } from './injection';

export function registerShortcuts() {
    globalShortcut.unregisterAll();

    const settings = settingsManager.get();

    try {
        globalShortcut.register(settings.quickWindowHotkey, () => {
            toggleQuickWindow();
        });
    } catch (e) {
        console.error('Failed to register quick window hotkey', e);
    }
}

export function unregisterShortcuts() {
    globalShortcut.unregisterAll();
}
