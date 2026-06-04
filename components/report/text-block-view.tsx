import type { TextBlockData } from '@/lib/db-types';

interface TextBlockViewProps {
    data: TextBlockData;
    titleFontSize?: string;
    contentFontSize?: string;
}

// Функция для проверки, является ли HTML строка пустой
function isEmptyHtml(html: string | null | undefined): boolean {
    if (!html) return true;
    // Удаляем HTML теги и проверяем, осталось ли что-то кроме пробелов
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    return textContent.length === 0;
}

export function TextBlockView({ data, titleFontSize = '40', contentFontSize = '20' }: TextBlockViewProps) {
    // Не показываем блок, если нет ни заголовка, ни контента
    const hasTitle = !isEmptyHtml(data.title);
    const hasContent = !isEmptyHtml(data.content);
    
    if (!hasTitle && !hasContent) {
        return null;
    }

    return (
        <section className="space-y-8">
            {hasTitle && (
                <h2
                    className="report-rich-text font-semibold text-zinc-100 mb-8 tracking-tight"
                    style={{ fontSize: `${titleFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: data.title }}
                />
            )}

            {hasContent && (
                <div
                    className="report-rich-text text-zinc-300 leading-relaxed [&_p]:whitespace-pre-wrap [&_li]:whitespace-pre-wrap"
                    style={{ fontSize: `${contentFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: data.content }}
                />
            )}
        </section>
    );
}
