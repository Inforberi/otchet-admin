'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateInputValue } from '@/lib/report-date-range';

interface CreatedReport {
    id: string;
    title: string;
    slug?: string | null;
}

interface CreateReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groupId: string;
    groupName: string;
    onCreated?: (report: CreatedReport) => void | Promise<void>;
}

export const CreateReportDialog = ({
    open,
    onOpenChange,
    groupId,
    groupName,
    onCreated,
}: CreateReportDialogProps) => {
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        client: '',
        date: formatDateInputValue(new Date()),
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) {
            setFormData({
                title: '',
                subtitle: '',
                client: '',
                date: formatDateInputValue(new Date()),
            });
            setSaving(false);
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            alert('Название отчёта обязательно');
            return;
        }

        try {
            setSaving(true);

            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    title: formData.title.trim(),
                    subtitle: formData.subtitle.trim() || undefined,
                    client: formData.client.trim() || undefined,
                    date: formData.date || undefined,
                    groupId,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'Ошибка создания отчёта');
                return;
            }

            const data = await response.json();
            onOpenChange(false);

            if (onCreated) {
                await onCreated(data.report);
            }
        } catch (error) {
            console.error('Error creating report:', error);
            alert('Ошибка создания отчёта');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] text-[var(--color-grayscale-3)] sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Создать отчёт</DialogTitle>
                    <DialogDescription className="text-[var(--color-grayscale-6)]">
                        Новый отчёт будет создан в папке «{groupName}».
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                            Название *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    title: e.target.value,
                                }))
                            }
                            placeholder="Новый отчёт"
                            required
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                            Подзаголовок
                        </label>
                        <input
                            type="text"
                            value={formData.subtitle}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    subtitle: e.target.value,
                                }))
                            }
                            placeholder="Короткое описание отчёта"
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                                Клиент
                            </label>
                            <input
                                type="text"
                                value={formData.client}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        client: e.target.value,
                                    }))
                                }
                                placeholder="ООО «Компания»"
                                className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                                Дата
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        date: e.target.value,
                                    }))
                                }
                                className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !formData.title.trim()}
                            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {saving ? 'Создание...' : 'Создать отчёт'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
