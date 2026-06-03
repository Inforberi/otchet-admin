import sanitizeHtml from 'sanitize-html';
import { normalizeRichTextHtml } from '@/lib/rich-text';

const ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'blockquote',
    'span',
    'h1',
    'h2',
    'h3',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
    p: ['style'],
    span: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    blockquote: ['style'],
};

const ALLOWED_STYLES: sanitizeHtml.IOptions['allowedStyles'] = {
    '*': {
        color: [
            /^#[0-9a-fA-F]{6}$/,
            /^rgb\(\s?\d{1,3}\s?,\s?\d{1,3}\s?,\s?\d{1,3}\s?\)$/,
        ],
        'font-size': [/^\d{1,3}px$/],
        'text-align': [/^(left|center|right)$/],
    },
};

export const sanitizeRichTextHtml = (
    value: string | null | undefined
): string =>
    normalizeRichTextHtml(
        sanitizeHtml(normalizeRichTextHtml(value), {
            allowedTags: ALLOWED_TAGS,
            allowedAttributes: ALLOWED_ATTRIBUTES,
            allowedStyles: ALLOWED_STYLES,
            parser: {
                lowerCaseTags: true,
            },
        })
    );
