import { PrismaClient } from '@prisma/client';
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

async function fixPaths() {
    const uploadDir = getUploadDir();
    
    // Исправляем пути в БД для файлов, которые были перемещены в неправильную папку
    const wrongPath = 'tchety_po_saytu_8ca0c357/naliz_fiftyfourms_com_0488c9e4';
    const correctPath = 'otchety_po_saytu_8ca0c357/naliz_fiftyfourms_com_0488c9e4';
    
    const uploads = await prisma.upload.findMany({
        where: {
            path: {
                startsWith: wrongPath,
            },
        },
    });

    console.log(`Найдено записей с неправильным путем: ${uploads.length}\n`);

    for (const upload of uploads) {
        const newPath = upload.path.replace(wrongPath, correctPath);
        
        await prisma.upload.update({
            where: { id: upload.id },
            data: { path: newPath },
        });
        
        console.log(`✅ Обновлен путь: ${upload.filename}`);
    }

    console.log('\nГотово!');
    await prisma.$disconnect();
}

fixPaths().catch(console.error);
