import type { BaseBlockData } from '@/lib/db-types';
import { isEmptyRichHtml } from '@/lib/rich-text-empty';
import { RichTextView } from './rich-text-view';

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
        <RichTextView
            as="h2"
            html={title}
            className={`font-semibold text-zinc-100 mb-8 tracking-tight ${className}`.trim()}
            style={{ fontSize: `${titleFontSize}px` }}
        />
    );
}

export const hasBlockTitle = (data: Pick<BaseBlockData, 'title'>): boolean =>
    !isEmptyRichHtml(data.title);
