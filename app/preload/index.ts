import { contextBridge, ipcRenderer, shell } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),
    resizeWindow: (height: number) => ipcRenderer.invoke('resize-window', height),
    openExternal: (url: string) => shell.openExternal(url),
    setShortcutsEnabled: (enabled: boolean) => ipcRenderer.invoke('set-shortcuts-enabled', enabled),
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),

    closeWindow: () => ipcRenderer.invoke('close-window'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
});
