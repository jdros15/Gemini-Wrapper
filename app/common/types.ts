export interface AppSettings {
    quickWindowHotkey: string;
    newChatHotkey: string;
    runOnStartup: boolean;
    quickWindowAlwaysOnTop: boolean;
    quickWindowBounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    startMinimized: boolean;
    autoResetTimer: number; // in minutes
    saveLocation?: string;
    askEverytime: boolean;
    notificationClickAction: 'openFile' | 'openFolder';
}

export interface IElectronAPI {
    getSettings: () => Promise<AppSettings>;
    updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
    resizeWindow: (height: number) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
    setShortcutsEnabled: (enabled: boolean) => Promise<void>;
    minimizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    selectDirectory: () => Promise<string | undefined>;
}

declare global {
    interface Window {
        electron: IElectronAPI;
    }
}
