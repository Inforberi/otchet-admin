'use client';

import { useMemo, type CSSProperties, type ElementType } from 'react';
import { normalizeRichTextHtml } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

interface RichTextViewProps {
    html: string | null | undefined;
    className?: string;
    style?: CSSProperties;
    as?: ElementType;
}

export function RichTextView({
    html,
    className,
    style,
    as: Component = 'div',
}: RichTextViewProps) {
    const normalizedHtml = useMemo(
        () => normalizeRichTextHtml(html),
        [html]
    );

    if (!normalizedHtml) return null;

    return (
        <Component
            className={cn('report-rich-text', className)}
            style={style}
            dangerouslySetInnerHTML={{ __html: normalizedHtml }}
        />
    );
}
