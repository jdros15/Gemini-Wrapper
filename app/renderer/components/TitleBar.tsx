import React, { useEffect, useState } from 'react';
import { AppSettings, GeminiThemePalette, WindowTarget } from '../../common/types';
import './TitleBar.css';

interface TitleBarProps {
    mode: WindowTarget;
    palette: GeminiThemePalette;
}

const TitleBar: React.FC<TitleBarProps> = ({ mode }) => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [reloading, setReloading] = useState(false);

    useEffect(() => {
        window.electron.getSettings().then(setSettings).catch(() => {});
        const unsubscribe = window.electron.onSettingsUpdated(setSettings);
        return () => unsubscribe?.();
    }, []);

    const handleNewChat = () => {
        window.electron.newChat(mode);
    };

    const handleReload = () => {
        setReloading(true);
        window.electron.reloadGemini(mode);
        setTimeout(() => setReloading(false), 600);
    };

    const handleOpenSettings = () => {
        window.electron.openSettings();
    };

    const handleTogglePin = async () => {
        const nextVal = await window.electron.toggleQuickAlwaysOnTop();
        setSettings((prev) => (prev ? { ...prev, quickWindowAlwaysOnTop: nextVal } : prev));
    };

    const isQuick = mode === 'quick';
    const isPinned = settings?.quickWindowAlwaysOnTop ?? true;
    const newChatHint = settings?.newChatHotkey ? `New Chat (${settings.newChatHotkey})` : 'New Chat';

    return (
        <header className={`shell-titlebar ${isQuick ? 'is-quick' : ''}`}>
            <div className="shell-brand">
                <span className="shell-sparkle" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <defs>
                            <linearGradient id="shellGeminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="var(--gem-gradient-start)" />
                                <stop offset="100%" stopColor="var(--gem-gradient-end)" />
                            </linearGradient>
                        </defs>
                        <path
                            d="M12 2C12.7 7.1 16.9 11.3 22 12C16.9 12.7 12.7 16.9 12 22C11.3 16.9 7.1 12.7 2 12C7.1 11.3 11.3 7.1 12 2Z"
                            fill="url(#shellGeminiGrad)"
                        />
                    </svg>
                </span>
                <span className="shell-title">{isQuick ? 'Quick Gemini' : 'Gemini'}</span>
                {isQuick && isPinned && (
                    <span className="shell-pill-tag" title="Always on top is enabled">
                        Pinned
                    </span>
                )}
            </div>

            <div className="shell-actions">
                <button
                    type="button"
                    className="shell-btn shell-btn-newchat"
                    onClick={handleNewChat}
                    title={newChatHint}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="shell-btn-label">New chat</span>
                </button>

                {isQuick && (
                    <button
                        type="button"
                        className={`shell-icon-btn ${isPinned ? 'is-active' : ''}`}
                        onClick={handleTogglePin}
                        title={isPinned ? 'Unpin from top' : 'Pin always on top'}
                        aria-label="Toggle always on top"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 17v5" />
                            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                        </svg>
                    </button>
                )}

                <button
                    type="button"
                    className={`shell-icon-btn ${reloading ? 'is-spinning' : ''}`}
                    onClick={handleReload}
                    title="Reload Gemini (Ctrl+R)"
                    aria-label="Reload Gemini"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                        <path d="M21 3v6h-6" />
                    </svg>
                </button>

                <button
                    type="button"
                    className="shell-icon-btn"
                    onClick={handleOpenSettings}
                    title="Settings (Ctrl+,)"
                    aria-label="Open settings"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>
            </div>
        </header>
    );
};

export default TitleBar;
