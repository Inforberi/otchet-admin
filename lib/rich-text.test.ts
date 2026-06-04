import {
    countSpacerParagraphs,
    normalizeRichTextHtml,
    preferRichTextWithMoreSpacers,
} from './rich-text';
import { sanitizeRichTextHtml } from './rich-text-sanitize';

const assert = (condition: boolean, message: string) => {
    if (!condition) {
        throw new Error(message);
    }
};

const run = () => {
    const input = '<p>a</p><p></p><p><br></p><p></p><p>b</p>';
    const normalized = normalizeRichTextHtml(input);
    assert(countSpacerParagraphs(normalized) === 3, 'normalize keeps 3 spacers');

    const sanitized = sanitizeRichTextHtml(input);
    assert(
        countSpacerParagraphs(sanitized) === 3,
        'sanitize round-trip keeps 3 spacers'
    );

    const local =
        '<p>a</p><p class="rich-text-spacer"><br></p><p class="rich-text-spacer"><br></p><p class="rich-text-spacer"><br></p><p>b</p>';
    const server = '<p>a</p><p class="rich-text-spacer"><br></p><p>b</p>';
    assert(
        preferRichTextWithMoreSpacers(local, server) === local,
        'prefer local when more spacers with same text'
    );

    console.log('rich-text.test.ts: all assertions passed');
};

run();
