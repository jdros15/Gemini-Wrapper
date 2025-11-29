import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { AppSettings } from '../common/types';

const settingsSchema = z.object({
    quickWindowHotkey: z.string().default('Alt+G'),
    newChatHotkey: z.string().default('Ctrl+N'),
    runOnStartup: z.boolean().default(true),
    quickWindowAlwaysOnTop: z.boolean().default(true),
    quickWindowBounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
    }).optional(),
    startMinimized: z.boolean().default(true),
    autoResetTimer: z.number().default(5),
});

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

export class SettingsManager {
    private settings: AppSettings;

    constructor() {
        this.settings = this.loadSettings();
    }

    private loadSettings(): AppSettings {
        try {
            if (fs.existsSync(SETTINGS_PATH)) {
                const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
                const parsed = JSON.parse(data);
                const result = settingsSchema.safeParse(parsed);
                if (result.success) {
                    return result.data;
                }
                console.error('Invalid settings file, using defaults:', result.error);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        return settingsSchema.parse({});
    }

    public get(): AppSettings {
        return this.settings;
    }

    public update(newSettings: Partial<AppSettings>): AppSettings {
        const merged = { ...this.settings, ...newSettings };
        const result = settingsSchema.safeParse(merged);

        if (result.success) {
            this.settings = result.data;
            this.save();
            return this.settings;
        } else {
            throw new Error('Invalid settings: ' + result.error.message);
        }
    }

    private save() {
        try {
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }
}

export const settingsManager = new SettingsManager();
