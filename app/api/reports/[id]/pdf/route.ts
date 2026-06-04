import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { launchPdfBrowser } from '@/lib/playwright-pdf';
import type {
    ReportFromDB,
    ScreenshotBlockData,
    TextBlockData,
    DividerBlockData,
    TaskBlockData,
    SectionBlockData,
    ImageData,
} from '@/lib/db-types';
import { buildEditorTree, flattenTree } from '@/lib/block-tree';
import { isEmptyRichHtml } from '@/lib/rich-text-empty';
import { formatAssigneesList, normalizeTaskAssignees } from '@/lib/task-assignees';
import { resolvePdfImageSrc } from '@/lib/pdf-embed-images';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// GET /api/reports/[id]/pdf - генерация PDF отчета
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Получаем отчет из БД
        const report = await prisma.report.findUnique({
            where: { id },
            include: {
                blocks: {
                    orderBy: { position: 'asc' },
                },
            },
        });

        if (!report) {
            return NextResponse.json(
                { error: 'Report not found' },
                { status: 404 }
            );
        }

        // Получаем базовый URL для изображений
        // Используем URL из запроса напрямую, чтобы получить правильный порт
        const requestUrl = new URL(request.url);
        const baseUrl =
            process.env.PDF_INTERNAL_BASE_URL?.trim() ||
            `${requestUrl.protocol}//${requestUrl.host}`;

        // Приводим тип отчета к ReportFromDB (Prisma возвращает type как string, а не литеральный тип)
        const reportWithTypedBlocks: ReportFromDB = {
            ...report,
            publishedSnapshot: report.publishedSnapshot,
            blocks: report.blocks.map((block) => ({
                ...block,
                type: block.type as 'text' | 'screenshot' | 'divider' | 'task' | 'section',
                parentId: block.parentId ?? null,
                data: block.data as
                    | TextBlockData
                    | ScreenshotBlockData
                    | DividerBlockData
                    | TaskBlockData
                    | import('@/lib/db-types').SectionBlockData,
                taskCompletionImages: block.taskCompletionImages as ImageData[] | null,
                taskCompletionLayout: block.taskCompletionLayout as import('@/lib/db-types').PhotoBlockLayout | null,
            })),
        };

        // Генерируем HTML для PDF
        const html = await generatePDFHTML(reportWithTypedBlocks, baseUrl);

        // Генерируем PDF через Playwright (браузеры в образе: PLAYWRIGHT_BROWSERS_PATH)
        const browser = await launchPdfBrowser();

        let pdfBuffer: Buffer;
        try {
            const page = await browser.newPage();

            await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60_000 });

            await page.evaluate(() => {
                return Promise.all(
                    Array.from(document.images)
                        .filter((img) => !img.complete)
                        .map(
                            (img) =>
                                new Promise<void>((resolve) => {
                                    img.onload = () => resolve();
                                    img.onerror = () => resolve();
                                })
                        )
                );
            });

            pdfBuffer = await page.pdf({
                format: 'A4',
                margin: {
                    top: '15mm',
                    right: '15mm',
                    bottom: '15mm',
                    left: '15mm',
                },
                printBackground: true,
                preferCSSPageSize: false,
                displayHeaderFooter: false,
            });
        } finally {
            await browser.close();
        }

        // Формируем имя файла из названия отчета
        const cleanTitle = report.title
            .replace(/<[^>]*>/g, '') // Убираем HTML теги
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();

        // Транслитерация русских символов
        const transliterate = (text: string): string => {
            const translitMap: Record<string, string> = {
                а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
                ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
                н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
                ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
                ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
            };
            return text.split('').map(char => translitMap[char.toLowerCase()] || char).join('');
        };

        const safeTitle = transliterate(cleanTitle)
            .replace(/[^a-z0-9\s-]/gi, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase()
            .substring(0, 50) || 'report';

        const filename = `${safeTitle}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Error details:', { message: errorMessage, stack: errorStack });
        return NextResponse.json(
            {
                error: 'Failed to generate PDF',
                details: errorMessage.slice(0, 300),
            },
            { status: 500 }
        );
    }
}

/** Оценка высоты текстового блока (заголовок + описание/контент) в мм для A4. Ширина ~180mm. */
function estimateTextBlockHeightMm(p: {
    title?: string | null;
    description?: string | null;
    content?: string | null;
    titleFontSize: string;
    descriptionFontSize: string;
}): number {
    const titleSz = parseInt(p.titleFontSize || '40', 10);
    const descSz = parseInt(p.descriptionFontSize || '20', 10);
    let mm = 0;
    const titleText = (p.title || '').replace(/<[^>]*>/g, '').trim();
    if (titleText) {
        mm += (titleSz * 1.4) / 96 * 25.4 + 4;
    }
    const body = (p.description ?? p.content ?? '').replace(/<[^>]*>/g, '').trim();
    if (body) {
        const charsPerLine = Math.max(35, Math.floor((180 / (descSz / 96 * 25.4)) * 2.2));
        const lines = Math.ceil(body.length / charsPerLine);
        mm += lines * (descSz * 1.7) / 96 * 25.4 + 5;
    }
    return mm;
}

async function generatePDFHTML(report: ReportFromDB, baseUrl: string): Promise<string> {
    const formatDate = (dateString: string | null | undefined): string => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString + 'T00:00:00');
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        } catch {
            return dateString;
        }
    };

    const titleFontSize = report.titleFontSize || '40';
    const descriptionFontSize = report.descriptionFontSize || '20';
    const captionFontSize = report.captionFontSize || '16';

    const PAGE_USABLE_MM = 267;
    const HEADER_MM = 38; // шапка отчёта
    const maxImageHeightWithCaption = '247mm';
    const maxImageHeightWithoutCaption = '267mm';
    const gapMm = 6;
    const captionMm = 8;
    const minReadableMm = 70;

    // Рендерим блоки с учётом накопленной высоты: «остаток страницы» передаём в блок со скриншотом
    const blocks = flattenTree(buildEditorTree(report.blocks ?? []));
    let accumulatedMm = HEADER_MM;

    const blockHtmls: string[] = [];
    for (const block of blocks) {
        if (block.type === 'section') {
            const data = block.data as SectionBlockData;
            if (!isEmptyRichHtml(data.title)) {
                const h = estimateTextBlockHeightMm({
                    title: data.title,
                    content: '',
                    titleFontSize,
                    descriptionFontSize,
                });
                accumulatedMm += h + 10;
                blockHtmls.push(`
                    <section style="margin-bottom: 24px; orphans: 3; widows: 3;">
                        <h2 style="font-size: ${titleFontSize}px; font-weight: 600; color: #111827; margin-bottom: 16px; margin-top: 0; page-break-after: avoid;">${data.title}</h2>
                    </section>
                `);
            }
            continue;
        }

        if (block.type === 'divider') {
            accumulatedMm += 10;
            blockHtmls.push('<div style="margin: 30px 0; border-top: 1px solid #e5e7eb; page-break-inside: avoid;"></div>');
            continue;
        }

        if (block.type === 'text') {
            const data = block.data as TextBlockData;
            const h = estimateTextBlockHeightMm({ title: data.title, content: data.content, titleFontSize, descriptionFontSize });
            accumulatedMm += h + 10;
            blockHtmls.push(`
                    <section style="margin-bottom: 40px; orphans: 3; widows: 3;">
                        ${data.title ? `<h2 style="font-size: ${titleFontSize}px; font-weight: 600; color: #111827; margin-bottom: 16px; margin-top: 0; page-break-after: avoid;">${data.title}</h2>` : ''}
                        ${data.content ? `<div style="font-size: ${descriptionFontSize}px; color: #374151; line-height: 1.7; white-space: pre-wrap; orphans: 3; widows: 3;">${data.content}</div>` : ''}
                    </section>
                `);
            continue;
        }

        if (block.type === 'screenshot') {
            const data = block.data as ScreenshotBlockData;
            const imageSrcs = await Promise.all(
                (data.images ?? []).map((img) => resolvePdfImageSrc(img.url, baseUrl))
            );
            const layout = data.layout || 'full-width';
            const spacing = data.spacing || 'medium';
            const spacingValue = spacing === 'small' ? '8px' : spacing === 'large' ? '24px' : '16px';

            const textHeightMm = estimateTextBlockHeightMm({
                title: data.title,
                description: layout !== 'sidebar' && layout !== 'sidebar-reverse' ? data.description : null,
                titleFontSize,
                descriptionFontSize,
            });
            // Остаток места на текущей странице (учитываем шапку и все предыдущие блоки)
            const usedOnPageMm = accumulatedMm % PAGE_USABLE_MM;
            const spaceLeftOnPageMm = PAGE_USABLE_MM - usedOnPageMm;
            // Если на странице ещё есть место — ограничиваем первую картинку, чтобы вписать на эту же страницу
            const firstImgMaxMm =
                spaceLeftOnPageMm >= minReadableMm + gapMm
                    ? Math.min(267, Math.max(minReadableMm, Math.floor(spaceLeftOnPageMm - textHeightMm - gapMm)))
                    : null;
            const firstImgMaxWithCaptionMm =
                firstImgMaxMm != null ? Math.max(minReadableMm, firstImgMaxMm - captionMm) : null;
            const isFirstRow = layout === 'two-column' ? (i: number) => i < 2 : (i: number) => i === 0;

            const pickMaxHeight = (img: { caption?: string | null }, index: number, withCap: string, withoutCap: string): string => {
                if (!isFirstRow(index) || firstImgMaxMm == null) return img.caption ? withCap : withoutCap;
                const mm = img.caption ? firstImgMaxWithCaptionMm : firstImgMaxMm;
                return mm != null ? `${mm}mm` : (img.caption ? withCap : withoutCap);
            };

                let imagesHTML = '';
                if (data.images && data.images.length > 0) {
                    if (layout === 'two-column' && data.images.length >= 2) {
                        imagesHTML = `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${spacingValue}; margin-bottom: 20px;">
                                ${data.images
                                .map(
                                    (img, idx) => {
                                        const maxHeight = pickMaxHeight(img, idx, maxImageHeightWithCaption, maxImageHeightWithoutCaption);
                                        const isAutoHeight = img.fit === 'auto-height' || img.fit === 'vertical';
                                        const align = img.align ?? (img.center ? 'center' : 'left');
                                        const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
                                        const imgStyle = isAutoHeight
                                            ? `width: auto; height: auto; display: block; border-radius: 8px; max-height: ${maxHeight}; object-fit: contain;`
                                            : `width: 100%; height: auto; display: block; border-radius: 8px; max-width: 100%; max-height: ${maxHeight}; object-fit: contain;`;
                                        const wrapperStyle = isAutoHeight ? `display: flex; justify-content: ${justify}; page-break-inside: avoid;` : 'page-break-inside: avoid;';
                                        return `
                                    <div style="${wrapperStyle}">
                                        <img src="${imageSrcs[idx]}" alt="${escapeHTML(img.alt || '')}" style="${imgStyle}" />
                                        ${img.caption ? `<p style="font-size: ${captionFontSize}px; color: #6b7280; margin-top: 12px; text-align: center; page-break-before: avoid;">${escapeHTML(img.caption)}</p>` : ''}
                                    </div>
                                `;
                                    }
                                )
                                .join('')}
                            </div>
                        `;
                    } else if (layout === 'sidebar' || layout === 'sidebar-reverse') {
                        const isReverse = layout === 'sidebar-reverse';
                        imagesHTML = `
                            <div style="display: flex; gap: ${spacingValue}; margin-bottom: 20px; flex-direction: ${isReverse ? 'row-reverse' : 'row'};">
                                <div style="flex: 0 0 40%; orphans: 3; widows: 3;">
                                    ${data.description ? `<div style="font-size: ${descriptionFontSize}px; color: #374151; line-height: 1.7; white-space: pre-wrap;">${data.description}</div>` : ''}
                                </div>
                                    <div style="flex: 1;">
                                    ${data.images
                                .map(
                                    (img, idx) => {
                                        const maxHeight = pickMaxHeight(img, idx, maxImageHeightWithCaption, maxImageHeightWithoutCaption);
                                        const isAutoHeight = img.fit === 'auto-height' || img.fit === 'vertical';
                                        const align = img.align ?? (img.center ? 'center' : 'left');
                                        const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
                                        const imgStyle = isAutoHeight
                                            ? `width: auto; height: auto; display: block; border-radius: 8px; max-height: ${maxHeight}; object-fit: contain;`
                                            : `width: 100%; height: auto; display: block; border-radius: 8px; max-width: 100%; max-height: ${maxHeight}; object-fit: contain;`;
                                        const wrapperStyle = isAutoHeight ? `display: flex; justify-content: ${justify}; margin-bottom: ${spacingValue}; page-break-inside: avoid;` : `margin-bottom: ${spacingValue}; page-break-inside: avoid;`;
                                        return `
                                        <div style="${wrapperStyle}">
                                            <img src="${imageSrcs[idx]}" alt="${escapeHTML(img.alt || '')}" style="${imgStyle}" />
                                            ${img.caption ? `<p style="font-size: ${captionFontSize}px; color: #6b7280; margin-top: 12px; page-break-before: avoid;">${escapeHTML(img.caption)}</p>` : ''}
                                        </div>
                                    `;
                                    }
                                )
                                .join('')}
                                </div>
                            </div>
                        `;
                    } else {
                        // full-width или grid
                        imagesHTML = `
                            <div style="display: flex; flex-direction: column; gap: ${spacingValue}; margin-bottom: 20px;">
                                ${data.images
                                .map(
                                    (img, idx) => {
                                        const maxHeight = pickMaxHeight(img, idx, maxImageHeightWithCaption, maxImageHeightWithoutCaption);
                                        const isAutoHeight = img.fit === 'auto-height' || img.fit === 'vertical';
                                        const align = img.align ?? (img.center ? 'center' : 'left');
                                        const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
                                        const imgStyle = isAutoHeight
                                            ? `width: auto; height: auto; display: block; border-radius: 8px; max-height: ${maxHeight}; object-fit: contain;`
                                            : `width: 100%; height: auto; display: block; border-radius: 8px; max-width: 100%; max-height: ${maxHeight}; object-fit: contain;`;
                                        const wrapperStyle = isAutoHeight ? `display: flex; justify-content: ${justify}; page-break-inside: avoid;` : 'page-break-inside: avoid;';
                                        return `
                                    <div style="${wrapperStyle}">
                                        <img src="${imageSrcs[idx]}" alt="${escapeHTML(img.alt || '')}" style="${imgStyle}" />
                                        ${img.caption ? `<p style="font-size: ${captionFontSize}px; color: #6b7280; margin-top: 12px; text-align: center; page-break-before: avoid;">${escapeHTML(img.caption)}</p>` : ''}
                                    </div>
                                `;
                                    }
                                )
                                .join('')}
                            </div>
                        `;
                    }
                }

            const blockHeightMm = textHeightMm + (firstImgMaxMm ?? 267) + gapMm;
            accumulatedMm += blockHeightMm;

            blockHtmls.push(`
                    <section style="margin-bottom: 40px;">
                        ${data.title ? `<h2 style="font-size: ${titleFontSize}px; font-weight: 600; color: #111827; margin-bottom: 16px; margin-top: 0; page-break-after: avoid;">${data.title}</h2>` : ''}
                        ${data.description && layout !== 'sidebar' && layout !== 'sidebar-reverse' ? `<div style="font-size: ${descriptionFontSize}px; color: #374151; line-height: 1.7; white-space: pre-wrap; margin-bottom: 20px; orphans: 3; widows: 3;">${data.description}</div>` : ''}
                        ${imagesHTML}
                    </section>
                `);
            continue;
        }

        if (block.type === 'task') {
            const data = block.data as TaskBlockData;
            const taskTitleSz = data.titleFontSize || titleFontSize;
            const taskDescSz = data.descriptionFontSize || descriptionFontSize;
            const textHeightMm = estimateTextBlockHeightMm({
                title: data.title,
                description: data.description,
                titleFontSize: taskTitleSz,
                descriptionFontSize: taskDescSz,
            });

            const taskImageSrcs = await Promise.all(
                (data.images ?? []).map((img) => resolvePdfImageSrc(img.url, baseUrl))
            );
            const taskImagesHtml =
                data.images && data.images.length > 0
                    ? `
                        <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px;">
                            ${data.images
                                .map(
                                    (img, idx) => `
                                <div style="page-break-inside: avoid;">
                                    <img src="${taskImageSrcs[idx]}" alt="${escapeHTML(img.alt || '')}" style="width: 100%; height: auto; display: block; border-radius: 8px; max-width: 100%; max-height: 247mm; object-fit: contain;" />
                                    ${img.caption ? `<p style="font-size: ${captionFontSize}px; color: #6b7280; margin-top: 12px; text-align: center;">${escapeHTML(img.caption)}</p>` : ''}
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    `
                    : '';

            const metaParts: string[] = [];
            if (data.createdAt) metaParts.push(`Создано: ${formatDate(data.createdAt)}`);
            if (data.startDate) metaParts.push(`Начало: ${formatDate(data.startDate)}`);
            if (data.deadline) metaParts.push(`Дедлайн: ${formatDate(data.deadline)}`);
            const assigneesList = formatAssigneesList(normalizeTaskAssignees(data));
            if (assigneesList) {
                metaParts.push(`Исполнители: ${escapeHTML(assigneesList)}`);
            }

            const completedAt = block.taskCompletedAt
                ? formatDate(
                      typeof block.taskCompletedAt === 'string'
                          ? block.taskCompletedAt.slice(0, 10)
                          : block.taskCompletedAt.toISOString().slice(0, 10)
                  )
                : '';

            const completionImages = (block.taskCompletionImages as ImageData[] | null) ?? [];
            const completionImageSrcs = await Promise.all(
                completionImages.map((img) => resolvePdfImageSrc(img.url, baseUrl))
            );
            const completionImagesHtml =
                completionImages.length > 0
                    ? `
                        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
                            ${completionImages
                                .map(
                                    (img, idx) => `
                                <div style="page-break-inside: avoid;">
                                    <img src="${completionImageSrcs[idx]}" alt="${escapeHTML(img.alt || '')}" style="width: 100%; height: auto; display: block; border-radius: 8px; max-height: 200mm; object-fit: contain;" />
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    `
                    : '';

            const completionSection = block.taskCompletedAt
                ? `
                    <div style="margin-top: 24px; padding: 16px; border: 1px solid #bbf7d0; border-radius: 8px; background: #f0fdf4;">
                        <p style="font-size: 14px; font-weight: 600; color: #166534; margin: 0 0 8px 0;">Выполнено${completedAt ? ` — ${completedAt}` : ''}</p>
                        ${block.taskCompletionNotes ? `<div style="font-size: ${taskDescSz}px; color: #374151; line-height: 1.7;">${block.taskCompletionNotes}</div>` : ''}
                        ${completionImagesHtml}
                    </div>
                `
                : '';

            accumulatedMm += textHeightMm + (data.images?.length ? 120 : 0) + (block.taskCompletedAt ? 80 : 0) + 10;

            blockHtmls.push(`
                    <section style="margin-bottom: 40px; page-break-inside: avoid;">
                        ${data.title ? `<h2 style="font-size: ${taskTitleSz}px; font-weight: 600; color: #111827; margin-bottom: 12px; margin-top: 0;">${data.title}</h2>` : ''}
                        ${metaParts.length > 0 ? `<p style="font-size: 13px; color: #6b7280; margin: 0 0 12px 0;">${metaParts.join(' • ')}</p>` : ''}
                        ${data.description ? `<div style="font-size: ${taskDescSz}px; color: #374151; line-height: 1.7; white-space: pre-wrap; margin-bottom: 12px;">${data.description}</div>` : ''}
                        ${taskImagesHtml}
                        ${completionSection}
                    </section>
                `);
            continue;
        }
    }

    const blocksHTML = blockHtmls.length > 0 ? blockHtmls.join('') : '<p style="color: #6b7280;">Блоки не добавлены</p>';

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title.replace(/<[^>]*>/g, '')}</title>
    <style>
        @page {
            size: A4;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #111827;
            line-height: 1.6;
            margin: 0;
            padding: 0;
        }
        .header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e5e7eb;
        }
        .header h1 {
            font-size: 32px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 10px 0;
            page-break-after: avoid;
        }
        .header .subtitle {
            font-size: 18px;
            color: #6b7280;
            margin-bottom: 10px;
            page-break-after: avoid;
        }
        .header .meta {
            font-size: 14px;
            color: #9ca3af;
            margin-top: 10px;
            page-break-after: avoid;
        }
        .content {
            orphans: 3;
            widows: 3;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
        }
        a {
            color: #2563eb;
            text-decoration: underline;
        }
        ol, ul {
            margin: 12px 0;
            list-style-position: outside;
        }
        ol {
            list-style-type: decimal;
            padding-left: 36px;
        }
        ul {
            list-style-type: disc;
            padding-left: 28px;
        }
        li {
            display: list-item;
            margin: 4px 0;
            padding-left: 4px;
        }
        li > p {
            margin: 0;
        }
        @media print {
            .header {
                page-break-after: avoid;
            }
            section {
                orphans: 3;
                widows: 3;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        ${report.subtitle ? `<div class="subtitle">${report.subtitle}</div>` : ''}
        <div class="meta">
            ${report.client ? `<span>${report.client}</span>` : ''}
            ${report.date ? `<span>${report.client ? ' • ' : ''}${formatDate(report.date)}</span>` : ''}
        </div>
    </div>
    <div class="content">
        ${blocksHTML}
    </div>
</body>
</html>
    `;
}

function escapeHTML(text: string): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

