import { contextBridge, ipcRenderer, shell } from 'electron';
import { AppSettings, GeminiThemePalette, WindowTarget } from '../common/types';

contextBridge.exposeInMainWorld('electron', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('update-settings', settings),
    resizeWindow: (height: number) => ipcRenderer.invoke('resize-window', height),
    openExternal: (url: string) => shell.openExternal(url),
    setShortcutsEnabled: (enabled: boolean) => ipcRenderer.invoke('set-shortcuts-enabled', enabled),
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),

    // Live Gemini Theme API
    getTheme: () => ipcRenderer.invoke('get-theme'),
    syncTheme: () => ipcRenderer.invoke('sync-theme'),
    onThemeUpdated: (callback: (palette: GeminiThemePalette) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, palette: GeminiThemePalette) => {
            callback(palette);
        };
        ipcRenderer.on('theme-updated', listener);
        return () => {
            ipcRenderer.removeListener('theme-updated', listener);
        };
    },

    // Shell Window Actions
    newChat: (target?: WindowTarget) => ipcRenderer.invoke('new-chat', target),
    reloadGemini: (target?: WindowTarget) => ipcRenderer.invoke('reload-gemini', target),
    openSettings: () => ipcRenderer.invoke('open-settings'),
    toggleQuickAlwaysOnTop: () => ipcRenderer.invoke('toggle-quick-always-on-top'),
    onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings) => {
            callback(settings);
        };
        ipcRenderer.on('settings-updated', listener);
        return () => {
            ipcRenderer.removeListener('settings-updated', listener);
        };
    },
});
