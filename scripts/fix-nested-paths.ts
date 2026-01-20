import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixNestedPaths() {
    // Исправляем пути в БД для файлов в неправильной вложенной папке
    const uploads = await prisma.upload.findMany({
        where: {
            path: {
                contains: 'tchety_po_saytu_8ca0c357/naliz_fiftyfourms_com_0488c9e4',
            },
        },
    });

    console.log(`Найдено записей с неправильным путем: ${uploads.length}\n`);

    for (const upload of uploads) {
        // Убираем лишний уровень вложенности
        const newPath = upload.path.replace('tchety_po_saytu_8ca0c357/tchety_po_saytu_8ca0c357/naliz_fiftyfourms_com_0488c9e4', 'otchety_po_saytu_8ca0c357/naliz_fiftyfourms_com_0488c9e4');
        
        await prisma.upload.update({
            where: { id: upload.id },
            data: { path: newPath },
        });
        
        console.log(`✅ Обновлен путь: ${upload.filename}`);
    }

    console.log('\nГотово!');
    await prisma.$disconnect();
}

fixNestedPaths().catch(console.error);
