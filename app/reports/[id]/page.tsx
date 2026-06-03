'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type {
    ReportFromDB,
    ScreenshotBlockData,
    TextBlockData,
} from '@/lib/db-types';
import { ScreenshotBlockView } from '@/components/report/screenshot-block-view';
import { TextBlockView } from '@/components/report/text-block-view';
import { DividerBlockView } from '@/components/report/divider-block-view';
import { FileQuestion, Download, Edit } from 'lucide-react';
import { AppPageHeader } from '@/components/layout/app-page-header';
import { useUserRole } from '@/hooks/use-user-role';
import {
    buildReportViewBreadcrumbs,
    stripHtml,
    type GroupAncestor,
} from '@/lib/breadcrumbs';
import { formatReportDateLabel } from '@/lib/report-date-range';

// Функция для проверки, является ли HTML строка пустой
function isEmptyHtml(html: string | null | undefined): boolean {
    if (!html) return true;
    // Удаляем HTML теги и проверяем, осталось ли что-то кроме пробелов
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    return textContent.length === 0;
}

// Функция для проверки, является ли обычная строка пустой
function isEmpty(str: string | null | undefined): boolean {
    if (!str) return true;
    return str.trim().length === 0;
}

export default function ReportViewPage() {
    const router = useRouter();
    const params = useParams();
    const reportId = params.id as string;
    const { canEdit, loading: roleLoading } = useUserRole();

    const [report, setReport] = useState<ReportFromDB | null>(null);
    const [ancestors, setAncestors] = useState<GroupAncestor[]>([]);
    const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
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
            report.title || 'Отчёт'
        );
    }, [ancestors, report]);

    useEffect(() => {
        if (roleLoading) return;
        void loadReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportId, canEdit, roleLoading]);

    // Отслеживание скролла для показа плавающей кнопки редактирования (только для админа)
    useEffect(() => {
        if (!canEdit) return;

        const handleScroll = () => {
            // Показываем кнопку после прокрутки на 200px вниз
            const scrollY = window.scrollY || window.pageYOffset;
            setShowFloatingEdit(scrollY > 200);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [canEdit]);

    // Отслеживание открытия/закрытия lightbox
    useEffect(() => {
        if (!canEdit) return;

        const checkLightbox = () => {
            // Проверяем наличие lightbox в DOM (элемент с bg-black/90 и z-50)
            const lightbox = document.querySelector('[class*="bg-black/90"][class*="z-50"]');
            // Также проверяем overflow body как дополнительную проверку
            const bodyOverflow = document.body.style.overflow;
            setIsLightboxOpen(!!lightbox || bodyOverflow === 'hidden');
        };

        // Проверяем каждые 100ms
        const interval = setInterval(checkLightbox, 100);

        // Также проверяем при изменении DOM
        const observer = new MutationObserver(checkLightbox);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
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
            const response = await fetch(`/api/reports/${reportId}${query}`);
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
            const response = await fetch(`/api/reports/${reportId}/pdf`);

            if (!response.ok) {
                throw new Error('Ошибка при генерации PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Получаем имя файла из заголовка Content-Disposition
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = report?.title
                ? `${report.title.replace(/<[^>]*>/g, '').trim()}.pdf`
                : `report_${reportId}.pdf`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Ошибка при генерации PDF. Попробуйте позже.');
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

    const formattedDate = report?.date
        ? formatReportDateLabel(report.date)
        : '';

    const reportMeta =
        report &&
        (!isEmpty(report.client) || formattedDate) ? (
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
                    breadcrumbs={[
                        { label: 'Группы', href: '/' },
                        { label: 'Загрузка...' },
                    ]}
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
                            className="text-balance text-3xl font-bold text-zinc-100 sm:text-4xl"
                            dangerouslySetInnerHTML={{
                                __html: report.title ?? '',
                            }}
                        />
                    ) : (
                        reportTitlePlain || 'Отчёт'
                    )
                }
                description={
                    <div className="space-y-2">
                        {!isEmptyHtml(report.subtitle) && (
                            <div
                                className="text-lg text-zinc-300 whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{
                                    __html: report.subtitle ?? '',
                                }}
                            />
                        )}
                        {reportMeta}
                    </div>
                }
                actions={
                    canEdit ? (
                        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(`/reports/${reportId}/edit`)
                                    }
                                    className="inline-flex items-center gap-1.5 rounded border border-[var(--color-alpha-3)] px-3 py-1.5 text-[var(--color-grayscale-5)] transition-colors hover:bg-[var(--color-grayscale-14)] cursor-pointer"
                                >
                                    <Edit className="h-4 w-4" />
                                    Редактор
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportPDF}
                                    disabled={isExporting}
                                    className="inline-flex items-center gap-1.5 rounded border border-[var(--color-alpha-3)] bg-[var(--color-primary)] px-3 py-1.5 text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                                >
                                    <Download className="h-4 w-4" />
                                    {isExporting ? 'Генерация...' : 'PDF'}
                                </button>
                            </div>
                        </div>
                    ) : undefined
                }
            />

            {/* Content */}
            <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                {canEdit && hasUnpublishedChanges && (
                    <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        Есть неопубликованные изменения. Просмотр показывает последнюю опубликованную версию.
                    </div>
                )}
                {!report.blocks || report.blocks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-6 py-16 text-center">
                        <p className="text-[var(--color-grayscale-6)]">
                            Блоки не добавлены
                        </p>
                    </div>
                ) : (
                    <div className="space-y-20">
                        {report.blocks.map((block) => {
                            if (block.type === 'screenshot') {
                                return (
                                    <ScreenshotBlockView
                                        key={block.id}
                                        data={block.data as ScreenshotBlockData}
                                        titleFontSize={
                                            report.titleFontSize || '40'
                                        }
                                        descriptionFontSize={
                                            report.descriptionFontSize || '20'
                                        }
                                        captionFontSize={
                                            report.captionFontSize || '16'
                                        }
                                    />
                                );
                            } else if (block.type === 'divider') {
                                return <DividerBlockView key={block.id} />;
                            } else {
                                return (
                                    <TextBlockView
                                        key={block.id}
                                        data={block.data as TextBlockData}
                                        titleFontSize={
                                            report.titleFontSize || '40'
                                        }
                                        contentFontSize={
                                            report.descriptionFontSize || '20'
                                        }
                                    />
                                );
                            }
                        })}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-[var(--color-alpha-3)] py-6 print:hidden">
                <div className="mx-auto max-w-7xl px-4 text-center text-sm text-[var(--color-grayscale-7)] sm:px-6 lg:px-8">
                    Отчёты, которые работают
                </div>
            </footer>

            {/* Floating Edit Button */}
            {canEdit && showFloatingEdit && !isLightboxOpen && (
                <button
                    onClick={() => router.push(`/reports/${reportId}/edit`)}
                    className="fixed right-8 top-1/2 -translate-y-1/2 z-50 print:hidden
                        bg-[var(--color-grayscale-14)] hover:bg-[var(--color-grayscale-13)] 
                        text-[var(--color-grayscale-4)] rounded-full p-4
                        shadow-lg hover:shadow-xl transition-all duration-300
                        border border-[var(--color-alpha-3)]
                        opacity-70 hover:opacity-100
                        group cursor-pointer"
                    title="Редактировать отчет"
                    aria-label="Редактировать отчет"
                >
                    <Edit className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
            )}
        </div>
    );
}
