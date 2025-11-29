import React, { useEffect, useState } from 'react';
import { AppSettings } from '../common/types';
import './Settings.css';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null);
    const [status, setStatus] = useState<string>('');

    useEffect(() => {
        window.electron.getSettings().then((data) => {
            setSettings(data);
            setOriginalSettings(data);
        });
    }, []);

    useEffect(() => {
        // Auto-resize window to fit content
        // Measure the container height instead of body to avoid infinite growth
        const container = document.querySelector('.settings-container');
        if (container) {
            const height = container.scrollHeight;
            window.electron.resizeWindow(height);
        }
    }, [settings, status]); // Resize when settings load or status changes

    const handleChange = (key: keyof AppSettings, value: any) => {
        if (!settings) return;
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
    };

    const handleSave = () => {
        if (!settings) return;
        window.electron.updateSettings(settings)
            .then((updated) => {
                setSettings(updated);
                setOriginalSettings(updated);
                setStatus('Saved!');
            })
            .catch((err) => setStatus('Error saving: ' + err));

        setTimeout(() => setStatus(''), 2000);
    };

    const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);

    const handleKeyDown = (e: React.KeyboardEvent, key: keyof AppSettings) => {
        e.preventDefault();
        e.stopPropagation();

        const modifiers = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.metaKey) modifiers.push('Command'); // Mac support (though we're on Windows)
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        let keyName = e.key;

        // Ignore modifier-only presses
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(keyName)) return;

        // Normalize key names
        if (keyName === ' ') keyName = 'Space';
        if (keyName.length === 1) keyName = keyName.toUpperCase();
        if (keyName === 'ArrowUp') keyName = 'Up';
        if (keyName === 'ArrowDown') keyName = 'Down';
        if (keyName === 'ArrowLeft') keyName = 'Left';
        if (keyName === 'ArrowRight') keyName = 'Right';

        const accelerator = [...modifiers, keyName].join('+');
        handleChange(key, accelerator);
    };

    const handleInputFocus = () => {
        window.electron.setShortcutsEnabled(false);
    };

    const handleInputBlur = () => {
        window.electron.setShortcutsEnabled(true);
    };

    // Ensure shortcuts are re-enabled if component unmounts
    useEffect(() => {
        return () => {
            window.electron.setShortcutsEnabled(true);
        };
    }, []);

    if (!settings) return <div>Loading...</div>;

    return (
        <div className="settings-container">
            <h1>Settings</h1>

            <div className="setting-group">
                <label>Quick Window Hotkey</label>
                <input
                    type="text"
                    value={settings.quickWindowHotkey}
                    onKeyDown={(e) => handleKeyDown(e, 'quickWindowHotkey')}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    readOnly
                    placeholder="Click to record..."
                />
                <div className="hint">Click and press keys (e.g. Alt+G)</div>
            </div>

            <div className="setting-group">
                <label>New Chat Hotkey</label>
                <input
                    type="text"
                    value={settings.newChatHotkey}
                    onKeyDown={(e) => handleKeyDown(e, 'newChatHotkey')}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    readOnly
                    placeholder="Click to record..."
                />
                <div className="hint">Click and press keys (e.g. Ctrl+N)</div>
            </div>

            <div className="setting-group">
                <label>Auto-Reset Timer (Minutes)</label>
                <input
                    type="text"
                    value={settings.autoResetTimer}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handleChange('autoResetTimer', val);
                    }}
                    placeholder="5"
                />
                <div className="hint">Reset chat if hidden for this long</div>
            </div>

            <div className="checkbox-group" onClick={() => handleChange('runOnStartup', !settings.runOnStartup)}>
                <input
                    type="checkbox"
                    checked={settings.runOnStartup}
                    onChange={() => { }} // Handled by parent div
                    id="runOnStartup"
                />
                <label htmlFor="runOnStartup" style={{ cursor: 'pointer' }}>Run on Startup</label>
            </div>

            <div
                className="checkbox-group"
                onClick={() => settings.runOnStartup && handleChange('startMinimized', !settings.startMinimized)}
                style={{ opacity: settings.runOnStartup ? 1 : 0.5, cursor: settings.runOnStartup ? 'pointer' : 'not-allowed' }}
            >
                <input
                    type="checkbox"
                    checked={settings.startMinimized}
                    onChange={() => { }} // Handled by parent div
                    id="startMinimized"
                    disabled={!settings.runOnStartup}
                />
                <label htmlFor="startMinimized" style={{ cursor: settings.runOnStartup ? 'pointer' : 'not-allowed' }}>Start Minimized</label>
            </div>

            <div className="checkbox-group" onClick={() => handleChange('quickWindowAlwaysOnTop', !settings.quickWindowAlwaysOnTop)}>
                <input
                    type="checkbox"
                    checked={settings.quickWindowAlwaysOnTop}
                    onChange={() => { }} // Handled by parent div
                    id="alwaysOnTop"
                />
                <label htmlFor="alwaysOnTop" style={{ cursor: 'pointer' }}>Quick Window Always on Top</label>
            </div>

            <button
                className="save-button"
                onClick={handleSave}
                disabled={!isDirty}
                style={{ opacity: isDirty ? 1 : 0.5, cursor: isDirty ? 'pointer' : 'default' }}
            >
                Save
            </button>

            {status && (
                <div className={`status-message ${status ? 'visible' : ''} ${status.startsWith('Error') ? 'error' : 'success'}`}>
                    {status}
                </div>
            )}
        </div>
    );
};

export default Settings;
