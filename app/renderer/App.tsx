import React, { useMemo } from 'react';
import Settings from './Settings';
import TitleBar from './components/TitleBar';
import { useGeminiTheme } from './hooks/useGeminiTheme';
import { WindowTarget } from '../common/types';

const App: React.FC = () => {
    const { palette, isSyncing, syncNow } = useGeminiTheme();

    const route = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view') || 'settings';
        const mode: WindowTarget = params.get('mode') === 'quick' ? 'quick' : 'main';
        return { view, mode };
    }, []);

    if (route.view === 'shell') {
        return <TitleBar mode={route.mode} palette={palette} />;
    }

    return <Settings palette={palette} isSyncing={isSyncing} onSyncTheme={syncNow} />;
};

export default App;
