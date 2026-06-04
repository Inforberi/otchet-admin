'use client';

import { Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AUTOSAVE_INTERVAL_OPTIONS,
    DEFAULT_AUTOSAVE_INTERVAL_MS,
} from '@/lib/report-editor-preferences';

type ReportAutosaveControlProps = {
    intervalMs: number;
    onIntervalChange: (ms: number) => void;
};

export function ReportAutosaveControl({
    intervalMs,
    onIntervalChange,
}: ReportAutosaveControlProps) {
    const enabled = intervalMs > 0;
    const selectValue = enabled ? String(intervalMs) : String(DEFAULT_AUTOSAVE_INTERVAL_MS);

    const handleToggle = (checked: boolean) => {
        if (checked) {
            onIntervalChange(
                intervalMs > 0 ? intervalMs : DEFAULT_AUTOSAVE_INTERVAL_MS
            );
        } else {
            onIntervalChange(0);
        }
    };

    const handleIntervalSelect = (value: string) => {
        onIntervalChange(Number(value));
    };

    return (
        <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-800/40 px-3 py-1.5">
            <Clock className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            <label className="inline-flex cursor-pointer items-center gap-2 select-none">
                <Switch
                    checked={enabled}
                    onCheckedChange={handleToggle}
                    aria-label="Автосохранение"
                />
                <span className="text-sm text-zinc-300">Автосохранение</span>
            </label>
            <Select
                value={selectValue}
                onValueChange={handleIntervalSelect}
                disabled={!enabled}
            >
                <SelectTrigger
                    size="sm"
                    className="h-8 min-w-[5.5rem] border-zinc-600 bg-zinc-800/80 text-zinc-200 disabled:opacity-50"
                    aria-label="Интервал автосохранения"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
                    {AUTOSAVE_INTERVAL_OPTIONS.map((opt) => (
                        <SelectItem
                            key={opt.ms}
                            value={String(opt.ms)}
                            className="focus:bg-zinc-800 focus:text-zinc-100"
                        >
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
