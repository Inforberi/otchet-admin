'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, FileText, FolderOpen, Plus, Search, Settings, X } from 'lucide-react';
import { AppPageHeader } from '@/components/layout/app-page-header';
import type { ReportFromDB } from '@/lib/db-types';
import { useUserRole } from '@/hooks/use-user-role';
import { buildGroupBreadcrumbs } from '@/lib/breadcrumbs';
import { CreateGroupDialog } from '@/components/groups/create-group-dialog';
import { EditGroupDialog } from '@/components/groups/edit-group-dialog';
import { GroupFolderCard } from '@/components/groups/group-folder-card';
import { CreateReportDialog } from '@/components/reports/create-report-dialog';
import { ReportCard } from '@/components/reports/report-card';
import {
    getCurrentMonthDateRange,
    getEmptyPeriodText,
    getPeriodSummary,
} from '@/lib/report-date-range';
import { getReportEditPublicPath } from '@/lib/report-paths';

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
    parentId: string | null;
    version: number;
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
    parentId: string | null;
    version: number;
    _count: {
        reports: number;
        children: number;
    };
    children: GroupChild[];
}

interface GroupPageProps {
    groupPath: string[];
}

export default function GroupPage({ groupPath }: GroupPageProps) {
    const router = useRouter();
    const groupPathString = useMemo(() => groupPath.join('/'), [groupPath]);
    const defaultDateRange = getCurrentMonthDateRange();
    const { canEdit } = useUserRole();

    const [group, setGroup] = useState<ReportGroup | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<GroupBreadcrumbItem[]>([]);
    const [reports, setReports] = useState<ReportFromDB[]>([]);
    const [groupLoading, setGroupLoading] = useState(true);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportsInitialized, setReportsInitialized] = useState(false);
    const [filtersReady, setFiltersReady] = useState(false);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(defaultDateRange.dateFrom);
    const [dateTo, setDateTo] = useState(defaultDateRange.dateTo);
    const [allTime, setAllTime] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
    const [isEditChildGroupOpen, setIsEditChildGroupOpen] = useState(false);
    const [editingChildGroup, setEditingChildGroup] = useState<GroupChild | null>(
        null
    );
    const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const hasLoadedRef = useRef(false);
    useEffect(() => {
        hasLoadedRef.current = false;
        setReportsInitialized(false);
        setReports([]);
        setFiltersReady(false);

        if (typeof window === 'undefined') {
            setFiltersReady(true);
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
            setFiltersReady(true);
        }
    }, [defaultDateRange.dateFrom, defaultDateRange.dateTo, groupPathString]);

    useEffect(() => {
        loadGroup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupPathString]);

    useEffect(() => {
        if (!filtersReady || !group) return;

        const hasReportsInGroup = group._count.reports > 0;
        const showReportsUi = hasReportsInGroup || group.children.length === 0;
        if (!showReportsUi) {
            setReports([]);
            setReportsLoading(false);
            setReportsInitialized(true);
            return;
        }

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        group?.id,
        group?._count.reports,
        group?.children.length,
        search,
        dateFrom,
        dateTo,
        allTime,
        filtersReady,
    ]);

    useEffect(() => {
        if (!filtersReady || typeof window === 'undefined') return;

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
            setGroupLoading(true);
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
            setGroupLoading(false);
        }
    };

    const loadReports = async (signal?: AbortSignal) => {
        if (!group?.id) return;

        try {
            setReportsLoading(true);

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
            setReportsInitialized(true);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('Error loading reports:', error);
            setReportsInitialized(true);
        } finally {
            setReportsLoading(false);
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

    const headerBreadcrumbs = useMemo(() => {
        if (!group) {
            return [
                { label: 'Группы', href: '/' },
                { label: 'Группа не найдена' },
            ];
        }
        return buildGroupBreadcrumbs(breadcrumbs, group.name);
    }, [breadcrumbs, group]);

    const handleGroupUpdated = async (updated: {
        path: string;
    }) => {
        if (updated.path !== group?.path) {
            router.replace(`/${updated.path}`);
            return;
        }
        await loadGroup();
    };

    const handleGroupDeleted = () => {
        const parent = breadcrumbs[breadcrumbs.length - 1];
        if (parent) {
            router.push(`/${parent.path}`);
        } else {
            router.push('/');
        }
    };

    const handleOpenChildEdit = (child: GroupChild, event: React.MouseEvent) => {
        event.stopPropagation();
        setEditingChildGroup(child);
        setIsEditChildGroupOpen(true);
    };

    const handleChildGroupUpdated = async () => {
        await loadGroup();
    };

    const handleChildGroupDeleted = async () => {
        await loadGroup();
    };

    if (groupLoading && !group) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)]">
                <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
            </div>
        );
    }

    if (!groupLoading && !group) {
        return (
            <div className="min-h-screen bg-[var(--color-grayscale-16)]">
                <AppPageHeader
                    onLogout={handleLogout}
                    breadcrumbs={headerBreadcrumbs}
                    title="Группа не найдена"
                />
                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="py-16 text-center">
                        <p className="text-lg text-[var(--color-grayscale-6)]">
                            Группа отчетов не найдена
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    if (!group) return null;

    const hasSubgroups = group.children.length > 0;
    const hasReportsInGroup = group._count.reports > 0;
    const showReportsUi = hasReportsInGroup || !hasSubgroups;
    const showReportsLoader =
        showReportsUi &&
        filtersReady &&
        (!reportsInitialized || reportsLoading);
    const showLargeEmpty =
        showReportsUi &&
        reportsInitialized &&
        !reportsLoading &&
        reports.length === 0 &&
        !hasSubgroups;
    const showCompactNoReports =
        showReportsUi &&
        reportsInitialized &&
        !reportsLoading &&
        reports.length === 0 &&
        hasSubgroups;

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            <AppPageHeader
                onLogout={handleLogout}
                breadcrumbs={headerBreadcrumbs}
                title={
                    <span className="inline-flex items-center gap-2">
                        <FolderOpen className="h-6 w-6 text-[var(--color-primary)]" />
                        {group.name}
                    </span>
                }
                description={group.description || undefined}
                actions={
                    canEdit ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setIsEditGroupOpen(true)}
                                className="inline-flex items-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                            >
                                <Settings className="h-4 w-4" />
                                Настройки папки
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCreateGroupOpen(true)}
                                className="inline-flex items-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                Создать папку
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCreateReportOpen(true)}
                                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                Создать отчёт
                            </button>
                        </>
                    ) : undefined
                }
            />

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {showReportsUi && filtersReady && (
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
                )}

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
                                <GroupFolderCard
                                    key={child.id}
                                    name={child.name}
                                    description={child.description}
                                    reportsCount={child._count.reports}
                                    childrenCount={child._count.children}
                                    canEdit={canEdit}
                                    showDeleteHint
                                    onOpen={() => router.push(`/${child.path}`)}
                                    onEdit={(event) =>
                                        handleOpenChildEdit(child, event)
                                    }
                                />
                            ))}
                        </div>
                    </section>
                )}

                {showReportsUi && filtersReady && (
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

                    <div className="min-h-[200px]">
                        {showReportsLoader ? (
                            <div className="py-12 text-center text-[var(--color-grayscale-6)]">
                                Загрузка...
                            </div>
                        ) : reports.length > 0 ? (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {reports.map((report) => (
                                    <ReportCard
                                        key={report.id}
                                        report={report}
                                        isAdmin={canEdit}
                                        deleteConfirmId={deleteConfirm}
                                        onAskDelete={setDeleteConfirm}
                                        onCancelDelete={() =>
                                            setDeleteConfirm(null)
                                        }
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        ) : showCompactNoReports ? (
                            <p className="text-sm text-[var(--color-grayscale-6)]">
                                {search
                                    ? 'По текущему поиску и периоду в этой папке отчётов нет. Откройте подгруппу выше.'
                                    : 'В этой папке за выбранный период отчётов нет. Откройте подгруппу выше.'}
                            </p>
                        ) : showLargeEmpty ? (
                            <div className="rounded-2xl border border-dashed border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-6 py-14 text-center">
                                <FileText className="mx-auto h-12 w-12 text-[var(--color-grayscale-6)]" />
                                <h3 className="mt-5 text-2xl font-semibold text-[var(--color-grayscale-2)]">
                                    Отчётов пока нет
                                </h3>
                                <p className="mt-3 text-[var(--color-grayscale-6)]">
                                    {search
                                        ? `По текущему поиску и периоду результатов нет. ${emptyPeriodText}`
                                        : emptyPeriodText}
                                </p>
                                {canEdit && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateReportOpen(true)}
                                        className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Создать отчёт
                                    </button>
                                )}
                            </div>
                        ) : null}
                    </div>
                </section>
                )}
            </main>

            {canEdit && (
                <>
                    <EditGroupDialog
                        open={isEditGroupOpen}
                        onOpenChange={setIsEditGroupOpen}
                        group={group}
                        onUpdated={handleGroupUpdated}
                        onDeleted={handleGroupDeleted}
                    />
                    <EditGroupDialog
                        open={isEditChildGroupOpen}
                        onOpenChange={(open) => {
                            setIsEditChildGroupOpen(open);
                            if (!open) setEditingChildGroup(null);
                        }}
                        group={editingChildGroup}
                        onUpdated={handleChildGroupUpdated}
                        onDeleted={handleChildGroupDeleted}
                    />
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
                            router.push(
                                getReportEditPublicPath({
                                    slug: report.slug,
                                    group: { path: group.path },
                                })
                            );
                        }}
                    />
                </>
            )}
        </div>
    );
}
