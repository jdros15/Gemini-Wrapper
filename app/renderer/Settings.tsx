import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppSettings, GeminiThemePalette } from '../common/types';
import './Settings.css';

type SettingsTab = 'general' | 'shortcuts' | 'downloads' | 'appearance';

interface SettingsProps {
    palette: GeminiThemePalette;
    isSyncing: boolean;
    onSyncTheme: () => Promise<void>;
}

const TIMER_PRESETS = [
    { label: 'Off', value: 0 },
    { label: '5m', value: 5 },
    { label: '15m', value: 15 },
    { label: '30m', value: 30 },
    { label: '60m', value: 60 },
];

const SOURCE_LABELS: Record<GeminiThemePalette['source'], string> = {
    'live-css-vars': 'Live Gemini CSS Tokens',
    'live-dom': 'Live Gemini DOM Sampling',
    cached: 'Cached Gemini Palette',
    default: 'Default Gemini Palette',
};

const Settings: React.FC<SettingsProps> = ({ palette, isSyncing, onSyncTheme }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null);
    const [timerDraft, setTimerDraft] = useState<string>('5');
    const [recordingField, setRecordingField] = useState<'quickWindowHotkey' | 'newChatHotkey' | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [saveLocationError, setSaveLocationError] = useState<boolean>(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const statusTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        window.electron.getSettings().then((data) => {
            setSettings(data);
            setOriginalSettings(data);
            setTimerDraft(String(data.autoResetTimer));
        });

        const unsubscribe = window.electron.onSettingsUpdated((updated) => {
            setOriginalSettings(updated);
            setSettings((prev) => {
                if (!prev) return updated;
                // Keep unsaved edits intact, except sync external quickWindowAlwaysOnTop toggle
                return { ...prev, quickWindowAlwaysOnTop: updated.quickWindowAlwaysOnTop };
            });
        });

        return () => {
            unsubscribe?.();
            window.electron.setShortcutsEnabled(true);
            if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
        };
    }, []);

    const showStatus = (type: 'success' | 'error', text: string, durationMs = 2600) => {
        if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
        setStatus({ type, text });
        if (durationMs > 0) {
            statusTimeoutRef.current = window.setTimeout(() => setStatus(null), durationMs);
        }
    };

    const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings((prev) => {
            if (!prev) return prev;
            return { ...prev, [key]: value };
        });

        if (key === 'askEverytime' && value === true) {
            setSaveLocationError(false);
            setStatus(null);
        }
    };

    const handleTimerSelect = (minutes: number) => {
        setTimerDraft(String(minutes));
        handleChange('autoResetTimer', minutes);
    };

    const handleTimerInputChange = (rawValue: string) => {
        const cleaned = rawValue.replace(/[^\d.]/g, '');
        setTimerDraft(cleaned);
        if (cleaned === '') {
            handleChange('autoResetTimer', 0);
            return;
        }
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed) && parsed >= 0) {
            handleChange('autoResetTimer', parsed);
        }
    };

    const handleDiscard = () => {
        if (!originalSettings) return;
        setSettings(originalSettings);
        setTimerDraft(String(originalSettings.autoResetTimer));
        setSaveLocationError(false);
        setStatus(null);
    };

    const handleSave = () => {
        if (!settings) return;

        if (!settings.askEverytime && !settings.saveLocation) {
            setActiveTab('downloads');
            setSaveLocationError(true);
            showStatus('error', 'Select a default save folder first', 3500);
            return;
        }

        setSaveLocationError(false);

        window.electron.updateSettings(settings)
            .then((updated) => {
                setSettings(updated);
                setOriginalSettings(updated);
                setTimerDraft(String(updated.autoResetTimer));
                showStatus('success', 'Settings saved');
            })
            .catch((err) => {
                showStatus('error', `Failed to save: ${String(err)}`, 4000);
            });
    };

    const isDirty = useMemo(() => {
        if (!settings || !originalSettings) return false;
        return JSON.stringify(settings) !== JSON.stringify(originalSettings);
    }, [settings, originalSettings]);

    const startRecording = (field: 'quickWindowHotkey' | 'newChatHotkey') => {
        setRecordingField(field);
        window.electron.setShortcutsEnabled(false);
    };

    const stopRecording = () => {
        setRecordingField(null);
        window.electron.setShortcutsEnabled(true);
    };

    const handleHotkeyKeyDown = (
        e: React.KeyboardEvent<HTMLButtonElement>,
        field: 'quickWindowHotkey' | 'newChatHotkey'
    ) => {
        if (recordingField !== field) return;
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
            stopRecording();
            return;
        }

        const modifiers: string[] = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.metaKey) modifiers.push('Command');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        let keyName = e.key;
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(keyName)) return;

        if (keyName === ' ') keyName = 'Space';
        if (keyName.length === 1) keyName = keyName.toUpperCase();
        if (keyName === 'ArrowUp') keyName = 'Up';
        if (keyName === 'ArrowDown') keyName = 'Down';
        if (keyName === 'ArrowLeft') keyName = 'Left';
        if (keyName === 'ArrowRight') keyName = 'Right';

        const accelerator = [...modifiers, keyName].join('+');
        handleChange(field, accelerator);
        stopRecording();
    };

    const handleCopyHex = (label: string, value: string) => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopiedKey(label);
        window.setTimeout(() => setCopiedKey((curr) => (curr === label ? null : curr)), 1400);
    };

    const formatLastSynced = (timestamp: number) => {
        if (!timestamp) return 'Waiting for Gemini window';
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const swatches = useMemo(() => ([
        { label: 'Background', hex: palette.bg },
        { label: 'Surface', hex: palette.surface },
        { label: 'Elevated', hex: palette.surfaceElevated },
        { label: 'Accent', hex: palette.accent },
        { label: 'Primary Text', hex: palette.textPrimary },
        { label: 'Border', hex: palette.border },
    ]), [palette]);

    const isLive = palette.source === 'live-css-vars' || palette.source === 'live-dom';

    if (!settings) {
        return (
            <div className="settings-shell settings-loading">
                <div className="loading-spinner" />
                <span>Loading preferences...</span>
            </div>
        );
    }

    const renderKeycaps = (shortcut: string) => {
        const parts = shortcut.split('+').filter(Boolean);
        return (
            <span className="keycap-group">
                {parts.map((part, idx) => (
                    <React.Fragment key={`${part}-${idx}`}>
                        {idx > 0 && <span className="keycap-plus">+</span>}
                        <kbd className="keycap">{part}</kbd>
                    </React.Fragment>
                ))}
            </span>
        );
    };

    return (
        <div className="settings-shell">
            {/* Custom Frameless Drag Header */}
            <header className="settings-topbar">
                <div className="topbar-brand">
                    <span className="topbar-emblem" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <defs>
                                <linearGradient id="settingsGeminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="var(--gem-gradient-start)" />
                                    <stop offset="100%" stopColor="var(--gem-gradient-end)" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M12 2C12.7 7.1 16.9 11.3 22 12C16.9 12.7 12.7 16.9 12 22C11.3 16.9 7.1 12.7 2 12C7.1 11.3 11.3 7.1 12 2Z"
                                fill="url(#settingsGeminiGrad)"
                            />
                        </svg>
                    </span>
                    <div className="topbar-titles">
                        <span className="topbar-title">Settings</span>
                        <span className="topbar-subtitle">Google Gemini Desktop</span>
                    </div>
                </div>

                <div className="topbar-controls">
                    <button
                        type="button"
                        className="theme-pill"
                        onClick={() => setActiveTab('appearance')}
                        title="View live synced Gemini color palette"
                    >
                        <span className={`theme-pill-dot ${isLive ? 'is-live' : ''}`} />
                        <span>{isLive ? 'Auto-Synced' : 'Cached'} · {palette.mode === 'dark' ? 'Dark' : 'Light'}</span>
                    </button>

                    <button
                        type="button"
                        className="window-close-btn"
                        onClick={() => window.electron.closeWindow()}
                        aria-label="Close settings"
                        title="Close"
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                            <path d="M2 2l8 8M10 2l-8 8" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Split Workspace */}
            <div className="settings-workspace">
                {/* Left Navigation Rail */}
                <aside className="settings-nav">
                    <nav className="nav-list" aria-label="Settings categories">
                        <button
                            type="button"
                            className={`nav-item ${activeTab === 'general' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('general')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                            </svg>
                            <span>General</span>
                        </button>

                        <button
                            type="button"
                            className={`nav-item ${activeTab === 'shortcuts' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('shortcuts')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="5" width="20" height="14" rx="2.5" />
                                <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 15h8M6 12h.01M10 12h.01M14 12h.01M18 12h.01" />
                            </svg>
                            <span>Shortcuts</span>
                        </button>

                        <button
                            type="button"
                            className={`nav-item ${activeTab === 'downloads' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('downloads')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span>Downloads</span>
                        </button>

                        <button
                            type="button"
                            className={`nav-item ${activeTab === 'appearance' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('appearance')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.68 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z" />
                            </svg>
                            <span>Appearance</span>
                        </button>
                    </nav>

                    <div className="nav-footer">
                        <div className="mini-palette-strip" title="Live Gemini palette swatches">
                            <span style={{ background: palette.bg }} />
                            <span style={{ background: palette.surface }} />
                            <span style={{ background: palette.accent }} />
                            <span style={{ background: `linear-gradient(135deg, ${palette.gradientStart}, ${palette.gradientEnd})` }} />
                        </div>
                        <span className="nav-version">Gemini Wrapper v1.1.0</span>
                    </div>
                </aside>

                {/* Main Content Panel */}
                <main className="settings-main">
                    {activeTab === 'general' && (
                        <div className="tab-pane">
                            <div className="pane-header">
                                <h2>General</h2>
                                <p>Control startup behavior, floating window pinning, and session hygiene.</p>
                            </div>

                            <section className="settings-card">
                                <div className="card-row clickable" onClick={() => handleChange('runOnStartup', !settings.runOnStartup)}>
                                    <div className="row-copy">
                                        <span className="row-title">Launch on Windows startup</span>
                                        <span className="row-desc">Start Gemini Wrapper automatically when you sign in</span>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.runOnStartup}
                                        className={`toggle-switch ${settings.runOnStartup ? 'is-on' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleChange('runOnStartup', !settings.runOnStartup);
                                        }}
                                    >
                                        <span className="toggle-thumb" />
                                    </button>
                                </div>

                                <div className="card-divider" />

                                <div
                                    className={`card-row ${settings.runOnStartup ? 'clickable' : 'is-disabled'}`}
                                    onClick={() => settings.runOnStartup && handleChange('startMinimized', !settings.startMinimized)}
                                >
                                    <div className="row-copy">
                                        <span className="row-title">Start minimized to tray</span>
                                        <span className="row-desc">Keep the window hidden on launch until summoned by hotkey or tray</span>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.startMinimized}
                                        disabled={!settings.runOnStartup}
                                        className={`toggle-switch ${settings.startMinimized ? 'is-on' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (settings.runOnStartup) {
                                                handleChange('startMinimized', !settings.startMinimized);
                                            }
                                        }}
                                    >
                                        <span className="toggle-thumb" />
                                    </button>
                                </div>
                            </section>

                            <section className="settings-card">
                                <div
                                    className="card-row clickable"
                                    onClick={() => handleChange('quickWindowAlwaysOnTop', !settings.quickWindowAlwaysOnTop)}
                                >
                                    <div className="row-copy">
                                        <span className="row-title">Quick Window always on top</span>
                                        <span className="row-desc">Float the compact Quick Gemini window above other desktop apps</span>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.quickWindowAlwaysOnTop}
                                        className={`toggle-switch ${settings.quickWindowAlwaysOnTop ? 'is-on' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleChange('quickWindowAlwaysOnTop', !settings.quickWindowAlwaysOnTop);
                                        }}
                                    >
                                        <span className="toggle-thumb" />
                                    </button>
                                </div>
                            </section>

                            <section className="settings-card">
                                <div className="card-block">
                                    <div className="row-copy">
                                        <span className="row-title">Auto-reset idle session</span>
                                        <span className="row-desc">Start a fresh Gemini chat if a window stays hidden longer than this</span>
                                    </div>
                                    <div className="timer-controls">
                                        <div className="preset-pills">
                                            {TIMER_PRESETS.map((preset) => (
                                                <button
                                                    key={preset.value}
                                                    type="button"
                                                    className={`preset-pill ${settings.autoResetTimer === preset.value ? 'is-selected' : ''}`}
                                                    onClick={() => handleTimerSelect(preset.value)}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="custom-minutes-box">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                className="modern-input compact"
                                                value={timerDraft}
                                                onChange={(e) => handleTimerInputChange(e.target.value)}
                                                aria-label="Custom auto-reset minutes"
                                            />
                                            <span className="unit-label">min</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'shortcuts' && (
                        <div className="tab-pane">
                            <div className="pane-header">
                                <h2>Keyboard Shortcuts</h2>
                                <p>Click any shortcut below and press your desired key combination. Press Esc to cancel.</p>
                            </div>

                            <section className="settings-card">
                                <div className="card-row">
                                    <div className="row-copy">
                                        <span className="row-title">Toggle Quick Window</span>
                                        <span className="row-desc">Global shortcut available from anywhere on Windows</span>
                                    </div>
                                    <button
                                        type="button"
                                        className={`hotkey-recorder ${recordingField === 'quickWindowHotkey' ? 'is-recording' : ''}`}
                                        onClick={() => startRecording('quickWindowHotkey')}
                                        onKeyDown={(e) => handleHotkeyKeyDown(e, 'quickWindowHotkey')}
                                        onBlur={() => recordingField === 'quickWindowHotkey' && stopRecording()}
                                    >
                                        {recordingField === 'quickWindowHotkey' ? (
                                            <span className="recording-prompt">Press keys...</span>
                                        ) : (
                                            renderKeycaps(settings.quickWindowHotkey)
                                        )}
                                    </button>
                                </div>

                                <div className="card-divider" />

                                <div className="card-row">
                                    <div className="row-copy">
                                        <span className="row-title">New Chat</span>
                                        <span className="row-desc">Starts a clean conversation in the active Gemini window</span>
                                    </div>
                                    <button
                                        type="button"
                                        className={`hotkey-recorder ${recordingField === 'newChatHotkey' ? 'is-recording' : ''}`}
                                        onClick={() => startRecording('newChatHotkey')}
                                        onKeyDown={(e) => handleHotkeyKeyDown(e, 'newChatHotkey')}
                                        onBlur={() => recordingField === 'newChatHotkey' && stopRecording()}
                                    >
                                        {recordingField === 'newChatHotkey' ? (
                                            <span className="recording-prompt">Press keys...</span>
                                        ) : (
                                            renderKeycaps(settings.newChatHotkey)
                                        )}
                                    </button>
                                </div>
                            </section>

                            <div className="info-banner">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <span>Global shortcuts are temporarily paused while recording so your keystrokes are captured cleanly.</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'downloads' && (
                        <div className="tab-pane">
                            <div className="pane-header">
                                <h2>Downloads</h2>
                                <p>Manage where watermark-free generated images are saved and how notifications behave.</p>
                            </div>

                            <section className="settings-card">
                                <div
                                    className="card-row clickable"
                                    onClick={() => handleChange('askEverytime', !settings.askEverytime)}
                                >
                                    <div className="row-copy">
                                        <span className="row-title">Ask where to save every time</span>
                                        <span className="row-desc">Show the Windows save dialog before each download</span>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.askEverytime}
                                        className={`toggle-switch ${settings.askEverytime ? 'is-on' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleChange('askEverytime', !settings.askEverytime);
                                        }}
                                    >
                                        <span className="toggle-thumb" />
                                    </button>
                                </div>

                                {!settings.askEverytime && (
                                    <>
                                        <div className="card-divider" />
                                        <div className="card-block">
                                            <div className="row-copy">
                                                <span className="row-title">Default save folder</span>
                                                <span className="row-desc">Downloaded images will be saved automatically to this folder</span>
                                            </div>
                                            <div className="path-picker-row">
                                                <input
                                                    type="text"
                                                    className={`modern-input path-input ${saveLocationError ? 'has-error' : ''}`}
                                                    value={settings.saveLocation || ''}
                                                    readOnly
                                                    placeholder="No folder selected..."
                                                />
                                                <button
                                                    type="button"
                                                    className="tonal-button"
                                                    onClick={() => {
                                                        window.electron.selectDirectory().then((selected) => {
                                                            if (selected) {
                                                                handleChange('saveLocation', selected);
                                                                setSaveLocationError(false);
                                                                setStatus(null);
                                                            }
                                                        });
                                                    }}
                                                >
                                                    Browse
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </section>

                            <section className="settings-card">
                                <div className="card-block">
                                    <div className="row-copy">
                                        <span className="row-title">Notification click action</span>
                                        <span className="row-desc">Choose what happens when you click a completed download notification</span>
                                    </div>

                                    <div className="segmented-control" role="radiogroup" aria-label="Notification click action">
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={settings.notificationClickAction === 'openFile'}
                                            className={`segment-btn ${settings.notificationClickAction === 'openFile' ? 'is-active' : ''}`}
                                            onClick={() => handleChange('notificationClickAction', 'openFile')}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                <polyline points="21 15 16 10 5 21" />
                                            </svg>
                                            <span>Open image</span>
                                        </button>
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={settings.notificationClickAction === 'openFolder'}
                                            className={`segment-btn ${settings.notificationClickAction === 'openFolder' ? 'is-active' : ''}`}
                                            onClick={() => handleChange('notificationClickAction', 'openFolder')}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                            </svg>
                                            <span>Open folder</span>
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="tab-pane">
                            <div className="pane-header">
                                <h2>Adaptive Gemini Theme</h2>
                                <p>Colors are copied automatically from your live Gemini page so this wrapper stays matched even if Google changes Gemini&apos;s palette.</p>
                            </div>

                            <section className="palette-hero-card">
                                <div className="palette-hero-info">
                                    <div className="palette-badge-row">
                                        <span className={`sync-badge ${isLive ? 'is-live' : ''}`}>
                                            <span className="sync-dot" />
                                            {SOURCE_LABELS[palette.source]}
                                        </span>
                                        <span className="mode-badge">
                                            {palette.mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                                        </span>
                                    </div>
                                    <span className="palette-timestamp">
                                        Last synced: {formatLastSynced(palette.updatedAt)}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className={`sync-now-btn ${isSyncing ? 'is-syncing' : ''}`}
                                    onClick={onSyncTheme}
                                    disabled={isSyncing}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                                        <path d="M21 3v6h-6" />
                                    </svg>
                                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                                </button>
                            </section>

                            <section className="settings-card">
                                <div className="card-block">
                                    <div className="swatch-header">
                                        <span className="row-title">Extracted Palette Tokens</span>
                                        <span className="row-desc">Click any swatch to copy its hex value</span>
                                    </div>
                                    <div className="swatch-grid">
                                        {swatches.map((swatch) => (
                                            <button
                                                key={swatch.label}
                                                type="button"
                                                className="swatch-tile"
                                                onClick={() => handleCopyHex(swatch.label, swatch.hex)}
                                                title={`Copy ${swatch.hex}`}
                                            >
                                                <span className="swatch-chip" style={{ backgroundColor: swatch.hex }} />
                                                <span className="swatch-meta">
                                                    <span className="swatch-name">{swatch.label}</span>
                                                    <span className="swatch-hex">
                                                        {copiedKey === swatch.label ? 'Copied!' : swatch.hex}
                                                    </span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="gradient-preview-bar">
                                        <span
                                            className="gradient-pill"
                                            style={{
                                                background: `linear-gradient(90deg, ${palette.gradientStart}, ${palette.gradientEnd})`,
                                            }}
                                        />
                                        <div className="gradient-meta">
                                            <span className="swatch-name">Brand Accent Gradient</span>
                                            <span className="swatch-hex">{palette.gradientStart} → {palette.gradientEnd}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="info-banner">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
                                </svg>
                                <span>Hybrid extraction inspects Gemini&apos;s Material CSS variables first and falls back to live rendered DOM sampling with automatic WCAG contrast harmonization.</span>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Bottom Action Footer */}
            <footer className="settings-footer">
                <div className="footer-status">
                    {status ? (
                        <span className={`status-pill is-${status.type}`}>
                            {status.type === 'success' ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            )}
                            <span>{status.text}</span>
                        </span>
                    ) : isDirty ? (
                        <span className="dirty-indicator">
                            <span className="dirty-dot" />
                            Unsaved changes
                        </span>
                    ) : (
                        <span className="footer-hint">All changes synced</span>
                    )}
                </div>

                <div className="footer-actions">
                    {isDirty && (
                        <button type="button" className="ghost-button" onClick={handleDiscard}>
                            Discard
                        </button>
                    )}
                    <button
                        type="button"
                        className="primary-button"
                        onClick={handleSave}
                        disabled={!isDirty}
                    >
                        Save Changes
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default Settings;
