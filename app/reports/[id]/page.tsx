'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type {
    ReportFromDB,
    ScreenshotBlockData,
    TextBlockData,
} from '@/lib/db-types';
import { ScreenshotBlockView } from '@/components/report/screenshot-block-view';
import { TextBlockView } from '@/components/report/text-block-view';
import { DividerBlockView } from '@/components/report/divider-block-view';
import { FileQuestion, ArrowLeft, Download, Edit } from 'lucide-react';

export default function ReportViewPage() {
    const router = useRouter();
    const params = useParams();
    const reportId = params.id as string;

    const [report, setReport] = useState<ReportFromDB | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        loadReport();
    }, [reportId]);

    const loadReport = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/reports/${reportId}`);
            if (response.ok) {
                const { report } = await response.json();
                setReport(report);
            }
        } catch (error) {
            console.error('Error loading report:', error);
        } finally {
            setLoading(false);
        }
    };

    // PDF export временно отключен
    const handleExportPDF = async () => {
        alert(
            'PDF экспорт временно недоступен. Используйте печать браузера (Ctrl/Cmd+P)'
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#181818]">
                <div className="text-[var(--color-grayscale-6)]">
                    Загрузка...
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#181818] px-4">
                <div className="text-center">
                    <div className="mb-4 inline-flex items-center justify-center rounded-full bg-[var(--color-grayscale-14)] p-4">
                        <FileQuestion className="h-10 w-10 text-[var(--color-grayscale-6)]" />
                    </div>
                    <h1 className="mb-2 text-2xl font-semibold text-[var(--color-grayscale-3)]">
                        Отчет не найден
                    </h1>
                    <p className="mb-6 text-[var(--color-grayscale-6)]">
                        Возможно, он был удален или не существует.
                    </p>
                    <button
                        onClick={() => router.push('/reports')}
                        className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
                    >
                        <ArrowLeft className="h-4 w-4" />К списку отчетов
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#181818]">
            {/* Header */}
            <header className="border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="mb-4 flex items-center gap-2">
                        <button
                            onClick={() => router.push('/reports')}
                            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] print:hidden"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <span className="text-sm text-zinc-400 print:hidden">
                            Назад к списку
                        </span>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                            <h1 className="text-balance text-3xl font-bold text-zinc-100 sm:text-4xl">
                                {report.title}
                            </h1>
                            {report.subtitle && (
                                <p className="text-lg text-zinc-300 whitespace-pre-wrap">
                                    {report.subtitle}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-2 text-sm text-zinc-400">
                            {report.client && <span>{report.client}</span>}
                            {report.date && <span>{report.date}</span>}
                            <div className="mt-2 flex gap-2">
                                <button
                                    onClick={() =>
                                        router.push(`/reports/${reportId}/edit`)
                                    }
                                    className="inline-flex items-center gap-1.5 rounded border border-[var(--color-alpha-3)] px-3 py-1.5 text-[var(--color-grayscale-5)] transition-colors hover:bg-[var(--color-grayscale-14)] print:hidden"
                                >
                                    <Edit className="h-4 w-4" />
                                    Редактор
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    className="inline-flex items-center gap-1.5 rounded border border-[var(--color-alpha-3)] bg-[var(--color-primary)] px-3 py-1.5 text-white transition-opacity hover:opacity-90 print:hidden"
                                    title="PDF экспорт временно отключен"
                                >
                                    <Download className="h-4 w-4" />
                                    PDF (скоро)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
                                    />
                                );
                            } else if (block.type === 'divider') {
                                return <DividerBlockView key={block.id} />;
                            } else {
                                return (
                                    <TextBlockView
                                        key={block.id}
                                        data={block.data as TextBlockData}
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
                    Сгенерировано с помощью конструктора отчётов
                </div>
            </footer>
        </div>
    );
}
