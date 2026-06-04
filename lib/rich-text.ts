const EMPTY_RICH_TEXT_PATTERN =
    /^(?:\s|&nbsp;|<br\s*\/?>|<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>)+$/i;

export const escapeHtml = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

export const isRichTextEmpty = (value: string | null | undefined): boolean => {
    if (!value) return true;

    const normalized = value.trim();
    if (!normalized) return true;

    const textOnly = normalized
        .replace(/<br\s*\/?>/gi, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .trim();

    return textOnly.length === 0 || EMPTY_RICH_TEXT_PATTERN.test(normalized);
};

export const normalizeRichTextHtml = (
    value: string | null | undefined
): string => {
    if (!value) return '';

    const normalized = value.trim();
    if (!normalized || isRichTextEmpty(normalized)) return '';

    return normalized
        .replace(/<p><\/p>/gi, '')
        .replace(/<p>(?:<br\s*\/?>|\s|&nbsp;)*<\/p>/gi, '')
        .trim();
};

/** Первый font-size: Npx из HTML (span/p/h*) для синхронизации toolbar */
export const extractFontSizeFromHtml = (
    html: string | null | undefined
): string | null => {
    if (!html) return null;
    const match = html.match(/font-size:\s*(\d{1,3})px/i);
    return match ? match[1] : null;
};

export const plainTextToRichTextHtml = (
    value: string,
    mode: 'inline' | 'block'
): string => {
    const normalized = value.replace(/\r\n/g, '\n');
    if (!normalized.trim()) return '';

    if (mode === 'inline') {
        return normalized
            .split('\n')
            .map((line) => escapeHtml(line))
            .join('<br>');
    }

    return normalized
        .split(/\n{2,}/)
        .map((paragraph) => {
            const html = paragraph
                .split('\n')
                .map((line) => escapeHtml(line))
                .join('<br>');

            return `<p>${html || '<br>'}</p>`;
        })
        .join('');
};
