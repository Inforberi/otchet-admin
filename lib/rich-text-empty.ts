/** Проверка пустого rich-text HTML (без React, для API и серверных маршрутов). */
export const isEmptyRichHtml = (html: string | null | undefined): boolean => {
    if (!html) return true;
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    return textContent.length === 0;
};
