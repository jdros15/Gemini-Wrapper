import { Menu, BrowserWindow, app } from 'electron';
import { createSettingsWindow, getMainWindow, getQuickWindow } from './windows';
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
                        const mainWindow = getMainWindow();

                        if (focusedWindow && focusedWindow === quickWindow) {
                            injectNewChat(quickWindow.webContents);
                        } else {
                            // Default to main window if quick window isn't focused
                            if (mainWindow) {
                                if (!mainWindow.isVisible()) {
                                    mainWindow.show();
                                }
                                mainWindow.focus();
                                injectNewChat(mainWindow.webContents);
                            }
                        }
                    },
                },
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        const focusedWindow = BrowserWindow.getFocusedWindow();
                        if (focusedWindow) {
                            focusedWindow.reload();
                        }
                    },
                },
                { type: 'separator' },
                {
                    label: 'Settings',
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
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
