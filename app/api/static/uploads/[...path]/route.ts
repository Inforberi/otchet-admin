import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { prisma } from '@/lib/prisma';
import { canAccessUploadFromRequest } from '@/lib/upload-access';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Получаем абсолютный путь к директории загрузок
function getUploadDir(): string {
    if (path.isAbsolute(UPLOAD_DIR)) {
        return UPLOAD_DIR;
    }
    return path.join(process.cwd(), UPLOAD_DIR);
}

function resolveSafeUploadPath(filename: string): {
    absolutePath: string;
    storagePath: string;
} | null {
    if (!filename || path.isAbsolute(filename)) return null;

    const uploadDir = path.resolve(getUploadDir());
    const absolutePath = path.resolve(uploadDir, filename);
    const relativePath = path.relative(uploadDir, absolutePath);

    if (
        !relativePath ||
        relativePath.startsWith('..') ||
        path.isAbsolute(relativePath)
    ) {
        return null;
    }

    return {
        absolutePath,
        storagePath: relativePath.split(path.sep).join('/'),
    };
}

// GET /api/static/uploads/[...path] - отдача статических файлов
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params;
        // Декодируем каждый сегмент пути и объединяем
        // Важно: decodeURIComponent обрабатывает пробелы как %20
        const decodedSegments = pathSegments.map(segment => {
            try {
                return decodeURIComponent(segment);
            } catch (e) {
                // Если декодирование не удалось, возвращаем как есть
                return segment;
            }
        });
        const filename = decodedSegments.join('/');
        const resolved = resolveSafeUploadPath(filename);

        if (!resolved) {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        const upload = await prisma.upload.findUnique({
            where: { path: resolved.storagePath },
        });

        if (
            !upload ||
            !(await canAccessUploadFromRequest(request, upload)) ||
            !existsSync(resolved.absolutePath)
        ) {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        const fileBuffer = await readFile(resolved.absolutePath);

        // Определяем MIME type по расширению
        const ext = path.extname(resolved.storagePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('Error serving file:', error);
        return NextResponse.json(
            { error: 'Failed to serve file' },
            { status: 500 }
        );
    }
}
