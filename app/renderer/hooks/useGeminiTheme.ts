import { useCallback, useEffect, useState } from 'react';
import { GeminiThemePalette } from '../../common/types';
import { applyPaletteToDocument, DEFAULT_DARK_PALETTE } from '../../common/theme';

export function useGeminiTheme() {
    const [palette, setPalette] = useState<GeminiThemePalette>(() => {
        applyPaletteToDocument(DEFAULT_DARK_PALETTE);
        return DEFAULT_DARK_PALETTE;
    });
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        let active = true;

        window.electron?.getTheme().then((initial) => {
            if (active && initial) {
                applyPaletteToDocument(initial);
                setPalette(initial);
            }
        }).catch(() => {});

        const unsubscribe = window.electron?.onThemeUpdated((nextPalette) => {
            if (active && nextPalette) {
                applyPaletteToDocument(nextPalette);
                setPalette(nextPalette);
            }
        });

        return () => {
            active = false;
            unsubscribe?.();
        };
    }, []);

    const syncNow = useCallback(async () => {
        if (!window.electron?.syncTheme) return;
        setIsSyncing(true);
        try {
            const updated = await window.electron.syncTheme();
            if (updated) {
                applyPaletteToDocument(updated);
                setPalette(updated);
            }
        } finally {
            setTimeout(() => setIsSyncing(false), 350);
        }
    }, []);

    return { palette, isSyncing, syncNow };
}
