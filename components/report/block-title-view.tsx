import type { BaseBlockData } from '@/lib/db-types';
import { isEmptyRichHtml } from '@/lib/rich-text-empty';

export { isEmptyRichHtml };

type BlockTitleViewProps = {
    title: string;
    titleFontSize?: string;
    className?: string;
};

export function BlockTitleView({
    title,
    titleFontSize = '40',
    className = '',
}: BlockTitleViewProps) {
    if (isEmptyRichHtml(title)) return null;

    return (
        <h2
            className={`report-rich-text font-semibold text-zinc-100 mb-8 tracking-tight ${className}`.trim()}
            style={{ fontSize: `${titleFontSize}px` }}
            dangerouslySetInnerHTML={{ __html: title }}
        />
    );
}

export const hasBlockTitle = (data: Pick<BaseBlockData, 'title'>): boolean =>
    !isEmptyRichHtml(data.title);
