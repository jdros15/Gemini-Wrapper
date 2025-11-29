import { Tray, Menu, app } from 'electron';
import path from 'path';
import { createMainWindow, toggleQuickWindow, createSettingsWindow } from './windows';

let tray: Tray | null = null;

export function createTray() {
    // Use PNG icon which is more reliable
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.png')
        : path.join(__dirname, '../../build/icon.png');

    try {
        tray = new Tray(iconPath);
    } catch (e) {
        console.warn("Could not create tray icon. Ensure build/icon.png exists.", e);
        return;
    }

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Gemini',
            click: () => {
                const win = createMainWindow();
                win.show();
                win.focus();
            }
        },
        { label: 'Quick Gemini', click: () => toggleQuickWindow() },
        { label: 'Settings', click: () => createSettingsWindow() },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Gemini Wrapper');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        const win = createMainWindow();
        win.show();
        win.focus();
    });
}

export function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}
