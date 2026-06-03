'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, FileText, Search, X } from 'lucide-react';
import { AppPageHeader } from '@/components/layout/app-page-header';
import { ROOT_GROUPS_CRUMB } from '@/lib/breadcrumbs';
import type { ReportFromDB } from '@/lib/db-types';
import { useUserRole } from '@/hooks/use-user-role';
import { ReportCard } from '@/components/reports/report-card';
import { getCurrentMonthDateRange } from '@/lib/report-date-range';

export default function ReportsListPage() {
    const router = useRouter();
    const { canEdit } = useUserRole();
    const defaultDateRange = getCurrentMonthDateRange();

    const [reports, setReports] = useState<ReportFromDB[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(defaultDateRange.dateFrom);
    const [dateTo, setDateTo] = useState(defaultDateRange.dateTo);
    const [allTime, setAllTime] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
            const saved = sessionStorage.getItem('reports-list-filters');
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
            console.error('Error restoring report filters:', error);
        } finally {
            filtersReadyRef.current = true;
        }
    }, [defaultDateRange.dateFrom, defaultDateRange.dateTo]);

    const loadReports = async (signal?: AbortSignal) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            if (search) params.append('search', search);

            if (allTime) {
                params.append('allTime', '1');
            } else {
                params.append('dateFrom', dateFrom);
                params.append('dateTo', dateTo);
            }

            const queryString = params.toString();
            const response = await fetch(
                `/api/reports${queryString ? `?${queryString}` : ''}`,
                {
                    signal,
                }
            );

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
            loadReports(abortController.signal);
            hasLoadedRef.current = true;
        }, delay);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            abortController.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, dateFrom, dateTo, allTime]);

    useEffect(() => {
        if (!filtersReadyRef.current || typeof window === 'undefined') return;

        sessionStorage.setItem(
            'reports-list-filters',
            JSON.stringify({
                dateFrom,
                dateTo,
                allTime,
            })
        );
    }, [dateFrom, dateTo, allTime]);

    const applyCurrentMonthFilter = () => {
        const currentMonthRange = getCurrentMonthDateRange();
        setDateFrom(currentMonthRange.dateFrom);
        setDateTo(currentMonthRange.dateTo);
        setAllTime(false);
    };

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

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            <AppPageHeader
                onLogout={handleLogout}
                breadcrumbs={[ROOT_GROUPS_CRUMB, { label: 'Все отчёты' }]}
                title="Отчеты"
                description="Только текущий месяц по умолчанию"
            />

            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                        onClick={applyCurrentMonthFilter}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                            !allTime
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] text-[var(--color-grayscale-4)] hover:bg-[var(--color-grayscale-13)]'
                        }`}
                    >
                        Текущий месяц
                    </button>
                    <button
                        onClick={() => setAllTime(true)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                            allTime
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] text-[var(--color-grayscale-4)] hover:bg-[var(--color-grayscale-13)]'
                        }`}
                    >
                        Все время
                    </button>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[var(--color-grayscale-6)]" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Поиск по названию или клиенту..."
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] py-2 pl-10 pr-4 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
                        />
                    </div>
                    <div className="relative flex-1">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[var(--color-grayscale-6)]" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) =>
                                handleDateFromChange(e.target.value)
                            }
                            disabled={allTime}
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] py-2 pl-10 pr-4 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                        />
                    </div>
                    <div className="relative flex-1">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[var(--color-grayscale-6)]" />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => handleDateToChange(e.target.value)}
                            disabled={allTime}
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] py-2 pl-10 pr-10 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                        />
                        {!allTime &&
                            (dateFrom !== defaultDateRange.dateFrom ||
                                dateTo !== defaultDateRange.dateTo) && (
                                <button
                                    onClick={applyCurrentMonthFilter}
                                    className="absolute right-2 top-1/2 z-20 -translate-y-1/2 p-1 text-[var(--color-grayscale-6)] transition-colors hover:text-[var(--color-grayscale-4)] cursor-pointer"
                                    title="Сбросить на текущий месяц"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-[var(--color-grayscale-6)]">
                            Загрузка...
                        </div>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-6 py-16 text-center">
                        <FileText className="mx-auto h-12 w-12 text-[var(--color-grayscale-6)]" />
                        <h3 className="mt-4 text-lg font-semibold text-[var(--color-grayscale-3)]">
                            Отчеты не найдены
                        </h3>
                        <p className="mt-2 text-[var(--color-grayscale-6)]">
                            {search
                                ? 'Попробуйте изменить параметры поиска'
                                : 'За выбранный период отчёты не найдены'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {reports.map((report) => (
                            <ReportCard
                                key={report.id}
                                report={report}
                                isAdmin={canEdit}
                                deleteConfirmId={deleteConfirm}
                                onAskDelete={setDeleteConfirm}
                                onCancelDelete={() => setDeleteConfirm(null)}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
