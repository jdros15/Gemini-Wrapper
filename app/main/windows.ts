import { BrowserWindow, WebContents, WebContentsView, screen, shell, app } from 'electron';
import path from 'path';
import { settingsManager } from '../config/settings';
import { themeManager } from './theme';
import { attachGeminiUiCleanup } from './injection';
import { AppSettings, GeminiThemePalette } from '../common/types';

let mainWindow: BrowserWindow | null = null;
let mainGeminiView: WebContentsView | null = null;

let quickWindow: BrowserWindow | null = null;
let quickGeminiView: WebContentsView | null = null;

let settingsWindow: BrowserWindow | null = null;

const GEMINI_URL = 'https://gemini.google.com/app';
export const TITLEBAR_HEIGHT = 38;

function getAppIconPath(): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'icon.png')
        : path.join(__dirname, '../../build/icon.png');
}

function loadRendererView(win: BrowserWindow, query: Record<string, string>) {
    if (process.env.NODE_ENV === 'development') {
        const params = new URLSearchParams(query).toString();
        const url = params ? `http://localhost:5173/?${params}` : 'http://localhost:5173';
        let retries = 0;

        const onFailLoad = (_event: Electron.Event, errorCode: number, _desc: string, validatedURL: string) => {
            if (validatedURL.startsWith('http://localhost:5173') && retries < 15 && !win.isDestroyed()) {
                retries += 1;
                setTimeout(() => {
                    if (!win.isDestroyed()) {
                        win.loadURL(url).catch(() => {});
                    }
                }, 300);
            }
        };

        win.webContents.on('did-fail-load', onFailLoad);
        win.webContents.once('did-finish-load', () => {
            win.webContents.removeListener('did-fail-load', onFailLoad);
        });
        win.loadURL(url).catch(() => {});
    } else {
        win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'), { query });
    }
}

function applyTitleBarOverlay(win: BrowserWindow | null, palette: GeminiThemePalette) {
    if (!win || win.isDestroyed() || process.platform !== 'win32') return;
    try {
        win.setTitleBarOverlay({
            color: palette.titleBarBg,
            symbolColor: palette.titleBarSymbol,
            height: TITLEBAR_HEIGHT,
        });
    } catch {
        // Ignore if window does not use titleBarOverlay
    }
}

// Keep native Windows titlebar overlay symbols & background synced with Gemini's live palette
themeManager.onUpdate((palette) => {
    applyTitleBarOverlay(mainWindow, palette);
    applyTitleBarOverlay(quickWindow, palette);
    try {
        mainGeminiView?.setBackgroundColor(palette.bg);
        quickGeminiView?.setBackgroundColor(palette.bg);
    } catch {
        // Ignore if views are destroyed
    }
});

function configureGeminiViewNavigation(webContents: WebContents) {
    webContents.setWindowOpenHandler(({ url }) => {
        const isGemini = url.startsWith('https://gemini.google.com');
        const isGoogleAuth = url.startsWith('https://accounts.google.com');

        if (!isGemini && !isGoogleAuth) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    webContents.on('will-navigate', (event, url) => {
        const isGemini = url.startsWith('https://gemini.google.com');
        const isGoogleAuth = url.startsWith('https://accounts.google.com');

        if (!isGemini && !isGoogleAuth) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
}

function createEmbeddedGeminiView(parentWindow: BrowserWindow): WebContentsView {
    const palette = themeManager.getPalette();
    const view = new WebContentsView({
        webPreferences: {
            partition: 'persist:gemini-session',
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    view.setBackgroundColor(palette.bg);
    parentWindow.contentView.addChildView(view);

    const layoutView = () => {
        if (parentWindow.isDestroyed()) return;
        const { width, height } = parentWindow.getContentBounds();
        if (width <= 0 || height <= TITLEBAR_HEIGHT) return;
        view.setBounds({
            x: 0,
            y: TITLEBAR_HEIGHT,
            width,
            height: height - TITLEBAR_HEIGHT,
        });
    };

    const scheduleLayout = () => {
        layoutView();
        setTimeout(layoutView, 60);
        setTimeout(layoutView, 250);
    };

    scheduleLayout();
    parentWindow.on('ready-to-show', scheduleLayout);
    parentWindow.on('resize', layoutView);
    parentWindow.on('maximize', scheduleLayout);
    parentWindow.on('unmaximize', scheduleLayout);
    parentWindow.on('show', scheduleLayout);

    configureGeminiViewNavigation(view.webContents);
    attachGeminiUiCleanup(view.webContents);
    themeManager.attachToGeminiWebContents(view.webContents);

    // Retry initial load automatically if a transient error interrupts first startup
    let initialLoadSucceeded = false;
    let loadRetries = 0;

    view.webContents.on('did-finish-load', () => {
        initialLoadSucceeded = true;
        layoutView();
    });

    view.webContents.on('did-fail-load', (_event, errorCode, _errorDesc, validatedURL, isMainFrame) => {
        // Ignore ERR_ABORTED (-3) from intentional redirects/reloads
        if (!isMainFrame || errorCode === -3 || initialLoadSucceeded) return;
        if (loadRetries < 2 && !view.webContents.isDestroyed()) {
            loadRetries += 1;
            console.warn(`Initial Gemini load failed (${errorCode} on ${validatedURL}), retrying (${loadRetries}/2)...`);
            setTimeout(() => {
                if (!view.webContents.isDestroyed()) {
                    view.webContents.loadURL(GEMINI_URL).catch(() => {});
                }
            }, 800);
        }
    });

    view.webContents.loadURL(GEMINI_URL).catch(() => {});

    return view;
}

export function createMainWindow() {
    if (mainWindow) {
        return mainWindow;
    }

    const palette = themeManager.getPalette();

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 820,
        minWidth: 520,
        minHeight: 460,
        title: 'Google Gemini',
        show: false,
        icon: getAppIconPath(),
        backgroundColor: palette.bg,
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: process.platform === 'win32'
            ? {
                color: palette.titleBarBg,
                symbolColor: palette.titleBarSymbol,
                height: TITLEBAR_HEIGHT,
            }
            : undefined,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.setMenuBarVisibility(false);
    loadRendererView(mainWindow, { view: 'shell', mode: 'main' });
    mainGeminiView = createEmbeddedGeminiView(mainWindow);

    // Session Management: Auto-Reset for Main Window
    let mainLastHideTime = 0;
    mainWindow.on('hide', () => {
        mainLastHideTime = Date.now();
    });

    mainWindow.on('show', () => {
        if (mainLastHideTime > 0) {
            const minutesHidden = (Date.now() - mainLastHideTime) / 60000;
            const settings = settingsManager.get();
            if (settings.autoResetTimer > 0 && minutesHidden >= settings.autoResetTimer) {
                mainGeminiView?.webContents.loadURL(GEMINI_URL);
            }
        }
        themeManager.syncFromActiveGemini().catch(() => {});
    });

    mainWindow.on('focus', () => {
        themeManager.syncFromActiveGemini().catch(() => {});
    });

    mainWindow.on('close', (e) => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.close();
        }

        const { getIsQuitting } = require('./index');
        if (!getIsQuitting()) {
            e.preventDefault();
            mainWindow?.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainGeminiView = null;
        mainWindow = null;
    });

    return mainWindow;
}

export function createQuickWindow() {
    if (quickWindow) return quickWindow;

    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const settings = settingsManager.get();
    const palette = themeManager.getPalette();

    let bounds = {
        width: 500,
        height: 620,
        x: screenWidth - 520,
        y: 50,
    };

    if (settings.quickWindowBounds) {
        bounds = { ...bounds, ...settings.quickWindowBounds };
    }

    quickWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        minWidth: 380,
        minHeight: 420,
        x: bounds.x,
        y: bounds.y,
        show: false,
        icon: getAppIconPath(),
        backgroundColor: palette.bg,
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: process.platform === 'win32'
            ? {
                color: palette.titleBarBg,
                symbolColor: palette.titleBarSymbol,
                height: TITLEBAR_HEIGHT,
            }
            : undefined,
        alwaysOnTop: settings.quickWindowAlwaysOnTop,
        skipTaskbar: true,
        title: 'Quick Gemini',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    quickWindow.setMenuBarVisibility(false);
    loadRendererView(quickWindow, { view: 'shell', mode: 'quick' });
    quickGeminiView = createEmbeddedGeminiView(quickWindow);

    // Save bounds on move/resize with debounce
    let saveTimeout: NodeJS.Timeout;
    const saveBounds = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            if (quickWindow && !quickWindow.isDestroyed()) {
                settingsManager.update({ quickWindowBounds: quickWindow.getBounds() });
            }
        }, 500);
    };

    quickWindow.on('resize', saveBounds);
    quickWindow.on('move', saveBounds);

    // Session Management: Auto-Reset
    let lastHideTime = 0;
    quickWindow.on('hide', () => {
        lastHideTime = Date.now();
    });

    quickWindow.on('show', () => {
        if (lastHideTime > 0) {
            const minutesHidden = (Date.now() - lastHideTime) / 60000;
            const currentSettings = settingsManager.get();
            if (currentSettings.autoResetTimer > 0 && minutesHidden >= currentSettings.autoResetTimer) {
                quickGeminiView?.webContents.loadURL(GEMINI_URL);
            }
        }
        themeManager.syncFromActiveGemini().catch(() => {});
    });

    quickWindow.on('close', (e) => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.close();
        }

        const { getIsQuitting } = require('./index');
        if (!getIsQuitting()) {
            e.preventDefault();
            quickWindow?.hide();
        }
    });

    quickWindow.on('closed', () => {
        quickGeminiView = null;
        quickWindow = null;
    });

    return quickWindow;
}

export function toggleQuickWindow() {
    if (!quickWindow) {
        createQuickWindow();
    }

    if (quickWindow?.isVisible()) {
        quickWindow.hide();
    } else {
        quickWindow?.show();
        quickWindow?.focus();
        quickGeminiView?.webContents.focus();
    }
}

export function createSettingsWindow() {
    // Trigger an immediate live palette check from Gemini when opening Settings
    themeManager.syncFromActiveGemini().catch(() => {});

    if (settingsWindow) {
        settingsWindow.show();
        settingsWindow.focus();
        return;
    }

    const parent = (quickWindow && quickWindow.isVisible()) ? quickWindow : null;
    const palette = themeManager.getPalette();

    settingsWindow = new BrowserWindow({
        width: 780,
        height: 590,
        title: 'Settings',
        icon: getAppIconPath(),
        backgroundColor: palette.bg,
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        minimizable: false,
        maximizable: false,
        resizable: false,
        parent: parent || undefined,
        modal: !!parent,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    settingsWindow.setMenu(null);
    loadRendererView(settingsWindow, { view: 'settings' });

    settingsWindow.on('focus', () => {
        themeManager.syncFromActiveGemini().catch(() => {});
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

export function broadcastSettings(settings: AppSettings) {
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            try {
                win.webContents.send('settings-updated', settings);
            } catch {
                // Ignore
            }
        }
    }
}

export function getMainWindow() {
    return mainWindow;
}

export function getMainGeminiWebContents(): WebContents | null {
    return mainGeminiView && !mainGeminiView.webContents.isDestroyed()
        ? mainGeminiView.webContents
        : null;
}

export function getQuickWindow() {
    return quickWindow;
}

export function getQuickGeminiWebContents(): WebContents | null {
    return quickGeminiView && !quickGeminiView.webContents.isDestroyed()
        ? quickGeminiView.webContents
        : null;
}

export function getSettingsWindow() {
    return settingsWindow;
}
