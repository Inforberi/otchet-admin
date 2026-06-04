'use client';

import { FolderOpen, Settings } from 'lucide-react';

export type GroupFolderCardProps = {
    name: string;
    description?: string | null;
    reportsCount: number;
    childrenCount: number;
    canEdit?: boolean;
    showDeleteHint?: boolean;
    onOpen: () => void;
    onEdit?: (event: React.MouseEvent) => void;
};

export const GroupFolderCard = ({
    name,
    description,
    reportsCount,
    childrenCount,
    canEdit = false,
    showDeleteHint = false,
    onOpen,
    onEdit,
}: GroupFolderCardProps) => {
    const isNonEmpty = reportsCount > 0 || childrenCount > 0;

    return (
        <div className="group/card relative flex flex-col rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] transition-all hover:border-[var(--color-primary)] hover:shadow-lg">
            {canEdit && onEdit && (
                <button
                    type="button"
                    onClick={onEdit}
                    className="absolute right-3 top-3 z-10 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-5)] opacity-0 transition-opacity hover:bg-[var(--color-grayscale-13)] hover:text-[var(--color-grayscale-3)] group-hover/card:opacity-100 cursor-pointer"
                    title="Настройки папки"
                    aria-label="Настройки папки"
                >
                    <Settings className="h-4 w-4" />
                </button>
            )}
            <button
                type="button"
                onClick={onOpen}
                className="flex w-full flex-col p-6 text-left cursor-pointer"
            >
                <div className="mb-4 flex items-start justify-between pr-8">
                    <div className="rounded-lg bg-[var(--color-primary)]/10 p-3">
                        <FolderOpen className="h-6 w-6 text-[var(--color-primary)]" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-grayscale-6)]">
                        {reportsCount} отчетов
                        {childrenCount > 0 ? ` • ${childrenCount} групп` : ''}
                    </span>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-[var(--color-grayscale-2)]">
                    {name}
                </h3>
                {description && (
                    <p className="line-clamp-2 text-sm text-[var(--color-grayscale-6)]">
                        {description}
                    </p>
                )}
                {showDeleteHint && isNonEmpty && canEdit && (
                    <p className="mt-2 text-xs text-[var(--color-grayscale-7)]">
                        Для удаления сначала очистите папку
                    </p>
                )}
                <div className="mt-4 flex items-center text-sm font-medium text-[var(--color-primary)] opacity-0 transition-opacity group-hover/card:opacity-100">
                    Открыть группу
                    <svg
                        className="ml-2 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                </div>
            </button>
        </div>
    );
};
