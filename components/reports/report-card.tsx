'use client';

import { Calendar, Edit, Eye, FileText, Trash2, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReportFromDB } from '@/lib/db-types';

interface ReportCardProps {
    report: ReportFromDB;
    isAdmin: boolean; // canEdit — показывать действия редактора
    deleteConfirmId: string | null;
    onAskDelete: (reportId: string) => void;
    onCancelDelete: () => void;
    onDelete: (reportId: string) => void;
}

const stripHtml = (html: string) => {
    if (!html) return '';
    if (typeof window === 'undefined') {
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
};

const formatReportDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';

    try {
        const date = new Date(`${dateString}T00:00:00`);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch {
        return dateString;
    }
};

const formatUpdatedAt = (date: Date | string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

export const ReportCard = ({
    report,
    isAdmin,
    deleteConfirmId,
    onAskDelete,
    onCancelDelete,
    onDelete,
}: ReportCardProps) => {
    const router = useRouter();

    return (
        <div className="group relative flex flex-col overflow-hidden rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-6 transition-all hover:border-[var(--color-primary)] hover:shadow-lg">
            <div className="mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold text-[var(--color-grayscale-2)] line-clamp-2">
                    {stripHtml(report.title)}
                </h3>
                {report.subtitle && (
                    <p className="mt-1 text-sm text-[var(--color-grayscale-6)] line-clamp-2">
                        {stripHtml(report.subtitle)}
                    </p>
                )}
            </div>

            <div className="flex-1 space-y-2 text-sm text-[var(--color-grayscale-6)]">
                {report.client && (
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{report.client}</span>
                    </div>
                )}
                {report.date && (
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>{formatReportDate(report.date)}</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span>{report.blocks?.length || 0} блоков</span>
                </div>
            </div>

            <div className="mt-auto flex flex-shrink-0 items-center gap-2 pt-4 text-xs text-[var(--color-grayscale-7)]">
                <span>Обновлен: {formatUpdatedAt(report.updatedAt)}</span>
            </div>

            <div className="mt-4 flex flex-shrink-0 items-center gap-2">
                <button
                    onClick={() => router.push(`/reports/${report.id}`)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-sm text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                >
                    <Eye className="h-4 w-4" />
                    Просмотр
                </button>
                {isAdmin && (
                    <button
                        onClick={() => router.push(`/reports/${report.id}/edit`)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                    >
                        <Edit className="h-4 w-4" />
                        Редактор
                    </button>
                )}
            </div>

            {isAdmin && deleteConfirmId === report.id ? (
                <div className="mt-2 flex-shrink-0 rounded-md border border-red-500/30 bg-red-500/10 p-3">
                    <p className="mb-2 text-sm text-red-400">Точно удалить?</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onDelete(report.id)}
                            className="flex-1 rounded bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                        >
                            Да, удалить
                        </button>
                        <button
                            onClick={onCancelDelete}
                            className="flex-1 rounded bg-[var(--color-grayscale-13)] px-3 py-1.5 text-sm text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-12)] cursor-pointer"
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            ) : (
                isAdmin && (
                    <button
                        onClick={() => onAskDelete(report.id)}
                        className="absolute right-4 top-4 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-400 opacity-0 transition-all hover:bg-red-500/20 group-hover:opacity-100 cursor-pointer"
                        title="Удалить"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )
            )}
        </div>
    );
};
