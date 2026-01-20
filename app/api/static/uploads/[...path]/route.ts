import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
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
        const uploadDir = getUploadDir();
        const filePath = path.join(uploadDir, filename);
        
        console.log(`[Static Uploads] Request segments:`, pathSegments);
        console.log(`[Static Uploads] Decoded filename: ${filename}`);
        console.log(`[Static Uploads] Full path: ${filePath}`);
        console.log(`[Static Uploads] File exists: ${existsSync(filePath)}`);

        if (!existsSync(filePath)) {
            console.error(
                `File not found: ${filePath} (uploadDir: ${uploadDir}, filename: ${filename}, segments: ${JSON.stringify(pathSegments)})`
            );
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        const fileBuffer = await readFile(filePath);

        // Определяем MIME type по расширению
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
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
