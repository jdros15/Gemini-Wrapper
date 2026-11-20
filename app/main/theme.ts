import { app, BrowserWindow, nativeTheme, WebContents } from 'electron';
import fs from 'fs';
import path from 'path';
import { GeminiThemePalette } from '../common/types';
import {
    buildHarmonizedPalette,
    DEFAULT_DARK_PALETTE,
    DEFAULT_LIGHT_PALETTE,
    palettesVisuallyEqual,
    RawExtractedColors,
} from '../common/theme';

const THEME_CACHE_PATH = path.join(app.getPath('userData'), 'theme-cache.json');

/**
 * Self-contained browser-side extractor injected into Gemini's WebContents.
 * Uses a 3-layer future-proof strategy:
 *   1. Canvas 2D color normalization (resolves oklch, color-mix, srgb, hsl, hex, rgb to exact rgba).
 *   2. Dynamic CSS Custom Property discovery (known Material 3 / Gemini tokens + fuzzy future token names).
 *   3. Computed-style live DOM sampling (works even if Google removes or renames all CSS variables).
 */
const EXTRACT_GEMINI_PALETTE_SCRIPT = `
(function() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function resolveColor(val) {
      if (!val || typeof val !== 'string') return null;
      const trimmed = val.trim();
      if (!trimmed || trimmed === 'transparent' || trimmed === 'none' || trimmed === 'inherit' || trimmed === 'initial') {
        return null;
      }
      if (!ctx) return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillStyle = trimmed;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      const a = data[3] / 255;
      if (a < 0.04) return null;
      return {
        r: data[0],
        g: data[1],
        b: data[2],
        a,
        css: a >= 0.99 ? ('rgb(' + data[0] + ', ' + data[1] + ', ' + data[2] + ')')
                       : ('rgba(' + data[0] + ', ' + data[1] + ', ' + data[2] + ', ' + a.toFixed(3) + ')')
      };
    }

    function luminance(c) {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }

    function contrast(c1, c2) {
      const l1 = luminance(c1);
      const l2 = luminance(c2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    function saturation(c) {
      const r = c.r / 255, g = c.g / 255, b = c.b / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max === min) return 0;
      const l = (max + min) / 2;
      const d = max - min;
      return l > 0.5 ? d / (2 - max - min) : d / (max + min);
    }

    const rootEl = document.documentElement;
    const bodyEl = document.body;
    if (!bodyEl) return null;

    const rootStyle = getComputedStyle(rootEl);
    const bodyStyle = getComputedStyle(bodyEl);

    function getVar(names) {
      for (const name of names) {
        const v1 = bodyStyle.getPropertyValue(name);
        if (v1 && v1.trim()) {
          const parsed = resolveColor(v1);
          if (parsed) return parsed;
        }
        const v2 = rootStyle.getPropertyValue(name);
        if (v2 && v2.trim()) {
          const parsed = resolveColor(v2);
          if (parsed) return parsed;
        }
      }
      return null;
    }

    // Collect dynamically discovered CSS custom property names from accessible stylesheets
    const discoveredVars = new Set();
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch (e) {
          continue;
        }
        if (!rules) continue;
        const limit = Math.min(rules.length, 400);
        for (let i = 0; i < limit; i++) {
          const rule = rules[i];
          if (rule && rule.style) {
            for (let j = 0; j < rule.style.length; j++) {
              const prop = rule.style[j];
              if (prop && prop.startsWith('--') && /(color|surface|primary|outline|accent|error|bard|gem|gm\\d|md-sys)/i.test(prop)) {
                discoveredVars.add(prop);
              }
            }
          }
        }
      }
    } catch (e) {}

    function findDynamicVar(regex) {
      for (const prop of discoveredVars) {
        if (regex.test(prop)) {
          const parsed = getVar([prop]);
          if (parsed) return parsed;
        }
      }
      return null;
    }

    // --- LAYER 1: Known & Dynamic Material 3 / Gemini CSS Variables ---
    let varHits = 0;
    function pickVar(known, dynamicRegex) {
      const c = getVar(known) || (dynamicRegex ? findDynamicVar(dynamicRegex) : null);
      if (c) varHits++;
      return c;
    }

    const varBg = pickVar(
      [
        '--gem-sys-color--surface',
        '--gm3-sys-color-surface',
        '--gm3-sys-color-background',
        '--md-sys-color-surface',
        '--md-sys-color-background',
        '--bard-color-surface',
        '--mat-sys-surface',
        '--mat-sys-background',
      ],
      /^--[a-z0-9-]+-(?:sys-color--?|color-)(?:surface|background)$/i
    );

    const varSurface = pickVar(
      [
        '--gem-sys-color--surface-container',
        '--gm3-sys-color-surface-container',
        '--md-sys-color-surface-container',
        '--gem-sys-color--surface-container-low',
        '--gm3-sys-color-surface-container-low',
        '--bard-color-surface-container',
        '--mat-sys-surface-container',
      ],
      /^--[a-z0-9-]+-surface-container(?:-low)?$/i
    );

    const varSurfaceElevated = pickVar(
      [
        '--gem-sys-color--surface-container-high',
        '--gm3-sys-color-surface-container-high',
        '--md-sys-color-surface-container-high',
        '--gem-sys-color--surface-container-highest',
        '--gm3-sys-color-surface-container-highest',
        '--mat-sys-surface-container-high',
      ],
      /^--[a-z0-9-]+-surface-container-high(?:est)?$/i
    );

    const varTextPrimary = pickVar(
      [
        '--gem-sys-color--on-surface',
        '--gm3-sys-color-on-surface',
        '--md-sys-color-on-surface',
        '--bard-color-on-surface',
        '--mat-sys-on-surface',
      ],
      /^--[a-z0-9-]+-on-surface$/i
    );

    const varTextSecondary = pickVar(
      [
        '--gem-sys-color--on-surface-variant',
        '--gm3-sys-color-on-surface-variant',
        '--md-sys-color-on-surface-variant',
        '--bard-color-on-surface-variant',
        '--mat-sys-on-surface-variant',
      ],
      /^--[a-z0-9-]+-on-surface-variant$/i
    );

    const varAccent = pickVar(
      [
        '--gem-sys-color--primary',
        '--gm3-sys-color-primary',
        '--md-sys-color-primary',
        '--bard-color-primary',
        '--mat-sys-primary',
      ],
      /^--[a-z0-9-]+-(?:sys-color--?|color-)primary$/i
    );

    const varOnAccent = pickVar(
      [
        '--gem-sys-color--on-primary',
        '--gm3-sys-color-on-primary',
        '--md-sys-color-on-primary',
        '--mat-sys-on-primary',
      ],
      /^--[a-z0-9-]+-on-primary$/i
    );

    const varBorder = pickVar(
      [
        '--gem-sys-color--outline-variant',
        '--gm3-sys-color-outline-variant',
        '--md-sys-color-outline-variant',
        '--gem-sys-color--outline',
        '--gm3-sys-color-outline',
        '--md-sys-color-outline',
        '--mat-sys-outline-variant',
      ],
      /^--[a-z0-9-]+-outline(?:-variant)?$/i
    );

    const varDanger = pickVar(
      [
        '--gem-sys-color--error',
        '--gm3-sys-color-error',
        '--md-sys-color-error',
        '--mat-sys-error',
      ],
      /^--[a-z0-9-]+-(?:sys-color--?|color-)error$/i
    );

    // --- LAYER 2: Live Rendered DOM Sampling ---
    function sampleBackdrop() {
      const candidates = [
        document.querySelector('chat-app'),
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
        bodyEl,
        rootEl,
      ];
      for (const el of candidates) {
        if (!el) continue;
        const c = resolveColor(getComputedStyle(el).backgroundColor);
        if (c && c.a >= 0.9) return c;
      }
      return null;
    }

    const domBg = sampleBackdrop();
    const effectiveBg = domBg || varBg;

    // Sample top bar area for seamless titlebar blending
    let domTitleBarBg = effectiveBg;
    try {
      const topEl = document.elementFromPoint(Math.floor(window.innerWidth * 0.5), 20);
      let curr = topEl;
      while (curr && curr !== rootEl) {
        const c = resolveColor(getComputedStyle(curr).backgroundColor);
        if (c && c.a >= 0.9) {
          domTitleBarBg = c;
          break;
        }
        curr = curr.parentElement;
      }
    } catch (e) {}

    // Sample surfaces (sidebar, prompt box, chips)
    const surfaceCandidates = [];
    const surfaceSelectors = [
      'bard-sidenav',
      'side-navigation-content',
      'nav',
      'aside',
      'input-area-v2',
      '.input-area',
      '.input-area-container',
      'rich-textarea',
      '[contenteditable="true"]',
      'textarea',
      'button',
    ];
    for (const sel of surfaceSelectors) {
      const els = document.querySelectorAll(sel);
      for (let i = 0; i < Math.min(els.length, 10); i++) {
        let el = els[i];
        // For text inputs, also check their immediate container
        for (let depth = 0; depth < 2 && el; depth++) {
          const rect = el.getBoundingClientRect();
          if (rect.width >= 40 && rect.height >= 24) {
            const c = resolveColor(getComputedStyle(el).backgroundColor);
            if (c && c.a >= 0.85 && effectiveBg) {
              const lumDiff = Math.abs(luminance(c) - luminance(effectiveBg));
              const rgbDist = Math.hypot(c.r - effectiveBg.r, c.g - effectiveBg.g, c.b - effectiveBg.b);
              if ((lumDiff >= 0.003 || rgbDist >= 8) && lumDiff <= 0.25 && saturation(c) < 0.35) {
                surfaceCandidates.push({ color: c, lumDiff, area: rect.width * rect.height });
              }
            }
          }
          el = el.parentElement;
        }
      }
    }
    surfaceCandidates.sort((a, b) => a.lumDiff - b.lumDiff);
    const domSurface = surfaceCandidates.length > 0 ? surfaceCandidates[0].color : null;
    const domSurfaceElevated = surfaceCandidates.length > 1
      ? surfaceCandidates[surfaceCandidates.length - 1].color
      : null;

    // Sample text colors
    let domTextPrimary = null;
    let domTextSecondary = null;
    const bodyTextColor = resolveColor(bodyStyle.color);
    if (bodyTextColor && effectiveBg && contrast(bodyTextColor, effectiveBg) >= 5.5) {
      domTextPrimary = bodyTextColor;
    }

    const textEls = document.querySelectorAll('h1, h2, p, span, button, textarea, [contenteditable="true"]');
    const textSamples = [];
    for (let i = 0; i < Math.min(textEls.length, 80); i++) {
      const el = textEls[i];
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (!el.textContent || !el.textContent.trim()) continue;
      const c = resolveColor(getComputedStyle(el).color);
      if (c && effectiveBg && saturation(c) < 0.25) {
        const cr = contrast(c, effectiveBg);
        if (cr >= 3.2) {
          textSamples.push({ color: c, cr });
        }
      }
    }
    textSamples.sort((a, b) => b.cr - a.cr);
    if (!domTextPrimary && textSamples.length > 0) {
      domTextPrimary = textSamples[0].color;
    }
    if (textSamples.length > 1) {
      const secondary = textSamples.find((s) => s.cr >= 4.0 && s.cr < (domTextPrimary ? contrast(domTextPrimary, effectiveBg) - 1.5 : 10));
      if (secondary) domTextSecondary = secondary.color;
    }

    // Sample borders
    let domBorder = null;
    const borderEls = document.querySelectorAll('input-area-v2, .input-area, .input-area-container, button, textarea, [role="textbox"]');
    for (let i = 0; i < Math.min(borderEls.length, 30); i++) {
      const st = getComputedStyle(borderEls[i]);
      if (parseFloat(st.borderTopWidth) >= 0.5) {
        const c = resolveColor(st.borderTopColor);
        if (c && effectiveBg) {
          const cr = contrast(c, effectiveBg);
          if (cr >= 1.25 && cr <= 4.2 && saturation(c) < 0.35) {
            domBorder = c;
            break;
          }
        }
      }
    }

    // Sample accent & brand gradient from SVG stops, gradient text, links, primary buttons
    let gradientStart = null;
    let gradientEnd = null;
    const accentCandidates = [];

    // 1) Check CSS linear-gradient on headings/greeting text
    const gradEls = document.querySelectorAll('h1, h2, [class*="gradient"], [class*="hello"], [class*="greeting"], [class*="brand"]');
    for (let i = 0; i < Math.min(gradEls.length, 25); i++) {
      const bgImg = getComputedStyle(gradEls[i]).backgroundImage;
      if (bgImg && bgImg.includes('gradient')) {
        const matches = bgImg.match(/(?:rgba?\\([^)]+\\)|#[0-9a-fA-F]{3,8}|oklch\\([^)]+\\)|hsl\\([^)]+\\))/g);
        if (matches && matches.length >= 2) {
          const c1 = resolveColor(matches[0]);
          const c2 = resolveColor(matches[matches.length - 1]);
          if (c1 && saturation(c1) > 0.25) {
            gradientStart = c1;
            accentCandidates.push({ color: c1, score: saturation(c1) * 3 });
          }
          if (c2 && saturation(c2) > 0.25) {
            gradientEnd = c2;
          }
          if (gradientStart && gradientEnd) break;
        }
      }
    }

    // 2) Check SVG linearGradient stops (Gemini sparkle icon)
    if (!gradientStart || !gradientEnd) {
      const svgGrads = document.querySelectorAll('svg linearGradient, svg radialGradient');
      for (let i = 0; i < Math.min(svgGrads.length, 15); i++) {
        const stops = svgGrads[i].querySelectorAll('stop');
        const stopColors = [];
        for (const stop of Array.from(stops)) {
          const st = getComputedStyle(stop);
          const c = resolveColor(st.stopColor || stop.getAttribute('stop-color'));
          if (c && saturation(c) > 0.28) stopColors.push(c);
        }
        if (stopColors.length >= 2) {
          if (!gradientStart) gradientStart = stopColors[0];
          if (!gradientEnd) gradientEnd = stopColors[stopColors.length - 1];
          accentCandidates.push({ color: stopColors[0], score: saturation(stopColors[0]) * 2.5 });
          break;
        }
      }
    }

    // 3) Check chromatic colors on interactive controls / headings
    const interactiveEls = document.querySelectorAll('a, button, h1, [role="button"], [aria-selected="true"]');
    for (let i = 0; i < Math.min(interactiveEls.length, 60); i++) {
      const el = interactiveEls[i];
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const st = getComputedStyle(el);
      const textC = resolveColor(st.color);
      const bgC = resolveColor(st.backgroundColor);
      for (const c of [bgC, textC]) {
        if (!c || !effectiveBg) continue;
        const sat = saturation(c);
        const cr = contrast(c, effectiveBg);
        if (sat >= 0.35 && cr >= 2.8) {
          accentCandidates.push({ color: c, score: sat * Math.min(cr, 7) });
        }
      }
    }
    accentCandidates.sort((a, b) => b.score - a.score);
    const domAccent = accentCandidates.length > 0 ? accentCandidates[0].color : null;

    const finalBg = domBg || varBg;
    if (!finalBg) return null;

    return {
      source: varHits >= 3 ? 'live-css-vars' : 'live-dom',
      bg: finalBg.css,
      titleBarBg: (domTitleBarBg || finalBg).css,
      surface: (varSurface || domSurface)?.css,
      surfaceElevated: (varSurfaceElevated || domSurfaceElevated)?.css,
      surfaceInput: (domSurface || varSurface)?.css,
      textPrimary: (varTextPrimary || domTextPrimary)?.css,
      textSecondary: (varTextSecondary || domTextSecondary)?.css,
      accent: (varAccent || domAccent)?.css,
      onAccent: varOnAccent?.css,
      border: (varBorder || domBorder)?.css,
      danger: varDanger?.css,
      gradientStart: gradientStart?.css,
      gradientEnd: gradientEnd?.css,
    };
  } catch (err) {
    return null;
  }
})();
`;

const THEME_FINGERPRINT_SCRIPT = `
(function() {
  try {
    const html = document.documentElement;
    const body = document.body;
    if (!body) return '';
    const bs = getComputedStyle(body);
    const rs = getComputedStyle(html);
    return [
      bs.backgroundColor,
      bs.color,
      rs.backgroundColor,
      body.className || '',
      html.className || '',
      html.getAttribute('data-theme') || '',
      rs.getPropertyValue('--gm3-sys-color-surface').trim(),
      rs.getPropertyValue('--gm3-sys-color-primary').trim(),
      rs.getPropertyValue('--gem-sys-color--surface').trim(),
      rs.getPropertyValue('--gem-sys-color--primary').trim(),
    ].join('|');
  } catch (e) {
    return '';
  }
})();
`;

type ThemeListener = (palette: GeminiThemePalette) => void;

class ThemeManager {
    private palette: GeminiThemePalette;
    private trackedGeminiViews = new Set<WebContents>();
    private listeners = new Set<ThemeListener>();
    private lastFingerprint = '';
    private pollTimer: NodeJS.Timeout | null = null;
    private isExtracting = false;

    constructor() {
        this.palette = this.loadCachedPalette();

        nativeTheme.on('updated', () => {
            // Delay slightly so Gemini's prefers-color-scheme styles update first
            setTimeout(() => {
                this.syncFromActiveGemini().catch(() => {});
            }, 450);
        });
    }

    private loadCachedPalette(): GeminiThemePalette {
        try {
            if (fs.existsSync(THEME_CACHE_PATH)) {
                const raw = JSON.parse(fs.readFileSync(THEME_CACHE_PATH, 'utf-8'));
                if (raw && typeof raw.bg === 'string' && typeof raw.accent === 'string') {
                    return {
                        ...(raw.mode === 'light' ? DEFAULT_LIGHT_PALETTE : DEFAULT_DARK_PALETTE),
                        ...raw,
                        source: 'cached',
                    };
                }
            }
        } catch (err) {
            console.warn('Could not load cached Gemini palette:', err);
        }
        return nativeTheme.shouldUseDarkColors
            ? { ...DEFAULT_DARK_PALETTE }
            : { ...DEFAULT_LIGHT_PALETTE };
    }

    private saveCachedPalette(palette: GeminiThemePalette): void {
        try {
            fs.writeFileSync(THEME_CACHE_PATH, JSON.stringify(palette, null, 2));
        } catch (err) {
            console.warn('Could not persist Gemini palette cache:', err);
        }
    }

    public getPalette(): GeminiThemePalette {
        return this.palette;
    }

    public onUpdate(listener: ThemeListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public attachToGeminiWebContents(webContents: WebContents): void {
        this.trackedGeminiViews.add(webContents);

        const scheduleSync = () => {
            if (webContents.isDestroyed()) return;
            setTimeout(() => this.extractFromWebContents(webContents), 650);
            setTimeout(() => this.extractFromWebContents(webContents), 2200);
        };

        webContents.on('did-finish-load', scheduleSync);
        webContents.on('did-navigate-in-page', () => {
            setTimeout(() => this.extractFromWebContents(webContents), 500);
        });

        webContents.once('destroyed', () => {
            this.trackedGeminiViews.delete(webContents);
            if (this.trackedGeminiViews.size === 0 && this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        });

        this.ensureWatcherRunning();
    }

    private ensureWatcherRunning(): void {
        if (this.pollTimer) return;
        // Ultra-lightweight fingerprint check every 2.5s only while an app window is visible
        this.pollTimer = setInterval(async () => {
            const anyVisible = BrowserWindow.getAllWindows().some(
                (w) => !w.isDestroyed() && w.isVisible()
            );
            if (!anyVisible) return;

            const wc = this.pickBestGeminiWebContents();
            if (!wc) return;

            try {
                const url = wc.getURL();
                if (!url.startsWith('https://gemini.google.com')) return;
                const fp: string = await wc.executeJavaScript(THEME_FINGERPRINT_SCRIPT, true);
                if (fp && fp !== this.lastFingerprint) {
                    this.lastFingerprint = fp;
                    await this.extractFromWebContents(wc);
                }
            } catch {
                // Page may be navigating or loading
            }
        }, 2500);
    }

    private pickBestGeminiWebContents(): WebContents | null {
        const live = Array.from(this.trackedGeminiViews).filter((wc) => !wc.isDestroyed());
        if (live.length === 0) return null;

        // Prefer a Gemini view currently on gemini.google.com
        const onGemini = live.find((wc) => wc.getURL().startsWith('https://gemini.google.com'));
        return onGemini || live[0];
    }

    public async syncFromActiveGemini(force = false): Promise<GeminiThemePalette> {
        const wc = this.pickBestGeminiWebContents();
        if (!wc) return this.palette;
        return this.extractFromWebContents(wc, force);
    }

    public async extractFromWebContents(
        webContents: WebContents,
        force = false
    ): Promise<GeminiThemePalette> {
        if (this.isExtracting || webContents.isDestroyed()) {
            return this.palette;
        }

        const currentUrl = webContents.getURL();
        if (!currentUrl || !currentUrl.startsWith('https://gemini.google.com')) {
            return this.palette;
        }

        this.isExtracting = true;
        try {
            const raw = (await webContents.executeJavaScript(
                EXTRACT_GEMINI_PALETTE_SCRIPT,
                true
            )) as RawExtractedColors | null;

            if (!raw || !raw.bg) {
                return this.palette;
            }

            const nextPalette = buildHarmonizedPalette(raw, Date.now());
            const visuallyChanged = !palettesVisuallyEqual(this.palette, nextPalette);
            const sourceUpgraded =
                (this.palette.source === 'default' || this.palette.source === 'cached') &&
                (nextPalette.source === 'live-css-vars' || nextPalette.source === 'live-dom');

            if (force || visuallyChanged || sourceUpgraded) {
                this.palette = nextPalette;
                this.saveCachedPalette(nextPalette);
                this.broadcast(nextPalette);
            }

            return this.palette;
        } catch (err) {
            console.warn('Gemini theme extraction skipped:', err);
            return this.palette;
        } finally {
            this.isExtracting = false;
        }
    }

    private broadcast(palette: GeminiThemePalette): void {
        for (const listener of this.listeners) {
            try {
                listener(palette);
            } catch (err) {
                console.error('Theme listener error:', err);
            }
        }

        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
                try {
                    win.setBackgroundColor(palette.bg);
                    win.webContents.send('theme-updated', palette);
                } catch {
                    // Ignore transient window destruction
                }
            }
        }
    }
}

export const themeManager = new ThemeManager();
