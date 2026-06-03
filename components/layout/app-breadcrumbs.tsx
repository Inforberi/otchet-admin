'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem as Crumb } from '@/lib/breadcrumbs';

type AppBreadcrumbsProps = {
    items: Crumb[];
    variant?: 'default' | 'editor';
};

export function AppBreadcrumbs({ items, variant = 'default' }: AppBreadcrumbsProps) {
    if (items.length === 0) return null;

    const linkClass =
        variant === 'editor'
            ? 'text-zinc-500 hover:text-zinc-200'
            : 'text-[var(--color-grayscale-6)] hover:text-[var(--color-grayscale-2)]';

    const pageClass =
        variant === 'editor'
            ? 'text-zinc-200 font-medium'
            : 'text-[var(--color-grayscale-3)] font-medium';

    const separatorClass =
        variant === 'editor' ? 'text-zinc-600' : 'text-[var(--color-grayscale-7)]';

    return (
        <Breadcrumb className="py-2">
            <BreadcrumbList className="text-[var(--color-grayscale-6)]">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;

                    return (
                        <Fragment key={`${item.label}-${index}`}>
                            {index > 0 && (
                                <BreadcrumbSeparator
                                    className={separatorClass}
                                />
                            )}
                            <BreadcrumbItem>
                                {isLast || !item.href ? (
                                    <BreadcrumbPage
                                        className={cn(
                                            'font-normal',
                                            pageClass
                                        )}
                                    >
                                        {item.label}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink
                                        asChild
                                        className={cn(
                                            'transition-colors',
                                            linkClass
                                        )}
                                    >
                                        <Link href={item.href}>
                                            {item.label}
                                        </Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
