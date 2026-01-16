import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

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

// Получение пути для сохранения файла (с учетом папки проекта)
async function getProjectUploadPath(
    reportId: string | null
): Promise<{ projectDir: string; relativePath: string }> {
    const uploadDir = getUploadDir();

    if (!reportId) {
        // Обратная совместимость: если reportId нет, сохраняем в корень
        return {
            projectDir: uploadDir,
            relativePath: '',
        };
    }

    // Получаем отчет из БД, чтобы взять название
    let folderName = reportId; // fallback на reportId

    try {
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            select: { title: true },
        });

        if (report && report.title) {
            // Создаем безопасное имя папки из названия отчета
            const safeTitle = createSafeFolderName(report.title);
            // Добавляем reportId для уникальности: название_reportId
            // Используем первые 8 символов reportId для краткости
            const shortId = reportId.substring(0, 8);
            folderName = `${safeTitle}_${shortId}`;
        }
    } catch (error) {
        console.error(`Error fetching report ${reportId}:`, error);
        // В случае ошибки используем reportId как fallback
        folderName = reportId;
    }

    // Создаем папку проекта по транслитерированному названию
    const projectDir = path.join(uploadDir, folderName);

    // Создаем директорию проекта если не существует
    if (!existsSync(projectDir)) {
        await mkdir(projectDir, { recursive: true });
        console.log(`Created project directory: ${projectDir}`);
    }

    return {
        projectDir,
        relativePath: folderName,
    };
}

// POST /api/uploads - загрузка файла
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const reportId = formData.get('reportId') as string | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Валидация типа
        if (!ALLOWED_TYPES.includes(file.type)) {
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

        // Получаем путь для сохранения файла (с учетом папки проекта)
        const { projectDir, relativePath: projectPath } =
            await getProjectUploadPath(reportId);

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
                filename: file.name,
                path: relativePath,
                mimeType: file.type,
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
        return NextResponse.json(
            { error: 'Failed to upload file' },
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
