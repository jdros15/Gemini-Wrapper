import { Menu, BrowserWindow, app } from 'electron';
import {
    createSettingsWindow,
    getMainGeminiWebContents,
    getMainWindow,
    getQuickGeminiWebContents,
    getQuickWindow,
} from './windows';
import { injectNewChat } from './injection';
import { settingsManager } from '../config/settings';

export function createMenu() {
    const settings = settingsManager.get();

    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'Options',
            submenu: [
                {
                    label: 'New Chat',
                    accelerator: settings.newChatHotkey,
                    click: () => {
                        const focusedWindow = BrowserWindow.getFocusedWindow();
                        const quickWindow = getQuickWindow();
                        const quickWc = getQuickGeminiWebContents();
                        const mainWindow = getMainWindow();
                        const mainWc = getMainGeminiWebContents();

                        if (focusedWindow && focusedWindow === quickWindow && quickWc) {
                            injectNewChat(quickWc);
                        } else if (mainWindow && mainWc) {
                            if (!mainWindow.isVisible()) {
                                mainWindow.show();
                            }
                            mainWindow.focus();
                            injectNewChat(mainWc);
                        }
                    },
                },
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        const focusedWindow = BrowserWindow.getFocusedWindow();
                        const quickWindow = getQuickWindow();
                        const quickWc = getQuickGeminiWebContents();
                        const mainWc = getMainGeminiWebContents();

                        if (focusedWindow && focusedWindow === quickWindow && quickWc) {
                            quickWc.reload();
                        } else if (mainWc) {
                            mainWc.reload();
                        } else if (focusedWindow) {
                            focusedWindow.reload();
                        }
                    },
                },
                { type: 'separator' },
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        createSettingsWindow();
                    },
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    click: () => {
                        app.quit();
                    },
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
