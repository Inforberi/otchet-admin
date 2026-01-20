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

async function moveRootFiles() {
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

    console.log('Ищем файлы в БД и перемещаем их...\n');

    for (const filename of rootFiles) {
        try {
            // Ищем upload по filename или path
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
                console.log(`❌ Не найден в БД: ${filename}`);
                continue;
            }

            if (!upload.reportId) {
                console.log(`⚠️  Нет reportId: ${filename}`);
                continue;
            }

            const report = await prisma.report.findUnique({
                where: { id: upload.reportId },
                select: { id: true, title: true, groupId: true },
            });

            if (!report) {
                console.log(`❌ Отчет не найден для: ${filename}`);
                continue;
            }

            // Определяем пути
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

            const newRelativePath = path.join(groupFolderName, reportFolderName, filename);
            const oldPath = path.join(uploadDir, filename);
            const newPath = path.join(uploadDir, newRelativePath);

            if (!existsSync(oldPath)) {
                console.log(`⚠️  Файл не найден: ${filename}`);
                continue;
            }

            // Создаем папки
            const newDir = path.dirname(newPath);
            if (!existsSync(newDir)) {
                await mkdir(newDir, { recursive: true });
            }

            // Перемещаем файл
            await rename(oldPath, newPath);

            // Обновляем путь в БД
            await prisma.upload.update({
                where: { id: upload.id },
                data: { path: newRelativePath },
            });

            console.log(`✅ ${filename} -> ${newRelativePath}`);
        } catch (error) {
            console.error(`❌ Ошибка при обработке ${filename}:`, error);
        }
    }

    console.log('\nГотово!');
    await prisma.$disconnect();
}

moveRootFiles().catch(console.error);
