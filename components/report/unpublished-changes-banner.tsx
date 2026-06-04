'use client';

export function UnpublishedChangesBanner() {
    return (
        <div
            className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm leading-snug text-amber-200"
            role="status"
        >
            Есть неопубликованные изменения. На странице просмотра читатели видят последнюю
            опубликованную версию — нажмите «Опубликовать», чтобы обновить.
        </div>
    );
}
