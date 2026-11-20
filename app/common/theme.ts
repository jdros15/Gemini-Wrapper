import { GeminiThemePalette, ThemeMode, ThemeSource } from './types';

export interface RGB {
    r: number;
    g: number;
    b: number;
    a?: number;
}

export interface RawExtractedColors {
    bg?: string;
    titleBarBg?: string;
    surface?: string;
    surfaceElevated?: string;
    surfaceInput?: string;
    textPrimary?: string;
    textSecondary?: string;
    accent?: string;
    onAccent?: string;
    border?: string;
    danger?: string;
    gradientStart?: string;
    gradientEnd?: string;
    source: ThemeSource;
}

export const DEFAULT_DARK_PALETTE: GeminiThemePalette = {
    mode: 'dark',
    source: 'default',
    updatedAt: 0,
    bg: '#131314',
    surface: '#1E1F20',
    surfaceElevated: '#282A2C',
    surfaceInput: '#1E1F20',
    textPrimary: '#E3E3E3',
    textSecondary: '#C4C7C5',
    textMuted: '#8E918F',
    accent: '#A8C7FA',
    accentHover: '#8AB4F8',
    accentSoft: 'rgba(168, 199, 250, 0.14)',
    onAccent: '#062E6F',
    border: '#444746',
    borderSubtle: 'rgba(227, 227, 227, 0.10)',
    danger: '#F2B8B5',
    dangerSoft: 'rgba(242, 184, 181, 0.14)',
    success: '#81C995',
    successSoft: 'rgba(129, 201, 149, 0.14)',
    titleBarBg: '#131314',
    titleBarSymbol: '#E3E3E3',
    gradientStart: '#4285F4',
    gradientEnd: '#9B72CB',
};

export const DEFAULT_LIGHT_PALETTE: GeminiThemePalette = {
    mode: 'light',
    source: 'default',
    updatedAt: 0,
    bg: '#FFFFFF',
    surface: '#F0F4F9',
    surfaceElevated: '#E4EAF2',
    surfaceInput: '#F0F4F9',
    textPrimary: '#1F1F1F',
    textSecondary: '#444746',
    textMuted: '#747775',
    accent: '#0B57D0',
    accentHover: '#0842A0',
    accentSoft: 'rgba(11, 87, 208, 0.10)',
    onAccent: '#FFFFFF',
    border: '#C4C7C5',
    borderSubtle: 'rgba(31, 31, 31, 0.10)',
    danger: '#B3261E',
    dangerSoft: 'rgba(179, 38, 30, 0.10)',
    success: '#146C2E',
    successSoft: 'rgba(20, 108, 46, 0.10)',
    titleBarBg: '#FFFFFF',
    titleBarSymbol: '#1F1F1F',
    gradientStart: '#4285F4',
    gradientEnd: '#9B72CB',
};

function clampByte(n: number): number {
    return Math.max(0, Math.min(255, Math.round(n)));
}

export function parseColor(input?: string | null): RGB | null {
    if (!input || typeof input !== 'string') return null;
    const str = input.trim();
    if (!str || str === 'transparent' || str === 'none') return null;

    if (str.startsWith('#')) {
        const hex = str.slice(1);
        if (hex.length === 3) {
            return {
                r: parseInt(hex[0] + hex[0], 16),
                g: parseInt(hex[1] + hex[1], 16),
                b: parseInt(hex[2] + hex[2], 16),
                a: 1,
            };
        }
        if (hex.length === 6 || hex.length === 8) {
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16),
                a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
            };
        }
        return null;
    }

    const rgbMatch = str.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
    if (rgbMatch) {
        let alpha = 1;
        if (rgbMatch[4] !== undefined) {
            alpha = rgbMatch[4].endsWith('%')
                ? parseFloat(rgbMatch[4]) / 100
                : parseFloat(rgbMatch[4]);
        }
        return {
            r: clampByte(parseFloat(rgbMatch[1])),
            g: clampByte(parseFloat(rgbMatch[2])),
            b: clampByte(parseFloat(rgbMatch[3])),
            a: Math.max(0, Math.min(1, alpha)),
        };
    }

    return null;
}

export function toHex(rgb: RGB): string {
    const r = clampByte(rgb.r).toString(16).padStart(2, '0');
    const g = clampByte(rgb.g).toString(16).padStart(2, '0');
    const b = clampByte(rgb.b).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
}

export function toRgba(rgb: RGB, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${clampByte(rgb.r)}, ${clampByte(rgb.g)}, ${clampByte(rgb.b)}, ${Number(a.toFixed(3))})`;
}

export function compositeOver(fg: RGB, bg: RGB): RGB {
    const a = fg.a ?? 1;
    if (a >= 0.999) return { r: fg.r, g: fg.g, b: fg.b, a: 1 };
    return {
        r: clampByte(fg.r * a + bg.r * (1 - a)),
        g: clampByte(fg.g * a + bg.g * (1 - a)),
        b: clampByte(fg.b * a + bg.b * (1 - a)),
        a: 1,
    };
}

export function getRelativeLuminance(rgb: RGB): number {
    const normalize = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * normalize(rgb.r) + 0.7152 * normalize(rgb.g) + 0.0722 * normalize(rgb.b);
}

export function getContrastRatio(c1: RGB, c2: RGB): number {
    const l1 = getRelativeLuminance(c1);
    const l2 = getRelativeLuminance(c2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

export function mixColors(c1: RGB, c2: RGB, weight = 0.5): RGB {
    const w = Math.max(0, Math.min(1, weight));
    return {
        r: clampByte(c1.r * (1 - w) + c2.r * w),
        g: clampByte(c1.g * (1 - w) + c2.g * w),
        b: clampByte(c1.b * (1 - w) + c2.b * w),
        a: 1,
    };
}

export function getSaturation(rgb: RGB): number {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;
    const l = (max + min) / 2;
    const d = max - min;
    return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

function rgbToHsl(rgb: RGB): { h: number; s: number; l: number } {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            default:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): RGB {
    const hue = ((h % 1) + 1) % 1;
    const sat = Math.max(0, Math.min(1, s));
    const lig = Math.max(0, Math.min(1, l));

    if (sat === 0) {
        const v = clampByte(lig * 255);
        return { r: v, g: v, b: v, a: 1 };
    }

    const hue2rgb = (p: number, q: number, t: number) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };

    const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
    const p = 2 * lig - q;

    return {
        r: clampByte(hue2rgb(p, q, hue + 1 / 3) * 255),
        g: clampByte(hue2rgb(p, q, hue) * 255),
        b: clampByte(hue2rgb(p, q, hue - 1 / 3) * 255),
        a: 1,
    };
}

export function shiftHueAndLightness(rgb: RGB, hueDelta: number, lightnessDelta: number): RGB {
    const hsl = rgbToHsl(rgb);
    return hslToRgb(hsl.h + hueDelta, hsl.s, Math.max(0.08, Math.min(0.92, hsl.l + lightnessDelta)));
}

function ensureReadableColor(candidate: RGB | null, bg: RGB, minRatio: number, fallback: RGB): RGB {
    if (candidate && getContrastRatio(candidate, bg) >= minRatio) {
        return candidate;
    }
    return fallback;
}

export function buildHarmonizedPalette(raw: RawExtractedColors, updatedAt = Date.now()): GeminiThemePalette {
    const parsedBg = parseColor(raw.bg);
    const bgRgb: RGB = parsedBg && (parsedBg.a ?? 1) > 0.5
        ? { r: parsedBg.r, g: parsedBg.g, b: parsedBg.b, a: 1 }
        : parseColor(DEFAULT_DARK_PALETTE.bg)!;

    const isDark = getRelativeLuminance(bgRgb) < 0.42;
    const mode: ThemeMode = isDark ? 'dark' : 'light';
    const base = isDark ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE;
    const white: RGB = { r: 255, g: 255, b: 255, a: 1 };
    const black: RGB = { r: 10, g: 12, b: 16, a: 1 };

    // Resolve opaque surface colors harmonized with bg
    const resolveSurface = (colorStr: string | undefined, mixTarget: RGB, mixAmt: number): RGB => {
        const parsed = parseColor(colorStr);
        if (parsed && (parsed.a ?? 1) > 0.08) {
            const solid = compositeOver(parsed, bgRgb);
            const diff = Math.abs(getRelativeLuminance(solid) - getRelativeLuminance(bgRgb));
            const rgbDist = Math.hypot(solid.r - bgRgb.r, solid.g - bgRgb.g, solid.b - bgRgb.b);
            if ((diff >= 0.003 || rgbDist >= 8) && diff <= 0.35 && getSaturation(solid) < 0.45) {
                return solid;
            }
        }
        return mixColors(bgRgb, mixTarget, mixAmt);
    };

    const surfaceRgb = resolveSurface(raw.surface, isDark ? white : black, isDark ? 0.055 : 0.045);
    const surfaceElevatedRgb = resolveSurface(
        raw.surfaceElevated,
        isDark ? white : black,
        isDark ? 0.105 : 0.085
    );
    const surfaceInputRgb = resolveSurface(
        raw.surfaceInput,
        isDark ? white : black,
        isDark ? 0.075 : 0.055
    );

    // Ensure elevated is perceptibly distinct from surface
    const elevatedDist = Math.hypot(
        surfaceElevatedRgb.r - surfaceRgb.r,
        surfaceElevatedRgb.g - surfaceRgb.g,
        surfaceElevatedRgb.b - surfaceRgb.b
    );
    const finalSurfaceElevated =
        elevatedDist < 8
            ? mixColors(surfaceRgb, isDark ? white : black, isDark ? 0.06 : 0.05)
            : surfaceElevatedRgb;

    // Text colors with guaranteed WCAG readability
    const fallbackTextPrimary = parseColor(base.textPrimary)!;
    const fallbackTextSecondary = parseColor(base.textSecondary)!;

    const rawTextPrimary = parseColor(raw.textPrimary);
    const textPrimaryRgb = ensureReadableColor(
        rawTextPrimary ? compositeOver(rawTextPrimary, bgRgb) : null,
        bgRgb,
        7.0,
        fallbackTextPrimary
    );

    const rawTextSecondary = parseColor(raw.textSecondary);
    const textSecondaryRgb = ensureReadableColor(
        rawTextSecondary ? compositeOver(rawTextSecondary, bgRgb) : null,
        bgRgb,
        4.2,
        mixColors(textPrimaryRgb, bgRgb, 0.28)
    );

    const textMutedRgb = ensureReadableColor(
        mixColors(textSecondaryRgb, bgRgb, 0.32),
        bgRgb,
        2.8,
        fallbackTextSecondary
    );

    // Accent color
    const fallbackAccent = parseColor(base.accent)!;
    const rawAccent = parseColor(raw.accent);
    let accentRgb = fallbackAccent;
    if (rawAccent && (rawAccent.a ?? 1) > 0.5) {
        const solidAccent = compositeOver(rawAccent, bgRgb);
        if (getContrastRatio(solidAccent, bgRgb) >= 2.6 && getSaturation(solidAccent) >= 0.15) {
            accentRgb = solidAccent;
        }
    }

    const accentHoverRgb = shiftHueAndLightness(accentRgb, 0, isDark ? -0.07 : -0.06);

    // High contrast text on top of accent
    const rawOnAccent = parseColor(raw.onAccent);
    const darkOnAccent = shiftHueAndLightness(accentRgb, 0, -0.52);
    const bestOnAccentFallback =
        getContrastRatio(white, accentRgb) >= getContrastRatio(darkOnAccent, accentRgb)
            ? white
            : (getContrastRatio(darkOnAccent, accentRgb) >= 4.5 ? darkOnAccent : black);
    const onAccentRgb = ensureReadableColor(
        rawOnAccent ? compositeOver(rawOnAccent, accentRgb) : null,
        accentRgb,
        4.5,
        bestOnAccentFallback
    );

    // Borders
    const rawBorder = parseColor(raw.border);
    let borderRgb = mixColors(bgRgb, textPrimaryRgb, isDark ? 0.22 : 0.20);
    if (rawBorder && (rawBorder.a ?? 1) > 0.15) {
        const solidBorder = compositeOver(rawBorder, bgRgb);
        const contrast = getContrastRatio(solidBorder, bgRgb);
        if (contrast >= 1.25 && contrast <= 4.5) {
            borderRgb = solidBorder;
        }
    }

    // Danger & Success
    const fallbackDanger = parseColor(base.danger)!;
    const rawDanger = parseColor(raw.danger);
    const dangerRgb = ensureReadableColor(
        rawDanger ? compositeOver(rawDanger, bgRgb) : null,
        bgRgb,
        3.5,
        fallbackDanger
    );
    const successRgb = parseColor(base.success)!;

    // TitleBar background seamlessly matches Gemini's top area
    const rawTitleBg = parseColor(raw.titleBarBg);
    const titleBarBgRgb =
        rawTitleBg && (rawTitleBg.a ?? 1) > 0.85 && Math.abs(getRelativeLuminance(rawTitleBg) - getRelativeLuminance(bgRgb)) < 0.12
            ? { r: rawTitleBg.r, g: rawTitleBg.g, b: rawTitleBg.b, a: 1 }
            : bgRgb;
    const titleBarSymbolRgb = ensureReadableColor(textPrimaryRgb, titleBarBgRgb, 4.5, isDark ? white : black);

    // Brand gradient for sparkle/accents
    const rawGradStart = parseColor(raw.gradientStart);
    const rawGradEnd = parseColor(raw.gradientEnd);
    const gradientStartRgb =
        rawGradStart && getSaturation(rawGradStart) > 0.18
            ? rawGradStart
            : accentRgb;
    const rawEndDistinct =
        rawGradEnd &&
        getSaturation(rawGradEnd) > 0.18 &&
        Math.hypot(
            rawGradEnd.r - gradientStartRgb.r,
            rawGradEnd.g - gradientStartRgb.g,
            rawGradEnd.b - gradientStartRgb.b
        ) >= 35;
    const gradientEndRgb = rawEndDistinct
        ? rawGradEnd!
        : shiftHueAndLightness(gradientStartRgb, 0.14, isDark ? -0.04 : 0.04);

    return {
        mode,
        source: raw.source,
        updatedAt,
        bg: toHex(bgRgb),
        surface: toHex(surfaceRgb),
        surfaceElevated: toHex(finalSurfaceElevated),
        surfaceInput: toHex(surfaceInputRgb),
        textPrimary: toHex(textPrimaryRgb),
        textSecondary: toHex(textSecondaryRgb),
        textMuted: toHex(textMutedRgb),
        accent: toHex(accentRgb),
        accentHover: toHex(accentHoverRgb),
        accentSoft: toRgba(accentRgb, isDark ? 0.16 : 0.11),
        onAccent: toHex(onAccentRgb),
        border: toHex(borderRgb),
        borderSubtle: toRgba(textPrimaryRgb, isDark ? 0.09 : 0.10),
        danger: toHex(dangerRgb),
        dangerSoft: toRgba(dangerRgb, isDark ? 0.15 : 0.10),
        success: toHex(successRgb),
        successSoft: toRgba(successRgb, isDark ? 0.15 : 0.10),
        titleBarBg: toHex(titleBarBgRgb),
        titleBarSymbol: toHex(titleBarSymbolRgb),
        gradientStart: toHex(gradientStartRgb),
        gradientEnd: toHex(gradientEndRgb),
    };
}

export function palettesVisuallyEqual(a: GeminiThemePalette, b: GeminiThemePalette): boolean {
    return (
        a.mode === b.mode &&
        a.bg === b.bg &&
        a.surface === b.surface &&
        a.surfaceElevated === b.surfaceElevated &&
        a.textPrimary === b.textPrimary &&
        a.textSecondary === b.textSecondary &&
        a.accent === b.accent &&
        a.border === b.border &&
        a.titleBarBg === b.titleBarBg &&
        a.gradientStart === b.gradientStart &&
        a.gradientEnd === b.gradientEnd
    );
}

export function applyPaletteToDocument(palette: GeminiThemePalette): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = palette.mode;
    root.style.colorScheme = palette.mode;

    const vars: Record<string, string> = {
        '--gem-bg': palette.bg,
        '--gem-surface': palette.surface,
        '--gem-surface-elevated': palette.surfaceElevated,
        '--gem-surface-input': palette.surfaceInput,
        '--gem-text-primary': palette.textPrimary,
        '--gem-text-secondary': palette.textSecondary,
        '--gem-text-muted': palette.textMuted,
        '--gem-accent': palette.accent,
        '--gem-accent-hover': palette.accentHover,
        '--gem-accent-soft': palette.accentSoft,
        '--gem-on-accent': palette.onAccent,
        '--gem-border': palette.border,
        '--gem-border-subtle': palette.borderSubtle,
        '--gem-danger': palette.danger,
        '--gem-danger-soft': palette.dangerSoft,
        '--gem-success': palette.success,
        '--gem-success-soft': palette.successSoft,
        '--gem-titlebar-bg': palette.titleBarBg,
        '--gem-titlebar-symbol': palette.titleBarSymbol,
        '--gem-gradient-start': palette.gradientStart,
        '--gem-gradient-end': palette.gradientEnd,
    };

    for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(key, value);
    }
}
