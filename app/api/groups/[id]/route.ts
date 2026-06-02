import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminMiddleware } from '@/lib/auth-helpers';
import { rm, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import {
    ensureNoGroupCycle,
    generateGroupSlugAndPath,
    updateGroupPathBranch,
} from '@/lib/group-service';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Получаем абсолютный путь к директории загрузок
function getUploadDir(): string {
    if (path.isAbsolute(UPLOAD_DIR)) {
        return UPLOAD_DIR;
    }
    return path.join(process.cwd(), UPLOAD_DIR);
}

// Транслитерация русских символов в латиницу
function transliterate(text: string): string {
    const translitMap: Record<string, string> = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
        ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
        н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
        ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
        ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    };
    return text.split('').map((char) => translitMap[char] || char).join('');
}

// Создание безопасного имени папки
function createSafeFolderName(title: string): string {
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
}

// GET /api/groups/[id] - получение группы
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const group = await prisma.reportGroup.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        reports: true,
                        children: true,
                    },
                },
            },
        });

        if (!group) {
            return NextResponse.json(
                { error: 'Group not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ group }, { status: 200 });
    } catch (error) {
        console.error('Error fetching group:', error);
        return NextResponse.json(
            { error: 'Failed to fetch group' },
            { status: 500 }
        );
    }
}

// PATCH /api/groups/[id] - обновление группы
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const adminCheck = requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id } = await params;
        const body = await request.json();
        const { name, description, order, parentId } = body;

        // Проверяем существование группы
        const existing = await prisma.reportGroup.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Group not found' },
                { status: 404 }
            );
        }

        let updateData: any = {
            ...(description !== undefined && {
                description: description?.trim() || null,
            }),
            ...(order !== undefined && { order }),
            ...(parentId !== undefined && { parentId: parentId || null }),
        };

        const nextName =
            name && typeof name === 'string' && name.trim() !== ''
                ? name.trim()
                : existing.name
        const nextParentId =
            parentId !== undefined ? parentId || null : existing.parentId
        const shouldRebuildPath =
            nextName !== existing.name || nextParentId !== existing.parentId

        if (shouldRebuildPath) {
            await ensureNoGroupCycle(id, nextParentId)

            const { slug, path: nextPath } = await generateGroupSlugAndPath({
                name: nextName,
                parentId: nextParentId,
                currentGroupId: id,
            })

            updateData.name = nextName
            updateData.slug = slug

            await updateGroupPathBranch({
                groupId: id,
                oldPath: existing.path,
                newPath: nextPath,
                rootUpdateData: updateData,
            })

            const group = await prisma.reportGroup.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            reports: true,
                            children: true,
                        },
                    },
                },
            })

            return NextResponse.json({ group }, { status: 200 })
        }

        const group = await prisma.reportGroup.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ group }, { status: 200 });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === 'PARENT_NOT_FOUND') {
                return NextResponse.json(
                    { error: 'Parent group not found' },
                    { status: 404 }
                );
            }

            if (error.message === 'GROUP_CYCLE') {
                return NextResponse.json(
                    { error: 'Cannot move group into itself or its descendants' },
                    { status: 400 }
                );
            }

            if (
                error.message === 'RESERVED_GROUP_SLUG' ||
                error.message === 'RESERVED_ROOT_GROUP_SLUG'
            ) {
                return NextResponse.json(
                    { error: 'This group slug is reserved and cannot be used' },
                    { status: 400 }
                );
            }
        }

        console.error('Error updating group:', error);
        return NextResponse.json(
            { error: 'Failed to update group' },
            { status: 500 }
        );
    }
}

// DELETE /api/groups/[id] - удаление группы
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const adminCheck = requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id } = await params;
        // Проверяем существование группы
        const existing = await prisma.reportGroup.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        reports: true,
                        children: true,
                    },
                },
            },
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Group not found' },
                { status: 404 }
            );
        }

        if (existing._count.reports > 0 || existing._count.children > 0) {
            return NextResponse.json(
                {
                    error: 'Cannot delete non-empty group. Please delete or move child groups and reports first.',
                },
                { status: 400 }
            );
        }

        // Получаем все загрузки этой группы
        const uploads = await prisma.upload.findMany({
            where: { groupId: id },
        });

        const uploadDir = getUploadDir();

        // Удаляем все файлы группы
        for (const upload of uploads) {
            const filePath = path.join(uploadDir, upload.path);
            if (existsSync(filePath)) {
                try {
                    await unlink(filePath);
                    console.log(`Deleted file: ${filePath}`);
                } catch (error) {
                    console.error(`Error deleting file ${filePath}:`, error);
                }
            }
        }

        // Удаляем записи uploads из БД
        if (uploads.length > 0) {
            await prisma.upload.deleteMany({
                where: { groupId: id },
            });
        }

        // Определяем путь к папке группы
        let groupFolderName = id; // fallback на groupId

        try {
            if (existing.name) {
                const safeGroupName = createSafeFolderName(existing.name);
                const shortGroupId = id.substring(0, 8);
                groupFolderName = `${safeGroupName}_${shortGroupId}`;
            }
        } catch (error) {
            console.error(`Error creating folder name:`, error);
        }

        // Удаляем папку группы со всем содержимым
        const groupDir = path.join(uploadDir, groupFolderName);
        if (existsSync(groupDir)) {
            try {
                await rm(groupDir, { recursive: true, force: true });
                console.log(`Deleted group directory: ${groupDir}`);
            } catch (error) {
                console.error(`Error deleting group directory ${groupDir}:`, error);
            }
        }

        // Удаляем группу из БД
        await prisma.reportGroup.delete({
            where: { id },
        });

        return NextResponse.json(
            { message: 'Group deleted successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error deleting group:', error);
        return NextResponse.json(
            { error: 'Failed to delete group' },
            { status: 500 }
        );
    }
}
