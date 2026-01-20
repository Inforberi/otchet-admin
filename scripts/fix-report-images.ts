import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixReportImages() {
    const reportId = '34bae704-c6f8-4098-aeba-ec477b7ea97d';
    
    console.log(`Исправляем изображения в отчете ${reportId}...\n`);

    const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: {
            blocks: {
                where: { type: 'screenshot' },
                orderBy: { position: 'asc' },
            },
        },
    });

    if (!report) {
        console.log('Отчет не найден');
        await prisma.$disconnect();
        return;
    }

    console.log(`Отчет: ${report.title}`);
    console.log(`Блоков с изображениями: ${report.blocks.length}\n`);

    // Получаем все uploads для этого отчета
    const uploads = await prisma.upload.findMany({
        where: {
            reportId: reportId,
        },
    });

    console.log(`Uploads в БД: ${uploads.length}`);
    uploads.forEach(upload => {
        console.log(`  - ${upload.filename} -> ${upload.path}`);
    });
    console.log('');

    // Создаем мапу filename -> path
    const filenameToPath = new Map<string, string>();
    for (const upload of uploads) {
        filenameToPath.set(upload.filename, upload.path);
        // Также добавляем варианты с путями из старого формата
        const pathParts = upload.path.split('/');
        if (pathParts.length > 1) {
            filenameToPath.set(pathParts[pathParts.length - 1], upload.path);
        }
    }

    let updatedBlocks = 0;

    // Обновляем блоки
    for (const block of report.blocks) {
        const data = block.data as any;
        
        if (!data.images || !Array.isArray(data.images)) {
            continue;
        }

        let hasChanges = false;
        const newImages = data.images.map((image: any) => {
            if (!image.url || !image.url.startsWith('/api/static/uploads/')) {
                return image;
            }

            // Извлекаем путь из URL
            const oldPath = image.url.replace('/api/static/uploads/', '');
            
            // Извлекаем filename из пути
            const pathParts = oldPath.split('/');
            const filename = pathParts[pathParts.length - 1];

            // Ищем новый путь
            const newPath = filenameToPath.get(filename);
            
            if (newPath && newPath !== oldPath) {
                hasChanges = true;
                return {
                    ...image,
                    url: `/api/static/uploads/${newPath}`,
                };
            }

            return image;
        });

        if (hasChanges) {
            await prisma.reportBlock.update({
                where: { id: block.id },
                data: {
                    data: {
                        ...data,
                        images: newImages,
                    },
                },
            });

            updatedBlocks++;
            console.log(`✅ Обновлен блок ${block.id} (${newImages.length} изображений)`);
            newImages.forEach((img: any, idx: number) => {
                console.log(`   [${idx}] ${img.url}`);
            });
        } else {
            console.log(`⚠️  Блок ${block.id} - пути уже правильные или изображения не найдены`);
            data.images.forEach((img: any, idx: number) => {
                console.log(`   [${idx}] ${img.url}`);
            });
        }
        console.log('');
    }

    console.log(`\n=== Результаты ===`);
    console.log(`Обновлено блоков: ${updatedBlocks}`);
    console.log('\nГотово!');
    await prisma.$disconnect();
}

fixReportImages().catch(console.error);
