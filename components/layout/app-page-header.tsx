'use client';

import type { ReactNode } from 'react';
import { AppTopNav } from '@/components/layout/app-top-nav';
import { AppBreadcrumbs } from '@/components/layout/app-breadcrumbs';
import type { BreadcrumbItem } from '@/lib/breadcrumbs';

type AppPageHeaderProps = {
    onLogout: () => void | Promise<void>;
    breadcrumbs: BreadcrumbItem[];
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    variant?: 'default' | 'editor';
    /** По умолчанию true; false — только в конструкторе отчёта */
    showBreadcrumbs?: boolean;
};

export function AppPageHeader({
    onLogout,
    breadcrumbs,
    title,
    description,
    actions,
    variant = 'default',
    showBreadcrumbs = true,
}: AppPageHeaderProps) {
    const isEditor = variant === 'editor';

    const wrapperClass = isEditor
        ? 'border-b border-zinc-800 bg-zinc-900'
        : 'border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]/95 backdrop-blur';

    return (
        <header className={wrapperClass}>
            <div
                className={
                    isEditor
                        ? 'flex flex-col'
                        : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'
                }
            >
                <div className={isEditor ? '' : 'pt-4'}>
                    <AppTopNav onLogout={onLogout} variant={variant} />
                </div>

                <div
                    className={
                        isEditor
                            ? 'px-4 pb-3'
                            : 'pb-6'
                    }
                >
                    {showBreadcrumbs && (
                        <AppBreadcrumbs items={breadcrumbs} variant={variant} />
                    )}

                    {(title || actions) && (
                        <div
                            className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                                showBreadcrumbs ? 'mt-2' : 'mt-0'
                            }`}
                        >
                            {(title || description) && (
                                <div className="min-w-0 flex-1">
                                    {title && (
                                        <div
                                            className={
                                                isEditor
                                                    ? 'text-lg font-semibold text-white'
                                                    : 'text-3xl font-bold text-[var(--color-grayscale-2)]'
                                            }
                                        >
                                            {title}
                                        </div>
                                    )}
                                    {description && (
                                        <div
                                            className={
                                                isEditor
                                                    ? 'mt-1 text-sm text-zinc-400'
                                                    : 'mt-1 text-sm text-[var(--color-grayscale-6)]'
                                            }
                                        >
                                            {description}
                                        </div>
                                    )}
                                </div>
                            )}
                            {actions && (
                                <div className="flex shrink-0 flex-wrap items-center gap-3">
                                    {actions}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
