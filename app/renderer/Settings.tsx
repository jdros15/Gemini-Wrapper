import React, { useEffect, useState } from 'react';
import { AppSettings } from '../common/types';
import './Settings.css';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null);
    const [status, setStatus] = useState<string>('');
    const [saveLocationError, setSaveLocationError] = useState<boolean>(false);

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

        // Clear error if user checks "Ask everytime" again
        if (key === 'askEverytime' && value === true) {
            setSaveLocationError(false);
            setStatus('');
        }
    };

    const handleSave = () => {
        if (!settings) return;

        // Validate: if askEverytime is false, saveLocation must be set
        if (!settings.askEverytime && !settings.saveLocation) {
            setStatus('Error: Please select a save location');
            setSaveLocationError(true);
            return;
        }

        setSaveLocationError(false);

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

            <div className="settings-content">
                <div className="settings-column">
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
                </div>

                <div className="settings-column">
                    <div className="checkbox-group" onClick={() => handleChange('quickWindowAlwaysOnTop', !settings.quickWindowAlwaysOnTop)}>
                        <input
                            type="checkbox"
                            checked={settings.quickWindowAlwaysOnTop}
                            onChange={() => { }} // Handled by parent div
                            id="alwaysOnTop"
                        />
                        <label htmlFor="alwaysOnTop" style={{ cursor: 'pointer' }}>Quick Window Always on Top</label>
                    </div>

                    <div className="checkbox-group" onClick={() => handleChange('askEverytime', !settings.askEverytime)}>
                        <input
                            type="checkbox"
                            checked={settings.askEverytime}
                            onChange={() => { }}
                            id="askEverytime"
                        />
                        <label htmlFor="askEverytime" style={{ cursor: 'pointer' }}>Ask for save location every time</label>
                    </div>

                    {!settings.askEverytime && (
                        <div className="setting-group">
                            <label>Default Save Location</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    value={settings.saveLocation || ''}
                                    readOnly
                                    placeholder="Select a directory..."
                                    style={{
                                        flex: 1,
                                        borderColor: saveLocationError ? '#F2B8B5' : undefined,
                                        borderWidth: saveLocationError ? '2px' : undefined
                                    }}
                                />
                                <button className="browse-button" onClick={() => {
                                    window.electron.selectDirectory().then((path) => {
                                        if (path) {
                                            handleChange('saveLocation', path);
                                            setSaveLocationError(false);
                                            setStatus('');
                                        }
                                    });
                                }}>Browse</button>
                            </div>
                        </div>
                    )}

                    <div className="setting-group">
                        <label>Notification Behavior</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="checkbox-group" onClick={() => handleChange('notificationClickAction', 'openFile')}>
                                <input
                                    type="radio"
                                    name="notificationAction"
                                    checked={settings.notificationClickAction === 'openFile'}
                                    onChange={() => { }}
                                />
                                <label style={{ cursor: 'pointer' }}>Open image</label>
                            </div>
                            <div className="checkbox-group" onClick={() => handleChange('notificationClickAction', 'openFolder')}>
                                <input
                                    type="radio"
                                    name="notificationAction"
                                    checked={settings.notificationClickAction === 'openFolder'}
                                    onChange={() => { }}
                                />
                                <label style={{ cursor: 'pointer' }}>Open folder</label>
                            </div>
                        </div>
                    </div>
                </div>
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
