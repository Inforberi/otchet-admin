'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type {
    ReportFromDB,
    ReportBlockFromDB,
    ScreenshotBlockData,
    TextBlockData,
    TaskBlockData,
    ImageData,
} from '@/lib/db-types';

import { ScreenshotBlockView } from '@/components/report/screenshot-block-view';
import { TextBlockView } from '@/components/report/text-block-view';
import { DividerBlockView } from '@/components/report/divider-block-view';
import { TaskBlockCard } from '@/components/report/task-block-card';
import { Download, Edit } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AppPageHeader } from '@/components/layout/app-page-header';
import { useUserRole } from '@/hooks/use-user-role';
import {
    buildReportViewBreadcrumbs,
    stripHtml,
    type GroupAncestor,
} from '@/lib/breadcrumbs';
import { formatReportDateLabel } from '@/lib/report-date-range';
import {
    buildByPathReportApiUrl,
    getReportEditPublicPath,
    getReportPublicPath,
    joinGroupPathFromSegments,
} from '@/lib/report-paths';
import { sortBlocksByPosition } from '@/lib/report-block-order';

function isEmptyHtml(html: string | null | undefined): boolean {
    if (!html) return true;
    return html.replace(/<[^>]*>/g, '').trim().length === 0;
}

function isEmpty(str: string | null | undefined): boolean {
    if (!str) return true;
    return str.trim().length === 0;
}

interface ReportViewPageProps {
    groupPath: string[];
    reportSlug: string;
}

export default function ReportViewPage({ groupPath, reportSlug }: ReportViewPageProps) {
    const router = useRouter();
    const groupPathString = joinGroupPathFromSegments(groupPath);
    const reportApiUrl = buildByPathReportApiUrl(groupPathString, reportSlug);
    const { canEdit, loading: roleLoading, user: currentUser } = useUserRole();

    const [report, setReport] = useState<ReportFromDB | null>(null);
    const [ancestors, setAncestors] = useState<GroupAncestor[]>([]);
    const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [pdfErrorOpen, setPdfErrorOpen] = useState(false);
    const [showFloatingEdit, setShowFloatingEdit] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    const headerBreadcrumbs = useMemo(() => {
        if (!report) {
            return [
                { label: 'Группы', href: '/' },
                { label: 'Отчет не найден' },
            ];
        }
        return buildReportViewBreadcrumbs(
            ancestors,
            report.group,
            report.title || 'Отчёт',
            report.slug ? { slug: report.slug, group: report.group } : null
        );
    }, [ancestors, report]);

    useEffect(() => {
        if (roleLoading) return;
        void loadReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportApiUrl, canEdit, roleLoading]);

    useEffect(() => {
        if (!report?.slug || !report.group?.path) return;
        const canonical = getReportPublicPath(report);
        const current = getReportPublicPath({
            slug: reportSlug,
            group: { path: groupPathString },
        });
        if (canonical !== current) {
            router.replace(canonical);
        }
    }, [report?.slug, report?.group?.path, reportSlug, groupPathString, router, report]);

    useEffect(() => {
        if (!canEdit) return;
        const handleScroll = () => {
            setShowFloatingEdit((window.scrollY || window.pageYOffset) > 200);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [canEdit]);

    useEffect(() => {
        if (!canEdit) return;
        const checkLightbox = () => {
            const lightbox = document.querySelector('[class*="bg-black/90"][class*="z-50"]');
            setIsLightboxOpen(!!lightbox || document.body.style.overflow === 'hidden');
        };
        const interval = setInterval(checkLightbox, 100);
        const observer = new MutationObserver(checkLightbox);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class'],
        });
        return () => {
            clearInterval(interval);
            observer.disconnect();
        };
    }, [canEdit]);

    const loadReport = async () => {
        try {
            setLoading(true);
            const query = canEdit ? '' : '?view=published';
            const response = await fetch(`${reportApiUrl}${query}`);
            if (response.ok) {
                const data = await response.json();
                setReport(data.report);
                setAncestors(data.ancestors || []);
                setHasUnpublishedChanges(Boolean(data.hasUnpublishedChanges));
            } else {
                setReport(null);
                setAncestors([]);
            }
        } catch (error) {
            console.error('Error loading report:', error);
            setReport(null);
            setAncestors([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        try {
            setIsExporting(true);
            const response = await fetch(`/api/reports/${report?.id ?? ''}/pdf`);
            if (!response.ok) throw new Error('Ошибка при генерации PDF');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = report?.title
                ? `${report.title.replace(/<[^>]*>/g, '').trim()}.pdf`
                : `report_${report?.id ?? reportSlug}.pdf`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) filename = match[1];
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            setPdfErrorOpen(true);
        } finally {
            setIsExporting(false);
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

    const reportTitlePlain = report ? stripHtml(report.title || '') : '';
    const formattedDate = report?.date ? formatReportDateLabel(report.date) : '';

    const reportMeta =
        report && (!isEmpty(report.client) || formattedDate) ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400 print:hidden">
                {!isEmpty(report.client) && <span>{report.client}</span>}
                {formattedDate && <span>{formattedDate}</span>}
            </div>
        ) : null;

    if (roleLoading || loading) {
        return (
            <div className="flex min-h-screen flex-col bg-[#181818]">
                <AppPageHeader
                    onLogout={handleLogout}
                    breadcrumbs={[{ label: 'Группы', href: '/' }, { label: 'Загрузка...' }]}
                />
                <div className="flex flex-1 items-center justify-center text-[var(--color-grayscale-6)]">
                    Загрузка...
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex min-h-screen flex-col bg-[#181818]">
                <AppPageHeader
                    onLogout={handleLogout}
                    breadcrumbs={headerBreadcrumbs}
                    title="Отчет не найден"
                    description={
                        canEdit
                            ? 'Отчёт не существует, нет доступа к группе или для просмотра ещё не опубликован.'
                            : 'Отчёт не существует, нет доступа или он ещё не опубликован.'
                    }
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#181818]">
            <AppPageHeader
                onLogout={handleLogout}
                breadcrumbs={headerBreadcrumbs}
                title={
                    !isEmptyHtml(report.title) ? (
                        <span
                            className="report-rich-text text-balance text-3xl font-bold text-zinc-100 sm:text-4xl"
                            dangerouslySetInnerHTML={{ __html: report.title ?? '' }}
                        />
                    ) : (
                        reportTitlePlain || 'Отчёт'
                    )
                }
                description={
                    <div className="space-y-2">
                        {!isEmptyHtml(report.subtitle) && (
                            <div
                                className="report-rich-text text-lg text-zinc-300 [&_p]:whitespace-pre-wrap [&_li]:whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: report.subtitle ?? '' }}
                            />
                        )}
                        {reportMeta}
                    </div>
                }
                actions={
                    canEdit ? (
                        <div className="flex w-full flex-wrap items-stretch justify-end gap-2 print:hidden sm:w-auto">
                            <button
                                type="button"
                                onClick={() => router.push(getReportEditPublicPath(report))}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-[var(--color-alpha-3)] px-3 py-1.5 text-[var(--color-grayscale-5)] transition-colors hover:bg-[var(--color-grayscale-14)] cursor-pointer sm:flex-initial"
                            >
                                <Edit className="h-4 w-4 shrink-0" />
                                Редактор
                            </button>
                            <button
                                type="button"
                                onClick={handleExportPDF}
                                disabled={isExporting}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-[var(--color-alpha-3)] bg-[var(--color-primary)] px-3 py-1.5 text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer sm:flex-initial"
                            >
                                <Download className="h-4 w-4 shrink-0" />
                                {isExporting ? 'Генерация...' : 'PDF'}
                            </button>
                        </div>
                    ) : undefined
                }
            />

            <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                {canEdit && hasUnpublishedChanges && (
                    <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        Есть неопубликованные изменения. Просмотр показывает последнюю опубликованную версию.
                    </div>
                )}
                {(() => {
                    const sortedBlocks = sortBlocksByPosition(report.blocks ?? []);
                    if (sortedBlocks.length === 0) {
                        return (
                            <div className="rounded-lg border border-dashed border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-6 py-16 text-center">
                                <p className="text-[var(--color-grayscale-6)]">Блоки не добавлены</p>
                            </div>
                        );
                    }
                    return (
                        <div className="space-y-20">
                            {sortedBlocks.map((block) =>
                                block.type === 'task' ? (
                                    <TaskBlockCard
                                        key={block.id}
                                        blockId={block.id}
                                        reportId={report.id}
                                        groupId={report.group?.id}
                                        data={block.data as TaskBlockData}
                                        taskCompletedAt={block.taskCompletedAt}
                                        taskCompletedByUserId={block.taskCompletedByUserId}
                                        taskCompletionNotes={block.taskCompletionNotes}
                                        taskCompletionImages={block.taskCompletionImages as ImageData[] | null}
                                        taskCompletionLayout={block.taskCompletionLayout ?? null}
                                        currentUserId={currentUser?.id}
                                        canEdit={canEdit}
                                        showActions={false}
                                        titleFontSize={report.titleFontSize || '40'}
                                        descriptionFontSize={report.descriptionFontSize || '20'}
                                        captionFontSize={report.captionFontSize || '16'}
                                    />
                                ) : (
                                    <div key={block.id}>{renderBlock(block, report, { currentUserId: currentUser?.id, canEdit })}</div>
                                )
                            )}
                        </div>
                    );
                })()}
            </main>

            <footer className="border-t border-[var(--color-alpha-3)] py-6 print:hidden">
                <div className="mx-auto max-w-7xl px-4 text-center text-sm text-[var(--color-grayscale-7)] sm:px-6 lg:px-8">
                    Отчёты, которые работают
                </div>
            </footer>

            {canEdit && showFloatingEdit && !isLightboxOpen && (
                <button
                    onClick={() => router.push(getReportEditPublicPath(report))}
                    className="fixed right-4 bottom-24 z-50 rounded-full border border-[var(--color-alpha-3)]
                        bg-[var(--color-grayscale-14)] p-4 text-[var(--color-grayscale-4)] shadow-lg
                        transition-all duration-300 opacity-70 hover:bg-[var(--color-grayscale-13)]
                        hover:opacity-100 hover:shadow-xl group cursor-pointer print:hidden
                        sm:right-8 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
                    title="Редактировать отчет"
                    aria-label="Редактировать отчет"
                >
                    <Edit className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
            )}

            <AlertDialog open={pdfErrorOpen} onOpenChange={setPdfErrorOpen}>
                <AlertDialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">
                            Не удалось сформировать PDF
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Попробуйте ещё раз через минуту. Если ошибка повторяется, обновите
                            страницу или обратитесь к администратору.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction className="bg-zinc-700 text-white hover:bg-zinc-600">
                            Понятно
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function renderBlock(
    block: ReportBlockFromDB,
    report: ReportFromDB,
    ctx: { currentUserId?: string; canEdit: boolean }
) {
    if (block.type === 'screenshot') {
        return (
            <ScreenshotBlockView
                key={block.id}
                data={block.data as ScreenshotBlockData}
                titleFontSize={report.titleFontSize || '40'}
                descriptionFontSize={report.descriptionFontSize || '20'}
                captionFontSize={report.captionFontSize || '16'}
            />
        );
    }
    if (block.type === 'divider') {
        return <DividerBlockView key={block.id} />;
    }
    return (
        <TextBlockView
            key={block.id}
            data={block.data as TextBlockData}
            titleFontSize={report.titleFontSize || '40'}
            contentFontSize={report.descriptionFontSize || '20'}
        />
    );
}
