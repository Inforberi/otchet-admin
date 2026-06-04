const AUTOSAVE_ENABLED_KEY = 'report-editor:autosave-enabled';
const AUTOSAVE_INTERVAL_KEY = 'report-editor:autosave-interval-ms';

export const AUTOSAVE_INTERVAL_OPTIONS = [
    { ms: 30_000, label: '30 сек' },
    { ms: 60_000, label: '1 мин' },
    { ms: 120_000, label: '2 мин' },
    { ms: 300_000, label: '5 мин' },
] as const;

export const DEFAULT_AUTOSAVE_INTERVAL_MS = 60_000;

const isValidInterval = (ms: number): boolean =>
    AUTOSAVE_INTERVAL_OPTIONS.some((opt) => opt.ms === ms);

export const getAutosaveIntervalMs = (): number => {
    if (typeof window === 'undefined') return DEFAULT_AUTOSAVE_INTERVAL_MS;

    const storedInterval = localStorage.getItem(AUTOSAVE_INTERVAL_KEY);
    if (storedInterval !== null) {
        const parsed = Number(storedInterval);
        if (parsed === 0) return 0;
        if (isValidInterval(parsed)) return parsed;
    }

    const legacyEnabled = localStorage.getItem(AUTOSAVE_ENABLED_KEY);
    if (legacyEnabled === '0') return 0;

    return DEFAULT_AUTOSAVE_INTERVAL_MS;
};

export const setAutosaveIntervalMs = (ms: number): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTOSAVE_INTERVAL_KEY, String(ms));
    localStorage.setItem(AUTOSAVE_ENABLED_KEY, ms > 0 ? '1' : '0');
};

export const getAutosaveEnabled = (): boolean => getAutosaveIntervalMs() > 0;

export const setAutosaveEnabled = (enabled: boolean): void => {
    if (enabled) {
        const current = getAutosaveIntervalMs();
        setAutosaveIntervalMs(current > 0 ? current : DEFAULT_AUTOSAVE_INTERVAL_MS);
    } else {
        setAutosaveIntervalMs(0);
    }
};
