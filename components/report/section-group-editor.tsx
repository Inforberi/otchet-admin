'use client';

import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReportBlockFromDB, SectionBlockData } from '@/lib/db-types';
import { isSectionCollapsed } from '@/lib/block-tree';

const FormattedTextEditor = dynamic(
    () => import('@/components/editor/rich-text-editor'),
    {
        ssr: false,
        loading: () => (
            <div className="h-12 rounded border border-zinc-700 bg-zinc-800" />
        ),
    }
);

type SectionGroupEditorProps = {
    section: ReportBlockFromDB;
    titlePreview: string;
    childCount: number;
    onDataChange: (data: SectionBlockData) => void;
    onToggleCollapsed: () => void;
};

export function SectionGroupEditor({
    section,
    titlePreview,
    childCount,
    onDataChange,
    onToggleCollapsed,
}: SectionGroupEditorProps) {
    const data = section.data as SectionBlockData;
    const collapsed = isSectionCollapsed(section);

    const headerRow = (
        <div className="flex flex-col gap-2 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                <span className="shrink-0 rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white">
                    Группа
                </span>
                <p className="min-w-0 truncate text-base font-medium text-zinc-200 sm:text-lg">
                    {titlePreview}
                </p>
                {childCount > 0 ? (
                    <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">
                        · {childCount}{' '}
                        {childCount === 1
                            ? 'блок'
                            : childCount < 5
                              ? 'блока'
                              : 'блоков'}
                    </span>
                ) : null}
            </div>
            <button
                type="button"
                onClick={onToggleCollapsed}
                className="self-end rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer sm:self-auto"
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Развернуть группу' : 'Свернуть группу'}
            >
                {collapsed ? (
                    <ChevronDown className="h-5 w-5" />
                ) : (
                    <ChevronUp className="h-5 w-5" />
                )}
            </button>
        </div>
    );

    if (collapsed) {
        return (
            <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900">
                {headerRow}
            </div>
        );
    }

    return (
        <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900">
            {headerRow}
            <div className="space-y-4 p-4">
                <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                        Заголовок (опционально)
                    </label>
                    <FormattedTextEditor
                        editorId={`${section.id}:section-title`}
                        value={data.title || ''}
                        onChange={(value) =>
                            onDataChange({ ...data, title: value })
                        }
                        placeholder="Заголовок раздела..."
                        minHeight="60px"
                        defaultFontSize="40"
                        mode="inline"
                    />
                </div>
            </div>
        </div>
    );
}
