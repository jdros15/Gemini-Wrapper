import { app, ipcMain, protocol, net, session, BrowserWindow } from 'electron';
import path from 'path';
import { createMainWindow, createQuickWindow, getMainWindow } from './windows';
import { createTray, destroyTray } from './tray';
import { registerShortcuts } from './shortcuts';
import { createMenu } from './menu';
import { settingsManager } from '../config/settings';

// Set AppUserModelID for Windows notifications
app.setAppUserModelId('com.gemini.wrapper');
app.setName('Google Gemini');

// Track if we're actually quitting (vs just hiding to tray)
let isQuitting = false;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        const mainWindow = getMainWindow();
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// Ensure app quits properly during uninstall
app.on('before-quit', () => {
    isQuitting = true;
    destroyTray(); // Destroy tray icon to prevent shutdown error
    // Release single instance lock
    app.releaseSingleInstanceLock();
});

app.whenReady().then(() => {
    const settings = settingsManager.get();

    // CSP Interception to allow gemini-resource://
    session.fromPartition('persist:gemini-session').webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};

        // Helper to inject our protocol into a directive
        const allowResource = (headerValue: string, directive: string) => {
            if (headerValue.includes(directive)) {
                return headerValue.replace(directive, `${directive} gemini-resource:`);
            }
            return headerValue; // If directive missing, we might need to append it, but usually it exists
        };

        if (responseHeaders['content-security-policy']) {
            responseHeaders['content-security-policy'] = responseHeaders['content-security-policy'].map(header => {
                let newHeader = header;
                newHeader = allowResource(newHeader, 'connect-src');
                newHeader = allowResource(newHeader, 'img-src');
                return newHeader;
            });
        }

        callback({ responseHeaders });
    });

    // Handle Downloads
    session.fromPartition('persist:gemini-session').on('will-download', (event, item, webContents) => {
        const settings = settingsManager.get();

        if (!settings.askEverytime && settings.saveLocation) {
            item.setSavePath(path.join(settings.saveLocation, item.getFilename()));
        }

        item.once('done', (event, state) => {
            if (state === 'completed') {
                const { Notification, shell } = require('electron');
                const notification = new Notification({
                    title: 'Download Complete',
                    body: item.getFilename(),
                });

                notification.on('click', () => {
                    const currentSettings = settingsManager.get();
                    if (currentSettings.notificationClickAction === 'openFolder') {
                        shell.showItemInFolder(item.getSavePath());
                    } else {
                        shell.openPath(item.getSavePath());
                    }
                });

                notification.show();
            }
        });
    });

    // Register custom protocol for serving resources
    protocol.handle('gemini-resource', (request) => {
        const url = request.url.replace('gemini-resource://', '');
        const resourcePath = app.isPackaged
            ? path.join(process.resourcesPath, 'resources', url)
            : path.join(__dirname, '../../app/resources', url);

        return net.fetch('file:///' + resourcePath);
    });

    // Load Chrome Extension
    const extensionPath = app.isPackaged
        ? path.join(process.resourcesPath, 'extensions/watermark-remover')
        : path.join(__dirname, '../../extensions/watermark-remover');

    const geminiSession = session.fromPartition('persist:gemini-session');
    geminiSession.loadExtension(extensionPath)
        .then(({ id }: { id: string }) => {
            console.log(`Extension loaded: ${id}`);
        })
        .catch((err: Error) => {
            console.error('Failed to load extension:', err);
        });

    createMainWindow();
    createTray();
    createMenu();
    registerShortcuts();

    // Check if launched with --hidden flag (startup)
    const isHiddenLaunch = process.argv.includes('--hidden');

    if (isHiddenLaunch) {
        getMainWindow()?.hide();
        console.log('App launched in hidden mode');
    } else {
        getMainWindow()?.show();
        getMainWindow()?.focus();
    }

    // Update login item settings based on preference
    const appPath = app.getPath('exe');

    // If startMinimized is true, we pass --hidden.
    // If false, we pass empty args to ensure it starts normally.
    const args = settings.startMinimized ? ['--hidden'] : [];

    if (app.isPackaged) {
        app.setLoginItemSettings({
            openAtLogin: settings.runOnStartup,
            path: appPath,
            args: args
        });
    }
});

app.on('window-all-closed', () => {
    // Don't quit on window close, as we have a tray
    // app.quit();
});

app.on('activate', () => {
    if (createMainWindow() === null) {
        createMainWindow();
    }
});

// IPC Handlers
ipcMain.handle('get-settings', () => {
    return settingsManager.get();
});

ipcMain.handle('update-settings', async (_, newSettings) => {
    const updated = settingsManager.update(newSettings);

    // Apply side effects
    registerShortcuts(); // Re-register with new keys
    createMenu(); // Rebuild menu with new hotkey display

    // Update login item settings based on new preference
    const args = updated.startMinimized ? ['--hidden'] : [];
    app.setLoginItemSettings({
        openAtLogin: updated.runOnStartup,
        path: app.getPath('exe'),
        args: args,
    });

    // Update quick window always on top if changed
    const quickWin = require('./windows').getQuickWindow();
    if (quickWin) {
        quickWin.setAlwaysOnTop(updated.quickWindowAlwaysOnTop);
    }

    return updated;
});

ipcMain.handle('resize-window', (_, height) => {
    const settingsWindow = require('./windows').getSettingsWindow();
    if (settingsWindow) {
        settingsWindow.setContentSize(700, height);
    }
});

ipcMain.handle('set-shortcuts-enabled', (_, enabled) => {
    const { unregisterShortcuts } = require('./shortcuts');
    if (enabled) {
        registerShortcuts();
    } else {
        unregisterShortcuts();
    }
});

ipcMain.handle('minimize-window', () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
        window.minimize();
    }
});

ipcMain.handle('close-window', () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
        window.close();
    }
});

ipcMain.handle('select-directory', async () => {
    const { dialog } = require('electron');
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return undefined;

    const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory']
    });

    if (result.canceled) return undefined;
    return result.filePaths[0];
});

export function getIsQuitting() {
    return isQuitting;
}
