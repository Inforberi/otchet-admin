import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { requireEditorMiddleware } from '@/lib/auth-helpers';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = Number.parseInt(
    process.env.MAX_UPLOAD_SIZE || '10485760'
); // 10MB default
const ALLOWED_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
];

const ALLOWED_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
]);

const resolveMimeType = (file: File): string | null => {
    if (file.type && ALLOWED_TYPES.includes(file.type)) {
        return file.type;
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return null;
    }

    const byExt: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
    };

    return byExt[ext] ?? null;
};

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
        А: 'A',
        Б: 'B',
        В: 'V',
        Г: 'G',
        Д: 'D',
        Е: 'E',
        Ё: 'Yo',
        Ж: 'Zh',
        З: 'Z',
        И: 'I',
        Й: 'Y',
        К: 'K',
        Л: 'L',
        М: 'M',
        Н: 'N',
        О: 'O',
        П: 'P',
        Р: 'R',
        С: 'S',
        Т: 'T',
        У: 'U',
        Ф: 'F',
        Х: 'H',
        Ц: 'Ts',
        Ч: 'Ch',
        Ш: 'Sh',
        Щ: 'Sch',
        Ъ: '',
        Ы: 'Y',
        Ь: '',
        Э: 'E',
        Ю: 'Yu',
        Я: 'Ya',
    };

    return text
        .split('')
        .map((char) => translitMap[char] || char)
        .join('');
}

// Создание безопасного имени папки из названия проекта
function createSafeFolderName(title: string): string {
    // Транслитерируем
    let safeName = transliterate(title);

    // Заменяем пробелы и спецсимволы на подчеркивания
    safeName = safeName.replace(/[^a-z0-9_-]/gi, '_');

    // Убираем множественные подчеркивания
    safeName = safeName.replace(/_+/g, '_');

    // Убираем подчеркивания в начале и конце
    safeName = safeName.replace(/^_+|_+$/g, '');

    // Ограничиваем длину (максимум 100 символов)
    if (safeName.length > 100) {
        safeName = safeName.substring(0, 100);
    }

    // Если после обработки ничего не осталось, возвращаем fallback
    if (!safeName) {
        safeName = 'project';
    }

    return safeName.toLowerCase();
}

// Генерация безопасного имени файла
function generateSafeFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const ext = path.extname(originalName).toLowerCase();
    const baseName = path
        .basename(originalName, ext)
        .replace(/[^a-z0-9]/gi, '_');
    return `${timestamp}_${random}_${baseName}${ext}`;
}

// Получение пути для сохранения файла (с учетом папки группы и проекта)
async function getProjectUploadPath(
    reportId: string | null,
    groupId: string | null
): Promise<{ projectDir: string; relativePath: string }> {
    const uploadDir = getUploadDir();

    if (!reportId || !groupId) {
        // Обратная совместимость: если reportId или groupId нет, сохраняем в корень
        return {
            projectDir: uploadDir,
            relativePath: '',
        };
    }

    // Получаем группу и отчет из БД
    let groupFolderName = groupId; // fallback на groupId
    let reportFolderName = reportId; // fallback на reportId

    try {
        const [group, report] = await Promise.all([
            prisma.reportGroup.findUnique({
                where: { id: groupId },
                select: { name: true },
            }),
            reportId
                ? prisma.report.findUnique({
                      where: { id: reportId },
                      select: { title: true },
                  })
                : null,
        ]);

        if (group && group.name) {
            groupFolderName = createSafeFolderName(group.name);
            const shortGroupId = groupId.substring(0, 8);
            groupFolderName = `${groupFolderName}_${shortGroupId}`;
        }

        if (report && report.title) {
            const safeTitle = createSafeFolderName(report.title);
            const shortId = reportId.substring(0, 8);
            reportFolderName = `${safeTitle}_${shortId}`;
        }
    } catch (error) {
        console.error(`Error fetching group/report:`, error);
    }

    // Структура: uploads/{groupFolder}/{reportFolder}/
    const fullPath = path.join(groupFolderName, reportFolderName);
    const projectDir = path.join(uploadDir, fullPath);

    // Создаем директорию проекта если не существует
    if (!existsSync(projectDir)) {
        await mkdir(projectDir, { recursive: true });
        console.log(`Created project directory: ${projectDir}`);
    }

    return {
        projectDir,
        relativePath: fullPath,
    };
}

// POST /api/uploads - загрузка файла
export async function POST(request: NextRequest) {
    // Проверка прав администратора
    const adminCheck = await requireEditorMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const reportId = formData.get('reportId') as string | null;
        const groupId = formData.get('groupId') as string | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        if (!groupId) {
            return NextResponse.json(
                { error: 'Group ID is required' },
                { status: 400 }
            );
        }

        const mimeType = resolveMimeType(file);
        if (!mimeType) {
            return NextResponse.json(
                {
                    error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(
                        ', '
                    )}`,
                },
                { status: 400 }
            );
        }

        // Валидация размера
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    error: `File too large. Max size: ${
                        MAX_FILE_SIZE / 1024 / 1024
                    }MB`,
                },
                { status: 400 }
            );
        }

        // Получаем абсолютный путь к директории загрузок
        const uploadDir = getUploadDir();

        // Создаем директорию если не существует
        try {
            if (!existsSync(uploadDir)) {
                await mkdir(uploadDir, { recursive: true });
                console.log(`Created upload directory: ${uploadDir}`);
            }
        } catch (dirError) {
            console.error(
                `Error creating upload directory ${uploadDir}:`,
                dirError
            );
            return NextResponse.json(
                { error: `Failed to create upload directory: ${dirError}` },
                { status: 500 }
            );
        }

        // Получаем путь для сохранения файла (с учетом папки группы и проекта)
        const { projectDir, relativePath: projectPath } =
            await getProjectUploadPath(reportId, groupId);

        // Генерируем безопасное имя файла
        const safeFilename = generateSafeFilename(file.name);

        // Формируем относительный путь (для БД и URL)
        // Если есть projectPath, то путь будет: {reportId}/{filename}
        // Если нет, то просто: {filename} (обратная совместимость)
        const relativePath = projectPath
            ? `${projectPath}/${safeFilename}`
            : safeFilename;

        // Абсолютный путь для сохранения на диск
        const absolutePath = path.join(projectDir, safeFilename);

        console.log(
            `Uploading file to: ${absolutePath} (uploadDir: ${uploadDir})`
        );

        // Сохраняем файл
        try {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            await writeFile(absolutePath, buffer);
            console.log(`File saved successfully: ${absolutePath}`);
        } catch (writeError) {
            console.error(`Error writing file to ${absolutePath}:`, writeError);
            return NextResponse.json(
                { error: `Failed to save file: ${writeError}` },
                { status: 500 }
            );
        }

        // Сохраняем метаданные в БД
        const upload = await prisma.upload.create({
            data: {
                reportId: reportId || null,
                groupId: groupId,
                filename: file.name,
                path: relativePath,
                mimeType,
                size: file.size,
            },
        });

        return NextResponse.json(
            {
                upload,
                url: `/api/static/uploads/${relativePath}`, // URL для доступа к файлу
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error uploading file:', error);

        const message =
            error instanceof Error ? error.message : 'Failed to upload file';
        const isPrisma =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof (error as { code: string }).code === 'string';

        if (isPrisma && (error as { code: string }).code === 'P2003') {
            return NextResponse.json(
                { error: 'Группа или отчёт не найдены' },
                { status: 400 }
            );
        }

        if (isPrisma && (error as { code: string }).code === 'P2002') {
            return NextResponse.json(
                { error: 'Файл с таким путём уже существует, повторите загрузку' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to upload file',
                details: process.env.NODE_ENV === 'production' ? undefined : message,
            },
            { status: 500 }
        );
    }
}

// GET /api/uploads - список загрузок (опционально с фильтром по reportId)
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const reportId = searchParams.get('reportId');

        const uploads = await prisma.upload.findMany({
            where: reportId ? { reportId } : undefined,
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ uploads }, { status: 200 });
    } catch (error) {
        console.error('Error fetching uploads:', error);
        return NextResponse.json(
            { error: 'Failed to fetch uploads' },
            { status: 500 }
        );
    }
}
