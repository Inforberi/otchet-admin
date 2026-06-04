import sanitizeHtml from 'sanitize-html';

export const RICH_TEXT_SPACER_CLASS = 'rich-text-spacer';

const EMPTY_RICH_TEXT_PATTERN =
    /^(?:\s|&nbsp;|<br\s*\/?>|<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>)+$/i;

const SPACER_PARAGRAPH_RE = new RegExp(
    `<p[^>]*class="[^"]*${RICH_TEXT_SPACER_CLASS}[^"]*"[^>]*>[\\s\\S]*?<\\/p>`,
    'gi'
);

/** Пустой абзац без spacer-класса (только br/пробелы) */
const EMPTY_PARAGRAPH_RE =
    /<p(?![^>]*\brich-text-spacer\b)(?:\s[^>]*)?>\s*(?:&nbsp;|\s|<br\s*\/?>)*\s*<\/p>/gi;

export const escapeHtml = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const stripSpacerParagraphs = (html: string): string =>
    html.replace(SPACER_PARAGRAPH_RE, '').trim();

export const isRichTextEmpty = (value: string | null | undefined): boolean => {
    if (!value) return true;

    const normalized = value.trim();
    if (!normalized) return true;

    const withoutSpacers = stripSpacerParagraphs(normalized);
    if (!withoutSpacers) return true;

    const textOnly = withoutSpacers
        .replace(/<br\s*\/?>/gi, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .trim();

    return textOnly.length === 0 || EMPTY_RICH_TEXT_PATTERN.test(withoutSpacers);
};

const preserveSpacerParagraphs = (html: string): string =>
    html
        .replace(/<p><\/p>/gi, `<p class="${RICH_TEXT_SPACER_CLASS}"><br></p>`)
        .replace(EMPTY_PARAGRAPH_RE, `<p class="${RICH_TEXT_SPACER_CLASS}"><br></p>`);

export const normalizeRichTextHtml = (
    value: string | null | undefined
): string => {
    if (!value) return '';

    const normalized = value.trim();
    if (!normalized || isRichTextEmpty(normalized)) return '';

    return preserveSpacerParagraphs(normalized).trim();
};

/** Размер «заголовка» внутри описания блока (px) */
export const DESCRIPTION_HEADING_FONT_SIZE_PX = '24';

/** Единый формат для props, emit и сравнения (inline — без обёртки p) */
export const canonicalRichTextValue = (
    html: string | null | undefined,
    mode: 'inline' | 'block'
): string => {
    const normalized = normalizeRichTextHtml(html);

    if (!normalized || mode === 'block') return normalized;

    return normalized
        .replace(/^<p>/i, '')
        .replace(/<\/p>$/i, '')
        .replace(/<\/p>\s*<p>/gi, '<br>');
};

/** Убирает inline font-size — единый стиль через заголовки и размер блока */
export const stripInlineFontSizes = (html: string): string =>
    html
        .replace(/\s*font-size:\s*[^;"']+;?/gi, '')
        .replace(/\s*font-family:\s*[^;"']+;?/gi, '')
        .replace(/\s*style="\s*"/gi, '')
        .replace(/\s*style=''\s*/gi, '');

/** Вставка/legacy: убрать чужие px и теги h* */
export const normalizePastedTypographyHtml = (
    html: string | null | undefined
): string => {
    if (!html) return '';

    let next = stripInlineFontSizes(html);
    next = next
        .replace(/<h1(\s[^>]*)?>/gi, '<p>')
        .replace(/<\/h1>/gi, '</p>')
        .replace(/<h2(\s[^>]*)?>/gi, '<p>')
        .replace(/<\/h2>/gi, '</p>')
        .replace(/<h3(\s[^>]*)?>/gi, '<p>')
        .replace(/<\/h3>/gi, '</p>');
    return normalizeRichTextHtml(next);
};

const PASTE_ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'blockquote',
    'span',
    'a',
    'h1',
    'h2',
    'h3',
];

const PASTE_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
    p: ['class'],
    span: ['style'],
    a: ['href', 'target', 'rel'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    blockquote: ['style'],
};

const PASTE_ALLOWED_STYLES: sanitizeHtml.IOptions['allowedStyles'] = {
    '*': {
        color: [
            /^#[0-9a-fA-F]{6}$/,
            /^rgb\(\s?\d{1,3}\s?,\s?\d{1,3}\s?,\s?\d{1,3}\s?\)$/,
        ],
        'text-align': [/^(left|center|right)$/],
    },
};

const stripStyleFontSize = (style: string | undefined): string | undefined => {
    if (!style) return undefined;
    const cleaned = style
        .replace(/\s*font-size:\s*[^;]+;?/gi, '')
        .replace(/\s*font-family:\s*[^;]+;?/gi, '')
        .trim()
        .replace(/;\s*;/g, ';')
        .replace(/^;|;$/g, '')
        .trim();
    return cleaned || undefined;
};

/** Вставка из буфера: без чужих font-size; заголовки → абзацы */
export const sanitizePastedHtml = (html: string): string =>
    normalizePastedTypographyHtml(
        sanitizeHtml(html, {
            allowedTags: PASTE_ALLOWED_TAGS,
            allowedAttributes: PASTE_ALLOWED_ATTRIBUTES,
            allowedStyles: PASTE_ALLOWED_STYLES,
            allowedSchemes: ['http', 'https', 'mailto'],
            transformTags: {
                h1: () => ({ tagName: 'p', attribs: {} }),
                h2: () => ({ tagName: 'p', attribs: {} }),
                h3: () => ({ tagName: 'p', attribs: {} }),
                span: (_tag, attribs) => {
                    const style = stripStyleFontSize(attribs.style);
                    const next: Record<string, string> = {};
                    if (style) next.style = style;
                    return { tagName: 'span', attribs: next };
                },
                a: (_tag, attribs) => ({
                    tagName: 'a',
                    attribs: {
                        href: attribs.href ?? '',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                    },
                }),
            },
        })
    );

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
