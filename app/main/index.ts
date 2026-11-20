import { app, ipcMain, protocol, net, session, BrowserWindow } from 'electron';
import path from 'path';
import {
    broadcastSettings,
    createMainWindow,
    createSettingsWindow,
    getMainGeminiWebContents,
    getMainWindow,
    getQuickGeminiWebContents,
    getQuickWindow,
    getSettingsWindow,
} from './windows';
import { createTray, destroyTray } from './tray';
import { registerShortcuts, unregisterShortcuts } from './shortcuts';
import { createMenu } from './menu';
import { injectNewChat } from './injection';
import { themeManager } from './theme';
import { settingsManager } from '../config/settings';
import { WindowTarget } from '../common/types';

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
    destroyTray();
    app.releaseSingleInstanceLock();
});

app.whenReady().then(async () => {
    const settings = settingsManager.get();

    // CSP Interception to allow gemini-resource://
    session.fromPartition('persist:gemini-session').webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};

        const allowResource = (headerValue: string, directive: string) => {
            if (headerValue.includes(directive)) {
                return headerValue.replace(directive, `${directive} gemini-resource:`);
            }
            return headerValue;
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
    session.fromPartition('persist:gemini-session').on('will-download', (_event, item) => {
        const currentSettings = settingsManager.get();

        if (!currentSettings.askEverytime && currentSettings.saveLocation) {
            item.setSavePath(path.join(currentSettings.saveLocation, item.getFilename()));
        }

        item.once('done', (_doneEvent, state) => {
            if (state === 'completed') {
                const { Notification, shell } = require('electron');
                const notification = new Notification({
                    title: 'Download Complete',
                    body: item.getFilename(),
                });

                notification.on('click', () => {
                    const latestSettings = settingsManager.get();
                    if (latestSettings.notificationClickAction === 'openFolder') {
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

    // Load Chrome Extension before creating Gemini windows so declarativeNetRequest
    // and content scripts are ready before the first navigation.
    const extensionPath = app.isPackaged
        ? path.join(process.resourcesPath, 'extensions/watermark-remover')
        : path.join(__dirname, '../../extensions/watermark-remover');

    const geminiSession = session.fromPartition('persist:gemini-session');
    try {
        const { id } = await geminiSession.loadExtension(extensionPath);
        console.log(`Extension loaded: ${id}`);
    } catch (err) {
        console.error('Failed to load extension:', err);
    }

    createMainWindow();
    createTray();
    createMenu();
    registerShortcuts();

    const isHiddenLaunch = process.argv.includes('--hidden');
    const forceShow = process.argv.includes('--show');
    const isDev = process.env.NODE_ENV === 'development';
    const shouldStartMinimized = !forceShow && !isDev && (isHiddenLaunch || settings.startMinimized);

    if (shouldStartMinimized) {
        console.log('App launched in minimized/hidden mode');
    } else {
        getMainWindow()?.show();
        getMainWindow()?.focus();
    }

    const appPath = app.getPath('exe');
    const args = settings.startMinimized ? ['--hidden'] : [];

    if (app.isPackaged) {
        app.setLoginItemSettings({
            openAtLogin: settings.runOnStartup,
            path: appPath,
            args: args,
        });
    }
});

app.on('window-all-closed', () => {
    // Keep app running in system tray
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

    registerShortcuts();
    createMenu();

    const args = updated.startMinimized ? ['--hidden'] : [];
    if (app.isPackaged) {
        app.setLoginItemSettings({
            openAtLogin: updated.runOnStartup,
            path: app.getPath('exe'),
            args: args,
        });
    }

    const quickWin = getQuickWindow();
    if (quickWin && !quickWin.isDestroyed()) {
        quickWin.setAlwaysOnTop(updated.quickWindowAlwaysOnTop);
    }

    broadcastSettings(updated);
    return updated;
});

ipcMain.handle('resize-window', (_, height) => {
    const settingsWindow = getSettingsWindow();
    if (settingsWindow && !settingsWindow.isDestroyed() && typeof height === 'number' && height >= 420 && height <= 800) {
        settingsWindow.setContentSize(780, Math.round(height));
    }
});

ipcMain.handle('set-shortcuts-enabled', (_, enabled) => {
    if (enabled) {
        registerShortcuts();
    } else {
        unregisterShortcuts();
    }
});

ipcMain.handle('minimize-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (window && !window.isDestroyed()) {
        window.minimize();
    }
});

ipcMain.handle('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (window && !window.isDestroyed()) {
        window.close();
    }
});

ipcMain.handle('select-directory', async (event) => {
    const { dialog } = require('electron');
    const window = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (!window) return undefined;

    const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory'],
    });

    if (result.canceled) return undefined;
    return result.filePaths[0];
});

// Live Gemini Theme IPC Handlers
ipcMain.handle('get-theme', () => {
    return themeManager.getPalette();
});

ipcMain.handle('sync-theme', async () => {
    return themeManager.syncFromActiveGemini(true);
});

// Shell Window Actions
ipcMain.handle('new-chat', async (_, target?: WindowTarget) => {
    const wc = target === 'quick'
        ? getQuickGeminiWebContents()
        : getMainGeminiWebContents();
    if (wc) {
        await injectNewChat(wc);
        wc.focus();
    }
});

ipcMain.handle('reload-gemini', (_, target?: WindowTarget) => {
    const wc = target === 'quick'
        ? getQuickGeminiWebContents()
        : getMainGeminiWebContents();
    if (wc) {
        wc.reload();
    }
});

ipcMain.handle('open-settings', () => {
    createSettingsWindow();
});

ipcMain.handle('toggle-quick-always-on-top', () => {
    const current = settingsManager.get();
    const nextValue = !current.quickWindowAlwaysOnTop;
    const updated = settingsManager.update({ quickWindowAlwaysOnTop: nextValue });

    const quickWin = getQuickWindow();
    if (quickWin && !quickWin.isDestroyed()) {
        quickWin.setAlwaysOnTop(nextValue);
    }

    broadcastSettings(updated);
    return nextValue;
});

export function getIsQuitting() {
    return isQuitting;
}
