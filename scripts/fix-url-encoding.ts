import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUrlEncoding() {
    console.log('Исправляем кодирование URL в блоках отчетов...\n');

    // Получаем все блоки с изображениями
    const blocks = await prisma.reportBlock.findMany({
        where: {
            type: 'screenshot',
        },
    });

    console.log(`Найдено блоков: ${blocks.length}\n`);

    let updatedBlocks = 0;
    let updatedImages = 0;

    for (const block of blocks) {
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
            const pathFromUrl = image.url.replace('/api/static/uploads/', '');
            
            // Проверяем, есть ли пробелы или другие символы, которые нужно экранировать
            // Если путь содержит пробелы, но они не экранированы, нужно экранировать
            if (pathFromUrl.includes(' ') && !pathFromUrl.includes('%20')) {
                // Экранируем каждый сегмент пути отдельно
                const segments = pathFromUrl.split('/');
                const encodedSegments = segments.map((segment: string) => encodeURIComponent(segment));
                const encodedPath = encodedSegments.join('/');
                const newUrl = `/api/static/uploads/${encodedPath}`;
                
                if (newUrl !== image.url) {
                    hasChanges = true;
                    updatedImages++;
                    return {
                        ...image,
                        url: newUrl,
                    };
                }
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
        }
    }

    console.log(`\n=== Результаты ===`);
    console.log(`Обновлено блоков: ${updatedBlocks}`);
    console.log(`Обновлено изображений: ${updatedImages}`);
    console.log('\nГотово!');
    await prisma.$disconnect();
}

fixUrlEncoding().catch(console.error);
