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

async function moveRemainingFiles() {
    const uploadDir = getUploadDir();
    const remainingFiles = [
        '1768464959176_ywta9vg________cdn.png',
        '1768464959168_jn629po________________________.png',
        '1768464959154_pnt3si1____________.png',
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
                    
                    if (remainingFiles.includes(filename)) {
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

    // Если файлы не найдены в отчетах, перемещаем их в папку группы
    for (const filename of remainingFiles) {
        try {
            const upload = await prisma.upload.findFirst({
                where: {
                    OR: [
                        { filename: filename },
                        { path: filename },
                    ],
                },
                include: {
                    group: {
                        select: { id: true, name: true },
                    },
                },
            });

            if (!upload) {
                console.log(`⚠️  Файл не найден в БД: ${filename}`);
                continue;
            }

            let reportId = upload.reportId;
            let reportTitle = '';
            let groupFolderName = upload.groupId;
            let reportFolderName = '';

            // Если файл найден в отчете, используем его
            if (fileToReportMap.has(filename)) {
                const fileInfo = fileToReportMap.get(filename)!;
                reportId = fileInfo.reportId;
                reportTitle = fileInfo.reportTitle;
                groupFolderName = fileInfo.groupId;
            }

            if (upload.group && upload.group.name) {
                const safeGroupName = createSafeFolderName(upload.group.name);
                const shortGroupId = upload.groupId.substring(0, 8);
                groupFolderName = `${safeGroupName}_${shortGroupId}`;
            }

            if (reportId && reportTitle) {
                const safeTitle = createSafeFolderName(reportTitle);
                const shortId = reportId.substring(0, 8);
                reportFolderName = `${safeTitle}_${shortId}`;
            } else {
                // Если нет reportId, создаем папку "unassigned" в группе
                reportFolderName = 'unassigned';
            }

            const newRelativePath = reportFolderName 
                ? path.join(groupFolderName, reportFolderName, filename)
                : path.join(groupFolderName, filename);
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

            // Обновляем запись в БД
            await prisma.upload.update({
                where: { id: upload.id },
                data: {
                    path: newRelativePath,
                    ...(reportId && { reportId }),
                },
            });

            if (reportId) {
                console.log(`✅ ${filename} -> ${newRelativePath} (${reportTitle})`);
            } else {
                console.log(`✅ ${filename} -> ${newRelativePath} (без отчета)`);
            }
        } catch (error) {
            console.error(`❌ Ошибка при обработке ${filename}:`, error);
        }
    }

    console.log('\nГотово!');
    await prisma.$disconnect();
}

moveRemainingFiles().catch(console.error);
