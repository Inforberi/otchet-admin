import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Получаем абсолютный путь к директории загрузок
function getUploadDir(): string {
    if (path.isAbsolute(UPLOAD_DIR)) {
        return UPLOAD_DIR;
    }
    return path.join(process.cwd(), UPLOAD_DIR);
}

// DELETE /api/uploads/by-path?path=... - удалить загруженный файл по пути
export async function DELETE(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const filePath = searchParams.get('path');

        if (!filePath) {
            return NextResponse.json(
                { error: 'Path parameter is required' },
                { status: 400 }
            );
        }

        // Находим upload по path
        const upload = await prisma.upload.findUnique({
            where: { path: filePath },
        });

        if (!upload) {
            return NextResponse.json(
                { error: 'Upload not found' },
                { status: 404 }
            );
        }

        // Удаляем файл с диска
        const uploadDir = getUploadDir();
        const absoluteFilePath = path.join(uploadDir, upload.path);

        if (existsSync(absoluteFilePath)) {
            try {
                await unlink(absoluteFilePath);
                console.log(`Deleted file: ${absoluteFilePath}`);
            } catch (error) {
                console.error(`Error deleting file ${absoluteFilePath}:`, error);
                // Продолжаем удаление записи из БД даже если файл не найден
            }
        }

        // Удаляем запись из БД
        await prisma.upload.delete({
            where: { id: upload.id },
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Error deleting upload:', error);
        return NextResponse.json(
            { error: 'Failed to delete upload' },
            { status: 500 }
        );
    }
}
