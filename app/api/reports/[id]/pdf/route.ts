import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chromium } from 'playwright';
import type { ReportFromDB, ScreenshotBlockData, TextBlockData } from '@/lib/db-types';

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
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const baseUrl = `${protocol}://${host}`;

        // Генерируем HTML для PDF
        const html = generatePDFHTML(report, baseUrl);

        // Генерируем PDF через Playwright
        // В production используем браузеры, установленные через Playwright
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
            ],
        });
        const page = await browser.newPage();
        
        await page.setContent(html, { waitUntil: 'networkidle' });
        
        // Ждем загрузки всех изображений
        await page.evaluate(() => {
            return Promise.all(
                Array.from(document.images)
                    .filter(img => !img.complete)
                    .map(img => new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    }))
            );
        });
        
        // Дополнительная задержка для полной загрузки
        await page.waitForTimeout(1000);
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '15mm',
                right: '15mm',
                bottom: '15mm',
                left: '15mm',
            },
            printBackground: true,
        });

        await browser.close();

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

        return new NextResponse(pdfBuffer, {
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
            { error: 'Failed to generate PDF', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
            { status: 500 }
        );
    }
}

function generatePDFHTML(report: ReportFromDB, baseUrl: string): string {
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

    // Рендерим блоки
    const blocksHTML = report.blocks
        ?.map((block) => {
            if (block.type === 'divider') {
                return '<div style="margin: 40px 0; border-top: 1px solid #e5e7eb;"></div>';
            }

            if (block.type === 'text') {
                const data = block.data as TextBlockData;
                return `
                    <section style="margin-bottom: 60px; page-break-inside: avoid;">
                        ${data.title ? `<h2 style="font-size: ${titleFontSize}px; font-weight: 600; color: #111827; margin-bottom: 20px; margin-top: 0;">${data.title}</h2>` : ''}
                        ${data.content ? `<div style="font-size: ${descriptionFontSize}px; color: #374151; line-height: 1.7; white-space: pre-wrap;">${data.content}</div>` : ''}
                    </section>
                `;
            }

            if (block.type === 'screenshot') {
                const data = block.data as ScreenshotBlockData;
                const layout = data.layout || 'full-width';
                const spacing = data.spacing || 'medium';
                const spacingValue = spacing === 'small' ? '8px' : spacing === 'large' ? '24px' : '16px';

                let imagesHTML = '';
                if (data.images && data.images.length > 0) {
                    if (layout === 'two-column' && data.images.length >= 2) {
                        imagesHTML = `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${spacingValue}; margin-bottom: 20px;">
                                ${data.images
                                    .map(
                                        (img) => `
                                    <div>
                                        <img src="${getImageUrl(img.url, baseUrl)}" alt="${img.alt || ''}" style="width: 100%; height: auto; display: block; border-radius: 8px;" />
                                        ${img.caption ? `<p style="font-size: ${captionFontSize}px; color: #6b7280; margin-top: 12px; text-align: center;">${img.caption}</p>` : ''}
                                    </div>
                                `
                                    )
                                    .join('')}
                            </div>
                        `;
                    } else if (layout === 'sidebar' || layout === 'sidebar-reverse') {
                        const isReverse = layout === 'sidebar-reverse';
                        imagesHTML = `
                            <div style="display: flex; gap: ${spacingValue}; margin-bottom: 20px; flex-direction: ${isReverse ? 'row-reverse' : 'row'};">
                                <div style="flex: 0 0 40%;">
                                    ${data.description ? `<div style="font-size: ${descriptionFontSize}px; color: #374151; line-height: 1.7; white-space: pre-wrap;">${data.description}</div>` : ''}
                                </div>
                                <div style="flex: 1;">
                                    ${data.images
                                        .map(
                                            (img) => `
                                        <div style="margin-bottom: ${spacingValue};">
                                            <img src="${getImageUrl(img.url, baseUrl)}" alt="${escapeHTML(img.alt || '')}" style="width: 100%; height: auto; display: block; border-radius: 8px;" />
                                            ${img.caption ? `<p style="font-size: ${captionFontSize}px; color: #6b7280; margin-top: 12px;">${escapeHTML(img.caption)}</p>` : ''}
                                        </div>
                                    `
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
                                        (img) => `
                                    <div>
                                        <img src="${getImageUrl(img.url, baseUrl)}" alt="${escapeHTML(img.alt || '')}" style="width: 100%; height: auto; display: block; border-radius: 8px; max-width: 100%;" />
                                        ${img.caption ? `<p style="font-size: ${captionFontSize}px; color: #6b7280; margin-top: 12px; text-align: center;">${escapeHTML(img.caption)}</p>` : ''}
                                    </div>
                                `
                                    )
                                    .join('')}
                            </div>
                        `;
                    }
                }

                return `
                    <section style="margin-bottom: 60px; page-break-inside: avoid;">
                        ${data.title ? `<h2 style="font-size: ${titleFontSize}px; font-weight: 600; color: #111827; margin-bottom: 20px; margin-top: 0;">${data.title}</h2>` : ''}
                        ${data.description && layout !== 'sidebar' && layout !== 'sidebar-reverse' ? `<div style="font-size: ${descriptionFontSize}px; color: #374151; line-height: 1.7; white-space: pre-wrap; margin-bottom: 20px;">${data.description}</div>` : ''}
                        ${imagesHTML}
                    </section>
                `;
            }

            return '';
        })
        .join('') || '<p style="color: #6b7280;">Блоки не добавлены</p>';

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
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e5e7eb;
        }
        .header h1 {
            font-size: 32px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 10px 0;
        }
        .header .subtitle {
            font-size: 18px;
            color: #6b7280;
            margin-bottom: 10px;
        }
        .header .meta {
            font-size: 14px;
            color: #9ca3af;
            margin-top: 10px;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        @media print {
            .header {
                page-break-after: avoid;
            }
            section {
                page-break-inside: avoid;
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

function getImageUrl(url: string, baseUrl: string): string {
    // Если URL уже полный, возвращаем как есть
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    // Если URL начинается с /api/static/uploads/ или /uploads/, добавляем baseUrl
    if (url.startsWith('/api/static/uploads/') || url.startsWith('/uploads/')) {
        return `${baseUrl}${url}`;
    }
    
    // Если URL начинается с /, добавляем baseUrl
    if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
    }
    
    // Иначе добавляем /api/static/uploads/ для относительных путей
    return `${baseUrl}/api/static/uploads/${url}`;
}
