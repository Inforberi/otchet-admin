import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRemainingPaths() {
    // Исправляем пути в БД для оставшихся файлов
    const uploads = await prisma.upload.findMany({
        where: {
            path: {
                startsWith: 'tchety_po_saytu_8ca0c357',
            },
        },
    });

    console.log(`Найдено записей с неправильным путем: ${uploads.length}\n`);

    for (const upload of uploads) {
        const newPath = upload.path.replace('tchety_po_saytu_8ca0c357', 'otchety_po_saytu_8ca0c357');
        
        await prisma.upload.update({
            where: { id: upload.id },
            data: { path: newPath },
        });
        
        console.log(`✅ Обновлен путь: ${upload.filename} -> ${newPath}`);
    }

    console.log('\nГотово!');
    await prisma.$disconnect();
}

fixRemainingPaths().catch(console.error);
