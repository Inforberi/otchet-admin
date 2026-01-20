import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateImageUrls() {
    console.log('Обновляем URL изображений в блоках отчетов...\n');

    // Получаем все блоки с изображениями
    const blocks = await prisma.reportBlock.findMany({
        where: {
            type: 'screenshot',
        },
    });

    console.log(`Найдено блоков с изображениями: ${blocks.length}\n`);

    let updatedBlocks = 0;
    let updatedImages = 0;

    for (const block of blocks) {
        const data = block.data as any;
        
        if (!data.images || !Array.isArray(data.images)) {
            continue;
        }

        let hasChanges = false;

        // Ищем все uploads для этого отчета и группы
        // Сначала получаем отчет, чтобы узнать groupId
        const report = await prisma.report.findUnique({
            where: { id: block.reportId },
            select: { groupId: true },
        });

        const uploads = await prisma.upload.findMany({
            where: {
                OR: [
                    { reportId: block.reportId },
                    ...(report ? [{ groupId: report.groupId }] : []),
                ],
            },
        });

        // Создаем мапу filename -> path
        const filenameToPath = new Map<string, string>();
        for (const upload of uploads) {
            const uploadFilename = upload.filename;
            filenameToPath.set(uploadFilename, upload.path);
            
            // Также добавляем варианты с путями из старого формата
            const pathParts = upload.path.split('/');
            if (pathParts.length > 1) {
                filenameToPath.set(pathParts[pathParts.length - 1], upload.path);
            }
        }

        // Обновляем изображения
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
            updatedImages += newImages.length;
            console.log(`✅ Обновлен блок ${block.id} (${newImages.length} изображений)`);
        }
    }

    console.log(`\n=== Результаты ===`);
    console.log(`Обновлено блоков: ${updatedBlocks}`);
    console.log(`Обновлено изображений: ${updatedImages}`);
    console.log('\nГотово!');
    await prisma.$disconnect();
}

updateImageUrls().catch(console.error);
