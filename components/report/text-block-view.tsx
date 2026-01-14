import type { TextBlockData } from '@/lib/db-types';

interface TextBlockViewProps {
    data: TextBlockData;
}

export function TextBlockView({ data }: TextBlockViewProps) {
    // Не показываем блок, если нет ни заголовка, ни контента
    if (!data.title && !data.content) {
        return null;
    }

    return (
        <section className="space-y-8">
            {data.title && (
                <h2 className="text-[24px] font-semibold text-zinc-100 mb-8 tracking-tight">
                    {data.title}
                </h2>
            )}

            {data.content && (
                <div className="text-[18px] text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {data.content}
                </div>
            )}
        </section>
    );
}
