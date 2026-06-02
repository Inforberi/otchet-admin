'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, FileText, FolderOpen, LogOut, Plus, Search, X } from 'lucide-react';
import type { ReportFromDB } from '@/lib/db-types';
import { useUserRole } from '@/hooks/use-user-role';
import { CreateGroupDialog } from '@/components/groups/create-group-dialog';
import { CreateReportDialog } from '@/components/reports/create-report-dialog';
import { ReportCard } from '@/components/reports/report-card';
import {
    getCurrentMonthDateRange,
    getEmptyPeriodText,
    getPeriodSummary,
} from '@/lib/report-date-range';

interface GroupBreadcrumbItem {
    id: string;
    name: string;
    path: string;
    slug: string;
}

interface GroupChild {
    id: string;
    name: string;
    slug: string;
    path: string;
    description: string | null;
    _count: {
        reports: number;
        children: number;
    };
}

interface ReportGroup {
    id: string;
    name: string;
    path: string;
    slug: string;
    description: string | null;
    _count: {
        reports: number;
        children: number;
    };
    children: GroupChild[];
}

export default function GroupReportsPage() {
    const router = useRouter();
    const params = useParams();
    const rawGroupPath = params.groupPath;
    const groupPath = useMemo(() => {
        if (Array.isArray(rawGroupPath)) return rawGroupPath;
        return rawGroupPath ? [rawGroupPath] : [];
    }, [rawGroupPath]);
    const groupPathString = useMemo(() => groupPath.join('/'), [groupPath]);
    const defaultDateRange = getCurrentMonthDateRange();
    const { isAdmin } = useUserRole();

    const [group, setGroup] = useState<ReportGroup | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<GroupBreadcrumbItem[]>([]);
    const [reports, setReports] = useState<ReportFromDB[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(defaultDateRange.dateFrom);
    const [dateTo, setDateTo] = useState(defaultDateRange.dateTo);
    const [allTime, setAllTime] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const hasLoadedRef = useRef(false);
    const filtersReadyRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            filtersReadyRef.current = true;
            return;
        }

        try {
            const saved = sessionStorage.getItem(
                `group-report-filters:${groupPathString}`
            );
            if (saved) {
                const parsed = JSON.parse(saved) as {
                    dateFrom?: string;
                    dateTo?: string;
                    allTime?: boolean;
                };

                setDateFrom(parsed.dateFrom || defaultDateRange.dateFrom);
                setDateTo(parsed.dateTo || defaultDateRange.dateTo);
                setAllTime(Boolean(parsed.allTime));
            }
        } catch (error) {
            console.error('Error restoring group filters:', error);
        } finally {
            filtersReadyRef.current = true;
        }
    }, [defaultDateRange.dateFrom, defaultDateRange.dateTo, groupPathString]);

    useEffect(() => {
        loadGroup();
    }, [groupPathString]);

    useEffect(() => {
        if (!filtersReadyRef.current) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        const delay = hasLoadedRef.current
            ? !allTime && (dateFrom || dateTo) && !search
                ? 300
                : 500
            : 0;

        searchTimeoutRef.current = setTimeout(() => {
            if (group?.id) {
                loadReports(abortController.signal);
                hasLoadedRef.current = true;
            }
        }, delay);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            abortController.abort();
        };
    }, [group?.id, search, dateFrom, dateTo, allTime]);

    useEffect(() => {
        if (!filtersReadyRef.current || typeof window === 'undefined') return;

        sessionStorage.setItem(
            `group-report-filters:${groupPathString}`,
            JSON.stringify({
                dateFrom,
                dateTo,
                allTime,
            })
        );
    }, [allTime, dateFrom, dateTo, groupPathString]);

    const loadGroup = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/groups/by-path/${groupPathString}`);

            if (!response.ok) {
                setGroup(null);
                setBreadcrumbs([]);
                return;
            }

            const data = await response.json();
            setGroup(data.group);
            setBreadcrumbs(data.ancestors || []);
        } catch (error) {
            console.error('Error loading group:', error);
            setGroup(null);
            setBreadcrumbs([]);
        } finally {
            setLoading(false);
        }
    };

    const loadReports = async (signal?: AbortSignal) => {
        if (!group?.id) return;

        try {
            setLoading(true);

            const params = new URLSearchParams();
            params.append('groupId', group.id);
            if (search) params.append('search', search);

            if (allTime) {
                params.append('allTime', '1');
            } else {
                params.append('dateFrom', dateFrom);
                params.append('dateTo', dateTo);
            }

            const response = await fetch(`/api/reports?${params.toString()}`, {
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

    const applyCurrentMonthFilter = () => {
        const currentMonthRange = getCurrentMonthDateRange();
        setDateFrom(currentMonthRange.dateFrom);
        setDateTo(currentMonthRange.dateTo);
        setAllTime(false);
    };

    const periodSummary = getPeriodSummary({
        allTime,
        dateFrom,
        dateTo,
        defaultDateRange,
    });

    const emptyPeriodText = getEmptyPeriodText({
        allTime,
        dateFrom,
        dateTo,
        defaultDateRange,
    });

    const handleDateFromChange = (value: string) => {
        if (!value) {
            applyCurrentMonthFilter();
            return;
        }

        setDateFrom(value);
        setAllTime(false);
    };

    const handleDateToChange = (value: string) => {
        if (!value) {
            applyCurrentMonthFilter();
            return;
        }

        setDateTo(value);
        setAllTime(false);
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`/api/reports/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                setReports((prev) => prev.filter((report) => report.id !== id));
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
                    <div className="py-16 text-center">
                        <p className="mb-4 text-lg text-[var(--color-grayscale-6)]">
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

    if (!group) return null;

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            <header className="sticky top-0 z-40 border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                                title="Назад к группам"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                            <div>
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-grayscale-6)]">
                                    <button
                                        onClick={() => router.push('/')}
                                        className="transition-colors hover:text-[var(--color-grayscale-3)] cursor-pointer"
                                    >
                                        Группы
                                    </button>
                                    {breadcrumbs.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-2"
                                        >
                                            <span>/</span>
                                            <button
                                                onClick={() => router.push(`/${item.path}`)}
                                                className="transition-colors hover:text-[var(--color-grayscale-3)] cursor-pointer"
                                            >
                                                {item.name}
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <span>/</span>
                                        <span className="text-[var(--color-grayscale-3)]">
                                            {group.name}
                                        </span>
                                    </div>
                                </div>
                                <div className="mb-1 flex items-center gap-2">
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
                                <>
                                    <button
                                        onClick={() => setIsCreateGroupOpen(true)}
                                        className="inline-flex items-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Создать папку
                                    </button>
                                    <button
                                        onClick={() => setIsCreateReportOpen(true)}
                                        className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Создать отчёт
                                    </button>
                                </>
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

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <section className="mb-8 rounded-xl border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-5">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-grayscale-7)]">
                                    Период отчётов
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold text-[var(--color-grayscale-2)]">
                                    {periodSummary}
                                </h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={applyCurrentMonthFilter}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                                        !allTime
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] text-[var(--color-grayscale-4)] hover:bg-[var(--color-grayscale-13)]'
                                    }`}
                                >
                                    Текущий месяц
                                </button>
                                <button
                                    onClick={() => setAllTime(true)}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                                        allTime
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] text-[var(--color-grayscale-4)] hover:bg-[var(--color-grayscale-13)]'
                                    }`}
                                >
                                    Все время
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-grayscale-6)]" />
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => handleDateFromChange(e.target.value)}
                                    disabled={allTime}
                                    className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-10 py-2 text-[var(--color-grayscale-2)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50 [color-scheme:dark]"
                                />
                            </div>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-grayscale-6)]" />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => handleDateToChange(e.target.value)}
                                    disabled={allTime}
                                    className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-10 py-2 text-[var(--color-grayscale-2)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50 [color-scheme:dark]"
                                />
                                {!allTime &&
                                    (dateFrom !== defaultDateRange.dateFrom ||
                                        dateTo !== defaultDateRange.dateTo) && (
                                        <button
                                            onClick={applyCurrentMonthFilter}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-grayscale-6)] hover:text-[var(--color-grayscale-4)] transition-colors cursor-pointer"
                                            title="Сбросить на текущий месяц"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                            </div>
                        </div>
                    </div>
                </section>

                {group.children.length > 0 && (
                    <section className="mb-8">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-[var(--color-grayscale-2)]">
                                Подгруппы
                            </h2>
                            <span className="text-sm text-[var(--color-grayscale-6)]">
                                {group.children.length}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {group.children.map((child) => (
                                <button
                                    key={child.id}
                                    onClick={() => router.push(`/${child.path}`)}
                                    className="group relative flex flex-col rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-6 text-left transition-all hover:border-[var(--color-primary)] hover:shadow-lg cursor-pointer"
                                >
                                    <div className="mb-4 flex items-start justify-between">
                                        <div className="rounded-lg bg-[var(--color-primary)]/10 p-3">
                                            <FolderOpen className="h-6 w-6 text-[var(--color-primary)]" />
                                        </div>
                                        <span className="text-sm font-medium text-[var(--color-grayscale-6)]">
                                            {child._count.reports} отчетов
                                            {child._count.children > 0
                                                ? ` • ${child._count.children} групп`
                                                : ''}
                                        </span>
                                    </div>
                                    <h3 className="mb-2 text-xl font-semibold text-[var(--color-grayscale-2)]">
                                        {child.name}
                                    </h3>
                                    {child.description && (
                                        <p className="line-clamp-2 text-sm text-[var(--color-grayscale-6)]">
                                            {child.description}
                                        </p>
                                    )}
                                    <div className="mt-4 flex items-center text-sm font-medium text-[var(--color-primary)] opacity-0 transition-opacity group-hover:opacity-100">
                                        Открыть группу
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {loading ? (
                    <section>
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-[var(--color-grayscale-2)]">
                                    Отчёты
                                </h2>
                                <p className="text-sm text-[var(--color-grayscale-6)]">
                                    {group._count.reports} отчетов в текущей группе
                                </p>
                            </div>
                        </div>

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
                        </div>

                        <div className="py-12 text-center text-[var(--color-grayscale-6)]">
                            Загрузка...
                        </div>
                    </section>
                ) : reports.length > 0 ? (
                    <section>
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-[var(--color-grayscale-2)]">
                                    Отчёты
                                </h2>
                                <p className="text-sm text-[var(--color-grayscale-6)]">
                                    {group._count.reports} отчетов в текущей группе
                                </p>
                            </div>
                        </div>

                        <div className="mb-6">
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
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {reports.map((report) => (
                                <ReportCard
                                    key={report.id}
                                    report={report}
                                    isAdmin={isAdmin}
                                    deleteConfirmId={deleteConfirm}
                                    onAskDelete={setDeleteConfirm}
                                    onCancelDelete={() => setDeleteConfirm(null)}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </section>
                ) : (
                    <section>
                        <div className="rounded-2xl border border-dashed border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-6 py-14 text-center">
                            <FileText className="mx-auto h-12 w-12 text-[var(--color-grayscale-6)]" />
                            <h2 className="mt-5 text-2xl font-semibold text-[var(--color-grayscale-2)]">
                                Отчётов пока нет
                            </h2>
                            <p className="mt-3 text-[var(--color-grayscale-6)]">
                                {search
                                    ? `По текущему поиску и периоду результатов нет. ${emptyPeriodText}`
                                    : emptyPeriodText}
                            </p>
                        </div>
                    </section>
                )}
            </main>

            {isAdmin && (
                <>
                    <CreateGroupDialog
                        open={isCreateGroupOpen}
                        onOpenChange={setIsCreateGroupOpen}
                        parentId={group.id}
                        parentName={group.name}
                        onCreated={async () => {
                            await loadGroup();
                        }}
                    />
                    <CreateReportDialog
                        open={isCreateReportOpen}
                        onOpenChange={setIsCreateReportOpen}
                        groupId={group.id}
                        groupName={group.name}
                        onCreated={async (report) => {
                            await loadReports();
                            router.push(`/reports/${report.id}/edit`);
                        }}
                    />
                </>
            )}
        </div>
    );
}
