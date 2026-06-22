'use client';

import { useEffect, useState } from 'react';
import { Calendar, EyeOff, Filter } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SettingToggleRow } from '@/components/ui/setting-toggle-row';
import type { ReportFromDB } from '@/lib/db-types';

type EditReportSettingsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    report: ReportFromDB | null;
    currentUserId?: string | null;
    onUpdated?: (report: ReportFromDB) => void | Promise<void>;
};

const stripHtml = (html: string) => {
    if (!html) return '';
    if (typeof window === 'undefined') {
        return html.replace(/<[^>]*>/g, '').trim();
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
};

export const EditReportSettingsDialog = ({
    open,
    onOpenChange,
    report,
    currentUserId,
    onUpdated,
}: EditReportSettingsDialogProps) => {
    const [date, setDate] = useState('');
    const [excludeFromDateFilter, setExcludeFromDateFilter] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !report) return;
        setDate(report.date || '');
        setExcludeFromDateFilter(Boolean(report.excludeFromDateFilter));
        setIsHidden(Boolean(report.isHidden));
    }, [open, report]);

    const canToggleHidden =
        Boolean(currentUserId) &&
        (!report?.createdByUserId || report.createdByUserId === currentUserId);

    const hideReportDescription = !report?.createdByUserId
        ? 'Отчёт без создателя — при скрытии вы станете владельцем'
        : 'Только вы и super admin (с флагом) увидите этот отчёт';

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;

        try {
            setSaving(true);
            const response = await fetch(`/api/reports/${report.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: date || null,
                    excludeFromDateFilter,
                    ...(canToggleHidden ? { isHidden } : {}),
                    expectedVersion: report.version,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'Ошибка сохранения');
                return;
            }

            const data = await response.json();
            onOpenChange(false);
            if (onUpdated) {
                await onUpdated(data.report);
            }
        } catch (error) {
            console.error('Error saving report settings:', error);
            alert('Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    if (!report) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] text-[var(--color-grayscale-3)] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Настройки отчёта</DialogTitle>
                    <DialogDescription className="text-[var(--color-grayscale-6)]">
                        «{stripHtml(report.title)}»
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                            Дата
                        </label>
                        <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-grayscale-6)]" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] py-2 pl-10 pr-3 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <SettingToggleRow
                            icon={Filter}
                            label="Не учитывать в фильтре по дате"
                            description="Отчёт всегда виден в списках, даже если дата вне выбранного периода"
                            checked={excludeFromDateFilter}
                            onChange={setExcludeFromDateFilter}
                        />

                        {canToggleHidden ? (
                            <SettingToggleRow
                                icon={EyeOff}
                                label="Скрыть от других"
                                description={hideReportDescription}
                                checked={isHidden}
                                onChange={setIsHidden}
                            />
                        ) : null}
                    </div>

                    <DialogFooter className="gap-2 sm:justify-end">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
