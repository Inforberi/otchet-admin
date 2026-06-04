import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { UpdateReportInput } from '@/lib/db-types';
import { Prisma } from '@prisma/client';
import { unlink, rm, readdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import {
    getRequestUser,
    isViewerRole,
    requireEditorMiddleware,
} from '@/lib/auth-helpers';
import { canEditContent } from '@/lib/auth';
import { canAccessGroupId } from '@/lib/group-access';
import { getGroupAncestors } from '@/lib/group-service';
import { buildPublishedReportResponse } from '@/lib/report-published-view';
import { createSlug, generateUniqueSlug } from '@/lib/slug';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const VERSION_CONFLICT = 'VERSION_CONFLICT';

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
        const user = await getRequestUser(request);
        const view = request.nextUrl.searchParams.get('view');
        const forcePublished = user ? isViewerRole(user) : false;

        const report = await prisma.report.findUnique({
            where: { id },
            include: {
                group: {
                    select: {
                        id: true,
                        name: true,
                        path: true,
                        parentId: true,
                    },
                },
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

        if (user && !(await canAccessGroupId(user, report.groupId))) {
            return NextResponse.json(
                { error: 'Report not found' },
                { status: 404 }
            );
        }

        const ancestors = report.group?.parentId
            ? await getGroupAncestors(report.group.parentId)
            : [];

        const usePublishedView =
            forcePublished || view === 'published';

        if (usePublishedView) {
            const published = buildPublishedReportResponse(report);
            if (!published) {
                if (user && canEditContent(user)) {
                    const hasUnpublishedChanges =
                        Boolean(report.draftHash) &&
                        Boolean(report.publishedHash) &&
                        report.draftHash !== report.publishedHash;

                    return NextResponse.json(
                        {
                            report,
                            ancestors,
                            hasUnpublishedChanges,
                            isPublishedView: false,
                        },
                        { status: 200 }
                    );
                }

                return NextResponse.json(
                    { error: 'Report not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json(
                {
                    report: published.report,
                    ancestors,
                    hasUnpublishedChanges: published.hasUnpublishedChanges,
                    isPublishedView: published.isPublishedView,
                },
                { status: 200, headers: published.headers }
            );
        }

        const hasUnpublishedChanges =
            Boolean(report.draftHash) &&
            Boolean(report.publishedHash) &&
            report.draftHash !== report.publishedHash;

        return NextResponse.json(
            { report, ancestors, hasUnpublishedChanges, isPublishedView: false },
            { status: 200 }
        );
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
    const adminCheck = await requireEditorMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id } = await params;
        const body: Partial<UpdateReportInput> = await request.json();
        const expectedVersion =
            typeof body.expectedVersion === 'number'
                ? body.expectedVersion
                : Number(body.expectedVersion);

        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
            return NextResponse.json(
                { error: 'expectedVersion is required' },
                { status: 400 }
            );
        }

        // Получаем текущий отчет для проверки groupId
        const currentReport = await prisma.report.findUnique({
            where: { id },
            select: { groupId: true, title: true, version: true },
        });

        if (!currentReport) {
            return NextResponse.json(
                { error: 'Report not found' },
                { status: 404 }
            );
        }

        const updateData: any = {
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
            ...(body.contentHeadingFontSize !== undefined && {
                contentHeadingFontSize: body.contentHeadingFontSize,
            }),
            ...(body.captionFontSize !== undefined && {
                captionFontSize: body.captionFontSize,
            }),
        };

        // Если меняется title, обновляем slug
        if (body.title !== undefined && body.title !== currentReport.title) {
            updateData.title = body.title;
            
            // Генерируем новый slug (уникальный в рамках группы, даже если названия одинаковые)
            const baseSlug = createSlug(body.title);
            const slug = await generateUniqueSlug(
                baseSlug,
                async (s) => {
                    const exists = await prisma.report.findUnique({
                        where: {
                            groupId_slug: {
                                groupId: currentReport.groupId,
                                slug: s,
                            },
                        },
                    });
                    // Разрешаем использовать slug только если это тот же отчет или slug свободен
                    return !exists || exists.id === id;
                }
            );
            updateData.slug = slug;
        }

        const updateResult = await prisma.report.updateMany({
            where: {
                id,
                version: expectedVersion,
            },
            data: {
                ...updateData,
                version: {
                    increment: 1,
                },
            },
        });

        if (updateResult.count === 0) {
            return NextResponse.json(
                {
                    error: 'Report has been modified by another user',
                    code: VERSION_CONFLICT,
                    currentVersion: currentReport.version,
                },
                { status: 409 }
            );
        }

        const report = await prisma.report.findUnique({
            where: { id },
            include: {
                group: {
                    select: {
                        id: true,
                        name: true,
                        path: true,
                    },
                },
                blocks: {
                    orderBy: { position: 'asc' },
                },
            },
        });

        return NextResponse.json({ report }, { status: 200 });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return NextResponse.json(
                { error: 'Report slug already exists in this group' },
                { status: 409 }
            );
        }

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
    const adminCheck = await requireEditorMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id } = await params;

        // Получаем отчет перед удалением, чтобы узнать название папки и группу
        const report = await prisma.report.findUnique({
            where: { id },
            select: { title: true, groupId: true },
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

        // Определяем путь к папке отчета с учетом группы
        // Используем ту же логику, что и при создании папки
        let groupFolderName = report.groupId;
        let reportFolderName = id; // fallback на reportId

        try {
            // Получаем информацию о группе
            const group = await prisma.reportGroup.findUnique({
                where: { id: report.groupId },
                select: { name: true },
            });

            // Транслитерация
            const transliterate = (text: string): string => {
                const translitMap: Record<string, string> = {
                    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
                    ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
                    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
                    ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
                    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
                };
                return text.split('').map((char) => translitMap[char] || char).join('');
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

            if (group && group.name) {
                const safeGroupName = createSafeFolderName(group.name);
                const shortGroupId = report.groupId.substring(0, 8);
                groupFolderName = `${safeGroupName}_${shortGroupId}`;
            }

            if (report.title) {
                const safeTitle = createSafeFolderName(report.title);
                const shortId = id.substring(0, 8);
                reportFolderName = `${safeTitle}_${shortId}`;
            }
        } catch (error) {
            console.error(`Error creating folder names:`, error);
        }

        // Удаляем папку отчета: uploads/{groupFolder}/{reportFolder}/
        const reportDir = path.join(uploadDir, groupFolderName, reportFolderName);
        if (existsSync(reportDir)) {
            try {
                await rm(reportDir, { recursive: true, force: true });
                console.log(`Deleted report directory: ${reportDir}`);
            } catch (error) {
                console.error(`Error deleting report directory ${reportDir}:`, error);
            }
        }

        // Проверяем, пуста ли папка группы после удаления отчета
        const groupDir = path.join(uploadDir, groupFolderName);
        if (existsSync(groupDir)) {
            try {
                const entries = await readdir(groupDir);
                // Если папка группы пуста, удаляем её
                if (entries.length === 0) {
                    await rm(groupDir, { recursive: true, force: true });
                    console.log(`Deleted empty group directory: ${groupDir}`);
                }
            } catch (error) {
                console.error(`Error checking/cleaning group directory:`, error);
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
