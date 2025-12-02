import { BrowserWindow, screen, shell, app } from 'electron';
import path from 'path';
import { settingsManager } from '../config/settings';

let mainWindow: BrowserWindow | null = null;
let quickWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

const GEMINI_URL = 'https://gemini.google.com/app';

export function createMainWindow() {
    if (mainWindow) {
        // Don't auto-show, let caller decide
        return mainWindow;
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Google Gemini',
        show: false, // Start hidden
        icon: path.join(__dirname, '../../build/icon.ico'),
        webPreferences: {
            partition: 'persist:gemini-session',
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.loadURL(GEMINI_URL);

    // Session Management: Auto-Reset for Main Window
    let mainLastHideTime = 0;
    mainWindow.on('hide', () => {
        mainLastHideTime = Date.now();
    });

    mainWindow.on('show', () => {
        if (mainLastHideTime > 0) {
            const minutesHidden = (Date.now() - mainLastHideTime) / 60000;
            const settings = settingsManager.get();
            if (minutesHidden >= settings.autoResetTimer) {
                // Reset to new chat/home
                mainWindow?.loadURL(GEMINI_URL);
            }
        }
    });

    mainWindow.on('close', (e) => {
        // Close settings window if open
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.close();
        }

        // Import at runtime to avoid circular dependency
        const { getIsQuitting } = require('./index');
        if (!getIsQuitting()) {
            e.preventDefault();
            mainWindow?.hide();
        }
    });

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const isGemini = url.startsWith('https://gemini.google.com');
        const isGoogleAuth = url.startsWith('https://accounts.google.com');

        if (!isGemini && !isGoogleAuth) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // Intercept in-page navigation to external sites
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const isGemini = url.startsWith('https://gemini.google.com');
        const isGoogleAuth = url.startsWith('https://accounts.google.com');

        if (!isGemini && !isGoogleAuth) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    return mainWindow;
}

export function createQuickWindow() {
    if (quickWindow) return quickWindow;

    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const settings = settingsManager.get();

    // Default bounds
    let bounds = {
        width: 500,
        height: 600,
        x: screenWidth - 520,
        y: 50
    };

    // Override with saved bounds if they exist
    if (settings.quickWindowBounds) {
        bounds = { ...bounds, ...settings.quickWindowBounds };
    }

    quickWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        show: false,
        frame: true, // Keep frame for moving/closing, or make false for custom UI
        alwaysOnTop: settings.quickWindowAlwaysOnTop,
        skipTaskbar: true,
        title: 'Google Gemini',
        webPreferences: {
            partition: 'persist:gemini-session', // Share session with main window
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    quickWindow.loadURL(GEMINI_URL);

    // Open external links in default browser (for Quick Window)
    quickWindow.webContents.setWindowOpenHandler(({ url }) => {
        const isGemini = url.startsWith('https://gemini.google.com');
        const isGoogleAuth = url.startsWith('https://accounts.google.com');

        if (!isGemini && !isGoogleAuth) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // Intercept in-page navigation to external sites
    quickWindow.webContents.on('will-navigate', (event, url) => {
        const isGemini = url.startsWith('https://gemini.google.com');
        const isGoogleAuth = url.startsWith('https://accounts.google.com');

        if (!isGemini && !isGoogleAuth) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    // Save bounds on move/resize with debounce
    let saveTimeout: NodeJS.Timeout;
    const saveBounds = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            if (quickWindow && !quickWindow.isDestroyed()) {
                settingsManager.update({ quickWindowBounds: quickWindow.getBounds() });
            }
        }, 500); // Debounce for 500ms
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
            const settings = settingsManager.get();
            if (minutesHidden >= settings.autoResetTimer) {
                // Reset to new chat/home
                quickWindow?.loadURL(GEMINI_URL);
            }
        }
    });

    quickWindow.on('close', (e) => {
        // Close settings window if open
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.close();
        }

        const { getIsQuitting } = require('./index');
        if (!getIsQuitting()) {
            e.preventDefault();
            quickWindow?.hide();
        }
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
    }
}

export function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.show();
        return;
    }

    // Z-Order: Parent to Quick Window if visible to ensure it stays on top
    const parent = (quickWindow && quickWindow.isVisible()) ? quickWindow : null;

    settingsWindow = new BrowserWindow({
        width: 700,
        height: 520,
        title: 'Settings',
        autoHideMenuBar: true,
        minimizable: false,
        maximizable: false,
        resizable: false,
        parent: parent || undefined, // Set parent for Z-order
        modal: !!parent, // Make modal if parent exists
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    settingsWindow.setMenu(null); // Explicitly remove the menu

    if (process.env.NODE_ENV === 'development') {
        settingsWindow.loadURL('http://localhost:5173');
    } else {
        settingsWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
    }

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

export function getMainWindow() {
    return mainWindow;
}

export function getQuickWindow() {
    return quickWindow;
}

export function getSettingsWindow() {
    return settingsWindow;
}
