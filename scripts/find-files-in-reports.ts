import { PrismaClient } from '@prisma/client';
import { rename, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

function getUploadDir(): string {
    if (path.isAbsolute(UPLOAD_DIR)) {
        return UPLOAD_DIR;
    }
    return path.join(process.cwd(), UPLOAD_DIR);
}

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

async function findAndMoveFiles() {
    const uploadDir = getUploadDir();
    const rootFiles = [
        '1768464959176_ywta9vg________cdn.png',
        '1768464959168_jn629po________________________.png',
        '1768464959154_pnt3si1____________.png',
        '1768462209052_tzvsiq1________cdn.png',
        '1768462123033_b6djthe___________CDN.png',
        '1768461515544_iq0zf5o____________.png',
        '1768461351219_k5ellkr________________________.png',
        '1768461252804_x22ee8n_uptime.png',
        '1768461104642_4j08s1r_fifty___________________.png',
        '1768460448154_zywcl6l_fiftyfourms.png',
        '1768460343480_c5azhek_________.png',
        '1768460276122_busw1pq_alfabank.png',
        '1768460184002_avg5v89_Tbank.png',
    ];

    console.log('Ищем файлы в блоках отчетов...\n');

    // Получаем все блоки отчетов
    const allBlocks = await prisma.reportBlock.findMany({
        include: {
            report: {
                include: {
                    group: {
                        select: { id: true, name: true },
                    },
                },
            },
        },
    });

    const fileToReportMap = new Map<string, { reportId: string; groupId: string; groupName: string; reportTitle: string }>();

    // Ищем файлы в блоках
    for (const block of allBlocks) {
        const data = block.data as any;
        
        if (data.images && Array.isArray(data.images)) {
            for (const image of data.images) {
                if (image.url) {
                    const urlParts = image.url.split('/');
                    const filename = urlParts[urlParts.length - 1];
                    
                    if (rootFiles.includes(filename)) {
                        fileToReportMap.set(filename, {
                            reportId: block.reportId,
                            groupId: block.report.groupId,
                            groupName: block.report.group.name,
                            reportTitle: block.report.title,
                        });
                    }
                }
            }
        }
    }

    console.log(`Найдено файлов в отчетах: ${fileToReportMap.size}\n`);

    // Перемещаем файлы
    for (const filename of rootFiles) {
        const fileInfo = fileToReportMap.get(filename);
        
        if (!fileInfo) {
            console.log(`⚠️  Файл не найден в отчетах: ${filename}`);
            continue;
        }

        try {
            // Определяем пути
            let groupFolderName = fileInfo.groupId;
            let reportFolderName = fileInfo.reportId;

            const safeGroupName = createSafeFolderName(fileInfo.groupName);
            const shortGroupId = fileInfo.groupId.substring(0, 8);
            groupFolderName = `${safeGroupName}_${shortGroupId}`;

            const safeTitle = createSafeFolderName(fileInfo.reportTitle);
            const shortId = fileInfo.reportId.substring(0, 8);
            reportFolderName = `${safeTitle}_${shortId}`;

            const newRelativePath = path.join(groupFolderName, reportFolderName, filename);
            const oldPath = path.join(uploadDir, filename);
            const newPath = path.join(uploadDir, newRelativePath);

            if (!existsSync(oldPath)) {
                console.log(`⚠️  Файл не найден на диске: ${filename}`);
                continue;
            }

            // Создаем папки
            const newDir = path.dirname(newPath);
            if (!existsSync(newDir)) {
                await mkdir(newDir, { recursive: true });
            }

            // Перемещаем файл
            await rename(oldPath, newPath);

            // Обновляем или создаем запись в БД
            const existingUpload = await prisma.upload.findFirst({
                where: {
                    OR: [
                        { filename: filename },
                        { path: filename },
                    ],
                },
            });

            if (existingUpload) {
                await prisma.upload.update({
                    where: { id: existingUpload.id },
                    data: {
                        path: newRelativePath,
                        reportId: fileInfo.reportId,
                        groupId: fileInfo.groupId,
                    },
                });
            } else {
                // Создаем новую запись
                await prisma.upload.create({
                    data: {
                        filename: filename,
                        path: newRelativePath,
                        reportId: fileInfo.reportId,
                        groupId: fileInfo.groupId,
                        mimeType: 'image/png',
                        size: 0, // Размер можно получить из файла, но это не критично
                    },
                });
            }

            console.log(`✅ ${filename} -> ${newRelativePath} (${fileInfo.reportTitle})`);
        } catch (error) {
            console.error(`❌ Ошибка при обработке ${filename}:`, error);
        }
    }

    console.log('\nГотово!');
    await prisma.$disconnect();
}

findAndMoveFiles().catch(console.error);
