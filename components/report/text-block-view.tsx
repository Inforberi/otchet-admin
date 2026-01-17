import type { TextBlockData } from '@/lib/db-types';

interface TextBlockViewProps {
    data: TextBlockData;
    titleFontSize?: string;
    contentFontSize?: string;
}

export function TextBlockView({ data, titleFontSize = '40', contentFontSize = '20' }: TextBlockViewProps) {
    // Не показываем блок, если нет ни заголовка, ни контента
    if (!data.title && !data.content) {
        return null;
    }

    return (
        <section className="space-y-8">
            {data.title && (
                <h2
                    className="font-semibold text-zinc-100 mb-8 tracking-tight"
                    style={{ fontSize: `${titleFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: data.title }}
                />
            )}

            {data.content && (
                <div
                    className="text-zinc-300 whitespace-pre-wrap leading-relaxed"
                    style={{ fontSize: `${contentFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: data.content }}
                />
            )}
        </section>
    );
}
