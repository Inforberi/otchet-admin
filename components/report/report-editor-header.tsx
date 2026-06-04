'use client';

import Link from 'next/link';
import { forwardRef, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { AppTopNav } from '@/components/layout/app-top-nav';

export type ReportEditorShellProps = {
    groupBackHref: string;
    groupBackLabel: string;
    reportTitle?: string;
    onLogout: () => void | Promise<void>;
    toolbar: ReactNode;
};

export const ReportEditorShell = forwardRef<HTMLElement, ReportEditorShellProps>(
    function ReportEditorShell(
        { groupBackHref, groupBackLabel, reportTitle, onLogout, toolbar },
        ref
    ) {
        const hasTitle = Boolean(reportTitle?.trim());

        return (
            <header
                ref={ref}
                className="sticky top-0 z-30 shrink-0 border-b border-zinc-800 bg-zinc-900"
            >
                <AppTopNav onLogout={onLogout} variant="editor" />
                <div className="flex min-w-0 items-center gap-2 border-t border-zinc-800/80 px-4 py-2">
                    <div className="flex min-w-0 max-w-[9rem] shrink-0 items-center gap-1.5 overflow-hidden sm:max-w-[11rem] md:max-w-[14rem] lg:max-w-[18rem]">
                        <Link
                            href={groupBackHref}
                            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
                            title={`К группе: ${groupBackLabel}`}
                            aria-label={`Назад к группе: ${groupBackLabel}`}
                        >
                            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="truncate">{groupBackLabel}</span>
                        </Link>
                        {hasTitle && (
                            <>
                                <ChevronRight
                                    className="h-4 w-4 shrink-0 text-zinc-600"
                                    aria-hidden
                                />
                                <p
                                    className="min-w-0 truncate text-sm font-medium text-zinc-200"
                                    title={reportTitle}
                                >
                                    {reportTitle}
                                </p>
                            </>
                        )}
                    </div>
                    <div
                        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        tabIndex={0}
                        aria-label="Панель действий — прокрутите влево-вправо при нехватке места"
                    >
                        <div className="flex min-w-full justify-end pr-0.5">
                            {toolbar}
                        </div>
                    </div>
                </div>
            </header>
        );
    }
);

/** @deprecated Use ReportEditorShell */
export const ReportEditorHeader = ReportEditorShell;
