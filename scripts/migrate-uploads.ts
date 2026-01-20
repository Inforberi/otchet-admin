import { PrismaClient } from '@prisma/client';
import { rename, mkdir, readdir, stat, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const prisma = new PrismaClient();
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
        А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'Yo',
        Ж: 'Zh', З: 'Z', И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M',
        Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U',
        Ф: 'F', Х: 'H', Ц: 'Ts', Ч: 'Ch', Ш: 'Sh', Щ: 'Sch',
        Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'Yu', Я: 'Ya',
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

// Рекурсивная очистка пустых папок
async function cleanupEmptyFolders(dir: string): Promise<void> {
    try {
        const entries = await readdir(dir);
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stats = await stat(fullPath);
            
            if (stats.isDirectory()) {
                // Рекурсивно очищаем подпапки
                await cleanupEmptyFolders(fullPath);
                
                // Проверяем, пуста ли папка после очистки
                const subEntries = await readdir(fullPath);
                if (subEntries.length === 0 && entry !== '.gitkeep') {
                    await rm(fullPath, { recursive: true, force: true });
                    console.log(`Removed empty folder: ${fullPath}`);
                }
            }
        }
    } catch (error) {
        // Игнорируем ошибки доступа
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }
}

async function migrateUploads() {
    const uploadDir = getUploadDir();
    const results = {
        processed: 0,
        moved: 0,
        skipped: 0,
        errors: [] as string[],
    };

    console.log('Начинаем миграцию файлов...');
    console.log(`Директория загрузок: ${uploadDir}`);

    try {
        // Получаем все uploads из БД
        const uploads = await prisma.upload.findMany({
            include: {
                group: {
                    select: { id: true, name: true },
                },
            },
        });

        console.log(`Найдено записей в БД: ${uploads.length}`);

        for (const upload of uploads) {
            try {
                results.processed++;

                // Пропускаем если нет reportId
                if (!upload.reportId) {
                    results.skipped++;
                    continue;
                }

                // Получаем информацию об отчете
                const report = await prisma.report.findUnique({
                    where: { id: upload.reportId },
                    select: { id: true, title: true, groupId: true },
                });

                if (!report) {
                    results.errors.push(`Report ${upload.reportId} not found for upload ${upload.id}`);
                    results.skipped++;
                    continue;
                }

                // Определяем новые пути
                let groupFolderName = upload.groupId;
                let reportFolderName = report.id;

                if (upload.group && upload.group.name) {
                    const safeGroupName = createSafeFolderName(upload.group.name);
                    const shortGroupId = upload.groupId.substring(0, 8);
                    groupFolderName = `${safeGroupName}_${shortGroupId}`;
                }

                if (report.title) {
                    const safeTitle = createSafeFolderName(report.title);
                    const shortId = report.id.substring(0, 8);
                    reportFolderName = `${safeTitle}_${shortId}`;
                }

                // Новый путь: {groupFolder}/{reportFolder}/{filename}
                const newRelativePath = path.join(groupFolderName, reportFolderName, upload.filename);
                const newFullPath = path.join(uploadDir, newRelativePath);

                // Старый путь (может быть в разных форматах)
                const oldFullPath = path.join(uploadDir, upload.path);
                let fileFound = false;
                let actualOldPath = oldFullPath;

                // Проверяем различные возможные расположения файла
                const oldReportFolderVariants = [
                    reportFolderName, // Новый формат с транслитерацией
                    report.id, // Просто ID отчета
                ];
                
                // Если в пути upload.path уже есть папка отчета, используем её
                const pathParts = upload.path.split(path.sep).filter(p => p);
                if (pathParts.length > 1) {
                    oldReportFolderVariants.push(pathParts[0]);
                } else if (pathParts.length === 1 && pathParts[0] !== upload.filename) {
                    oldReportFolderVariants.push(pathParts[0]);
                }
                
                // Также проверяем старые форматы папок
                if (report.title) {
                    const oldSafeTitle = createSafeFolderName(report.title);
                    oldReportFolderVariants.push(`${oldSafeTitle}_${report.id.substring(0, 8)}`);
                    oldReportFolderVariants.push(oldSafeTitle);
                }

                const possiblePaths = [
                    oldFullPath, // Точный путь из БД
                    path.join(uploadDir, upload.filename), // В корне uploads
                ];

                // Добавляем варианты с разными форматами папок отчетов
                for (const folderVariant of oldReportFolderVariants) {
                    possiblePaths.push(path.join(uploadDir, folderVariant, upload.filename));
                }

                // Ищем файл по всем возможным путям
                for (const possiblePath of possiblePaths) {
                    if (existsSync(possiblePath)) {
                        actualOldPath = possiblePath;
                        fileFound = true;
                        break;
                    }
                }

                if (!fileFound) {
                    results.errors.push(`File not found for upload ${upload.id}: ${upload.path} (filename: ${upload.filename})`);
                    results.skipped++;
                    continue;
                }

                // Проверяем, не находится ли файл уже в правильной папке
                if (actualOldPath === newFullPath) {
                    // Уже в правильном месте, просто обновляем путь в БД если нужно
                    if (upload.path !== newRelativePath) {
                        await prisma.upload.update({
                            where: { id: upload.id },
                            data: { path: newRelativePath },
                        });
                    }
                    results.skipped++;
                } else {
                    // Создаем новую структуру папок
                    const newDir = path.dirname(newFullPath);
                    if (!existsSync(newDir)) {
                        await mkdir(newDir, { recursive: true });
                    }
                    // Перемещаем файл
                    await rename(actualOldPath, newFullPath);
                    // Обновляем путь в БД
                    await prisma.upload.update({
                        where: { id: upload.id },
                        data: { path: newRelativePath },
                    });
                    results.moved++;
                    console.log(`Moved: ${upload.filename} -> ${newRelativePath}`);
                }
            } catch (error) {
                const errorMsg = `Error processing upload ${upload.id}: ${error instanceof Error ? error.message : String(error)}`;
                results.errors.push(errorMsg);
                console.error(errorMsg);
            }
        }

        // Очистка пустых папок после миграции
        console.log('\nОчистка пустых папок...');
        await cleanupEmptyFolders(uploadDir);

        console.log('\n=== Результаты миграции ===');
        console.log(`Обработано: ${results.processed}`);
        console.log(`Перемещено: ${results.moved}`);
        console.log(`Пропущено: ${results.skipped}`);
        if (results.errors.length > 0) {
            console.log(`\nОшибки (${results.errors.length}):`);
            results.errors.forEach((error, idx) => {
                console.log(`${idx + 1}. ${error}`);
            });
        }

        return results;
    } catch (error) {
        console.error('Ошибка при миграции:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Запуск миграции
migrateUploads()
    .then(() => {
        console.log('\nМиграция завершена успешно!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\nМиграция завершилась с ошибкой:', error);
        process.exit(1);
    });
