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
    autoResetTimer: number; // in minutes (0 = disabled)
    saveLocation?: string;
    askEverytime: boolean;
    notificationClickAction: 'openFile' | 'openFolder';
}

export type ThemeMode = 'dark' | 'light';
export type ThemeSource = 'live-css-vars' | 'live-dom' | 'cached' | 'default';

export interface GeminiThemePalette {
    mode: ThemeMode;
    source: ThemeSource;
    updatedAt: number;
    bg: string;
    surface: string;
    surfaceElevated: string;
    surfaceInput: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    accentSoft: string;
    onAccent: string;
    border: string;
    borderSubtle: string;
    danger: string;
    dangerSoft: string;
    success: string;
    successSoft: string;
    titleBarBg: string;
    titleBarSymbol: string;
    gradientStart: string;
    gradientEnd: string;
}

export type WindowTarget = 'main' | 'quick';

export interface IElectronAPI {
    getSettings: () => Promise<AppSettings>;
    updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
    resizeWindow: (height: number) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
    setShortcutsEnabled: (enabled: boolean) => Promise<void>;
    minimizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    selectDirectory: () => Promise<string | undefined>;
    // Live Gemini Theme API
    getTheme: () => Promise<GeminiThemePalette>;
    syncTheme: () => Promise<GeminiThemePalette>;
    onThemeUpdated: (callback: (palette: GeminiThemePalette) => void) => () => void;
    // Shell Window Actions
    newChat: (target?: WindowTarget) => Promise<void>;
    reloadGemini: (target?: WindowTarget) => Promise<void>;
    openSettings: () => Promise<void>;
    toggleQuickAlwaysOnTop: () => Promise<boolean>;
    onSettingsUpdated: (callback: (settings: AppSettings) => void) => () => void;
}

declare global {
    interface Window {
        electron: IElectronAPI;
    }
}
