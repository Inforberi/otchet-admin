'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    Plus,
    FileText,
    Search,
    Trash2,
    Eye,
    Edit,
    Calendar,
    User,
    X,
    LogOut,
    ArrowLeft,
    FolderOpen,
} from 'lucide-react';
import type { ReportFromDB } from '@/lib/db-types';
import { useUserRole } from '@/hooks/use-user-role';

interface ReportGroup {
    id: string;
    name: string;
    description: string | null;
}

export default function GroupReportsPage() {
    const router = useRouter();
    const params = useParams();
    const groupId = params.groupId as string;
    const { isAdmin } = useUserRole();
    const [group, setGroup] = useState<ReportGroup | null>(null);
    const [reports, setReports] = useState<ReportFromDB[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateSearch, setDateSearch] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const hasLoadedRef = useRef(false);

    useEffect(() => {
        loadGroup();
    }, [groupId]);

    useEffect(() => {
        // Отменяем предыдущий запрос если он есть
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Создаем новый AbortController для этого запроса
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Очищаем предыдущий таймер
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Для первоначальной загрузки - без задержки
        // Для поиска - с debounce
        const delay = hasLoadedRef.current
            ? dateSearch && !search
                ? 300
                : 500
            : 0;

        searchTimeoutRef.current = setTimeout(() => {
            loadReports(abortController.signal);
            hasLoadedRef.current = true;
        }, delay);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            abortController.abort();
        };
    }, [groupId, search, dateSearch]);

    const loadGroup = async () => {
        try {
            const response = await fetch(`/api/groups/${groupId}`);
            if (response.ok) {
                const data = await response.json();
                setGroup(data.group);
            } else {
                // Не перенаправляем сразу, показываем ошибку
                console.error('Group not found');
            }
        } catch (error) {
            console.error('Error loading group:', error);
            // Не перенаправляем сразу, показываем ошибку
        }
    };

    const loadReports = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('groupId', groupId);
            if (search) params.append('search', search);
            if (dateSearch) params.append('date', dateSearch);
            const queryString = params.toString();
            const response = await fetch(`/api/reports?${queryString}`, {
                signal,
            });
            if (signal?.aborted) return;
            const data = await response.json();
            setReports(data.reports || []);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('Error loading reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatReportDate = (
        dateString: string | null | undefined
    ): string => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString + 'T00:00:00');
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        } catch (error) {
            return dateString;
        }
    };

    const stripHtml = (html: string) => {
        if (!html) return '';
        if (typeof window === 'undefined') {
            return html
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .trim();
        }
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`/api/reports/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                setReports((prev) => prev.filter((r) => r.id !== id));
                setDeleteConfirm(null);
            }
        } catch (error) {
            console.error('Error deleting report:', error);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    if (loading && !group) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)]">
                <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
            </div>
        );
    }

    if (!loading && !group) {
        return (
            <div className="min-h-screen bg-[var(--color-grayscale-16)]">
                <header className="sticky top-0 z-40 border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]/95 backdrop-blur">
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                            <h1 className="text-3xl font-bold text-[var(--color-grayscale-2)]">
                                Группа не найдена
                            </h1>
                        </div>
                    </div>
                </header>
                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="text-center py-16">
                        <p className="text-lg text-[var(--color-grayscale-6)] mb-4">
                            Группа отчетов не найдена
                        </p>
                        <button
                            onClick={() => router.push('/')}
                            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Вернуться к группам
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    if (!group) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                                title="Назад к группам"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <FolderOpen className="h-5 w-5 text-[var(--color-primary)]" />
                                    <h1 className="text-3xl font-bold text-[var(--color-grayscale-2)]">
                                        {group.name}
                                    </h1>
                                </div>
                                {group.description && (
                                    <p className="text-sm text-[var(--color-grayscale-6)]">
                                        {group.description}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {isAdmin && (
                                <button
                                    onClick={() =>
                                        router.push(`/groups/${groupId}/reports/new`)
                                    }
                                    className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                                >
                                    <Plus className="h-4 w-4" />
                                    Создать отчет
                                </button>
                            )}
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 cursor-pointer"
                            >
                                <LogOut className="h-4 w-4" />
                                Выйти
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Search */}
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-grayscale-6)]" />
                        <input
                            type="text"
                            placeholder="Поиск по названию или клиенту..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-10 py-2 text-[var(--color-grayscale-2)] placeholder-[var(--color-grayscale-6)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                        />
                    </div>
                    <div className="relative sm:w-64">
                        <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-grayscale-6)]" />
                        <input
                            type="date"
                            value={dateSearch}
                            onChange={(e) => setDateSearch(e.target.value)}
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-10 py-2 text-[var(--color-grayscale-2)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] [color-scheme:dark]"
                        />
                    </div>
                </div>

                {/* Reports List */}
                {loading ? (
                    <div className="text-center py-12 text-[var(--color-grayscale-6)]">
                        Загрузка...
                    </div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="mx-auto h-12 w-12 text-[var(--color-grayscale-6)] mb-4" />
                        <p className="text-lg text-[var(--color-grayscale-6)] mb-4">
                            {search || dateSearch
                                ? 'Отчеты не найдены'
                                : 'Нет отчетов в этой группе'}
                        </p>
                        {isAdmin && !search && !dateSearch && (
                            <button
                                onClick={() =>
                                    router.push(`/groups/${groupId}/reports/new`)
                                }
                                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                            >
                                <Plus className="h-5 w-5" />
                                Создать первый отчет
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {reports.map((report) => (
                                <div
                                    key={report.id}
                                    className="group relative flex flex-col overflow-hidden rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-6 transition-all hover:border-[var(--color-primary)] hover:shadow-lg"
                                >
                                    <div className="mb-4 flex-shrink-0">
                                        <h3 
                                            className="text-lg font-semibold text-[var(--color-grayscale-2)] line-clamp-2"
                                            dangerouslySetInnerHTML={{
                                                __html: report.title,
                                            }}
                                        />
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
                                                <span className="truncate">
                                                    {report.client}
                                                </span>
                                            </div>
                                        )}
                                        {report.date && (
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 flex-shrink-0" />
                                                <span>
                                                    {formatReportDate(report.date)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 flex-shrink-0" />
                                            <span>
                                                {report.blocks?.length || 0} блоков
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 flex items-center gap-2 text-xs text-[var(--color-grayscale-7)] flex-shrink-0">
                                        <span>
                                            Обновлен: {formatDate(report.updatedAt)}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-4 flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() =>
                                                router.push(
                                                    `/groups/${groupId}/reports/${report.id}`
                                                )
                                            }
                                            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-sm text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                                        >
                                            <Eye className="h-4 w-4" />
                                            Просмотр
                                        </button>
                                        {isAdmin && (
                                            <button
                                                onClick={() =>
                                                    router.push(
                                                        `/groups/${groupId}/reports/${report.id}/edit`
                                                    )
                                                }
                                                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                                            >
                                                <Edit className="h-4 w-4" />
                                                Редактор
                                            </button>
                                        )}
                                    </div>

                                    {/* Delete */}
                                    {isAdmin && deleteConfirm === report.id ? (
                                        <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 flex-shrink-0">
                                            <p className="mb-2 text-sm text-red-400">
                                                Точно удалить?
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() =>
                                                        handleDelete(report.id)
                                                    }
                                                    className="flex-1 rounded bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                                                >
                                                    Да, удалить
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setDeleteConfirm(null)
                                                    }
                                                    className="flex-1 rounded bg-[var(--color-grayscale-13)] px-3 py-1.5 text-sm text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-12)] cursor-pointer"
                                                >
                                                    Отмена
                                                </button>
                                            </div>
                                        </div>
                                    ) : isAdmin ? (
                                        <button
                                            onClick={() =>
                                                setDeleteConfirm(report.id)
                                            }
                                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20 flex-shrink-0 cursor-pointer"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Удалить
                                        </button>
                                    ) : null}
                                </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-6">
                        <h3 className="mb-4 text-lg font-semibold text-[var(--color-grayscale-2)]">
                            Удалить отчет?
                        </h3>
                        <p className="mb-6 text-sm text-[var(--color-grayscale-6)]">
                            Это действие нельзя отменить. Все данные отчета будут
                            удалены.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-2)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 cursor-pointer"
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
