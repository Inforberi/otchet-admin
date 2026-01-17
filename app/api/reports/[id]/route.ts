import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { UpdateReportInput } from '@/lib/db-types';
import { unlink, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { requireAdminMiddleware } from '@/lib/auth-helpers';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Получаем абсолютный путь к директории загрузок
function getUploadDir(): string {
    if (path.isAbsolute(UPLOAD_DIR)) {
        return UPLOAD_DIR;
    }
    return path.join(process.cwd(), UPLOAD_DIR);
}

// GET /api/reports/[id] - получить отчет по ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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

        return NextResponse.json({ report }, { status: 200 });
    } catch (error) {
        console.error('Error fetching report:', error);
        return NextResponse.json(
            { error: 'Failed to fetch report' },
            { status: 500 }
        );
    }
}

// PATCH /api/reports/[id] - обновить отчет
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Проверка прав администратора
    const adminCheck = requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id } = await params;
        const body: Partial<UpdateReportInput> = await request.json();

        const report = await prisma.report.update({
            where: { id },
            data: {
                ...(body.title !== undefined && { title: body.title }),
                ...(body.subtitle !== undefined && { subtitle: body.subtitle }),
                ...(body.client !== undefined && { client: body.client }),
                ...(body.date !== undefined && { date: body.date }),
                ...(body.status !== undefined && { status: body.status }),
                ...(body.titleFontSize !== undefined && {
                    titleFontSize: body.titleFontSize,
                }),
                ...(body.descriptionFontSize !== undefined && {
                    descriptionFontSize: body.descriptionFontSize,
                }),
                ...(body.captionFontSize !== undefined && {
                    captionFontSize: body.captionFontSize,
                }),
            },
        });

        return NextResponse.json({ report }, { status: 200 });
    } catch (error) {
        console.error('Error updating report:', error);
        return NextResponse.json(
            { error: 'Failed to update report' },
            { status: 500 }
        );
    }
}

// DELETE /api/reports/[id] - удалить отчет
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Проверка прав администратора
    const adminCheck = requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id } = await params;

        // Получаем отчет перед удалением, чтобы узнать название папки
        const report = await prisma.report.findUnique({
            where: { id },
            select: { title: true },
        });

        if (!report) {
            return NextResponse.json(
                { error: 'Report not found' },
                { status: 404 }
            );
        }

        // Получаем все загрузки для этого отчета
        const uploads = await prisma.upload.findMany({
            where: { reportId: id },
        });

        const uploadDir = getUploadDir();

        // Удаляем все файлы
        for (const upload of uploads) {
            const filePath = path.join(uploadDir, upload.path);
            if (existsSync(filePath)) {
                try {
                    await unlink(filePath);
                    console.log(`Deleted file: ${filePath}`);
                } catch (error) {
                    console.error(`Error deleting file ${filePath}:`, error);
                    // Продолжаем удаление даже если файл не найден
                }
            }
        }

        // Удаляем записи uploads из БД
        if (uploads.length > 0) {
            await prisma.upload.deleteMany({
                where: { reportId: id },
            });
        }

        // Определяем путь к папке проекта
        // Используем ту же логику, что и при создании папки
        let projectFolderName = id; // fallback на reportId

        try {
            // Транслитерация (копируем логику из uploads/route.ts)
            const transliterate = (text: string): string => {
                const translitMap: Record<string, string> = {
                    а: 'a',
                    б: 'b',
                    в: 'v',
                    г: 'g',
                    д: 'd',
                    е: 'e',
                    ё: 'yo',
                    ж: 'zh',
                    з: 'z',
                    и: 'i',
                    й: 'y',
                    к: 'k',
                    л: 'l',
                    м: 'm',
                    н: 'n',
                    о: 'o',
                    п: 'p',
                    р: 'r',
                    с: 's',
                    т: 't',
                    у: 'u',
                    ф: 'f',
                    х: 'h',
                    ц: 'ts',
                    ч: 'ch',
                    ш: 'sh',
                    щ: 'sch',
                    ъ: '',
                    ы: 'y',
                    ь: '',
                    э: 'e',
                    ю: 'yu',
                    я: 'ya',
                };
                return text
                    .split('')
                    .map((char) => translitMap[char] || char)
                    .join('');
            };

            const createSafeFolderName = (title: string): string => {
                let safeName = transliterate(title);
                safeName = safeName.replace(/[^a-z0-9_-]/gi, '_');
                safeName = safeName.replace(/_+/g, '_');
                safeName = safeName.replace(/^_+|_+$/g, '');
                if (safeName.length > 100) {
                    safeName = safeName.substring(0, 100);
                }
                if (!safeName) {
                    safeName = 'project';
                }
                return safeName.toLowerCase();
            };

            if (report.title) {
                const safeTitle = createSafeFolderName(report.title);
                const shortId = id.substring(0, 8);
                projectFolderName = `${safeTitle}_${shortId}`;
            }
        } catch (error) {
            console.error(`Error creating folder name:`, error);
            // Используем id как fallback
            projectFolderName = id;
        }

        // Удаляем папку проекта (если она существует и пуста или содержит только файлы этого отчета)
        const projectDir = path.join(uploadDir, projectFolderName);
        if (existsSync(projectDir)) {
            try {
                // Проверяем, есть ли другие файлы в папке (на случай если там что-то осталось)
                // Просто удаляем папку рекурсивно - все файлы этого отчета уже удалены
                await rm(projectDir, { recursive: true, force: true });
                console.log(`Deleted project directory: ${projectDir}`);
            } catch (error) {
                console.error(
                    `Error deleting project directory ${projectDir}:`,
                    error
                );
                // Продолжаем удаление отчета даже если папка не удалилась
            }
        }

        // Удаляем отчет из БД
        await prisma.report.delete({
            where: { id },
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Error deleting report:', error);
        return NextResponse.json(
            { error: 'Failed to delete report' },
            { status: 500 }
        );
    }
}
