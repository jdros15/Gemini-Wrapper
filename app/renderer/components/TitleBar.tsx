import React from 'react';

interface TitleBarProps {
    title?: string;
    onOptionsClick: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ title = 'Google Gemini', onOptionsClick }) => {
    const handleMinimize = () => {
        window.electron.minimizeWindow();
    };

    const handleClose = () => {
        window.electron.closeWindow();
    };

    return (
        <div style={{
            height: '32px',
            backgroundColor: '#131314', // Match app background
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            WebkitAppRegion: 'drag', // Allow dragging
            borderBottom: '1px solid #444746',
            userSelect: 'none'
        } as React.CSSProperties}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="./icon.png" alt="" style={{ width: '16px', height: '16px' }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#E3E3E3' }}>{title}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button
                    onClick={onOptionsClick}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#A8C7FA',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 199, 250, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    Options
                </button>

                <div style={{ width: '1px', height: '16px', background: '#444746', margin: '0 4px' }} />

                <button
                    onClick={handleMinimize}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#E3E3E3',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
                </button>

                <button
                    onClick={handleClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#E3E3E3',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#E81123';
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#E3E3E3';
                    }}
                >
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" /></svg>
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
