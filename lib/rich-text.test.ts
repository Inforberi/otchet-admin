import {
    countSpacerParagraphs,
    normalizeRichTextHtml,
    preferRichTextWithMoreSpacers,
    sanitizePastedHtml,
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

    const pastedColor = sanitizePastedHtml(
        '<p><span style="color:#000000">x</span></p>'
    );
    assert(!/color\s*:/i.test(pastedColor), 'paste strips hex color');

    const pastedColorWithAlign = sanitizePastedHtml(
        '<p><span style="color:rgb(1,2,3); text-align:center">x</span></p>'
    );
    assert(!/color\s*:/i.test(pastedColorWithAlign), 'paste strips rgb color');
    assert(
        /text-align:\s*center/i.test(pastedColorWithAlign),
        'paste keeps allowed text-align'
    );

    const manualColor = sanitizeRichTextHtml(
        '<p><span style="color:#ffffff">x</span></p>'
    );
    assert(/color:\s*#ffffff/i.test(manualColor), 'save keeps manual color');

    console.log('rich-text.test.ts: all assertions passed');
};

run();
