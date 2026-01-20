import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAllDuplicateImages() {
    console.log('Проверяем все отчеты на дубликаты изображений...\n');

    // Получаем все отчеты с блоками
    const reports = await prisma.report.findMany({
        include: {
            blocks: {
                where: { type: 'screenshot' },
                orderBy: { position: 'asc' },
            },
        },
    });

    let totalUpdated = 0;

    for (const report of reports) {
        if (report.blocks.length === 0) {
            continue;
        }

        // Получаем все uploads для этого отчета
        const uploads = await prisma.upload.findMany({
            where: {
                reportId: report.id,
            },
            orderBy: { createdAt: 'asc' },
        });

        if (uploads.length === 0) {
            continue;
        }

        // Проверяем, есть ли дубликаты в блоках
        const allImageUrls = new Set<string>();
        let hasDuplicates = false;

        for (const block of report.blocks) {
            const data = block.data as any;
            if (data.images && Array.isArray(data.images)) {
                for (const img of data.images) {
                    if (allImageUrls.has(img.url)) {
                        hasDuplicates = true;
                        break;
                    }
                    allImageUrls.add(img.url);
                }
            }
            if (hasDuplicates) break;
        }

        if (!hasDuplicates && uploads.length === allImageUrls.size) {
            // Нет дубликатов и количество совпадает
            continue;
        }

        console.log(`\nОтчет: ${report.title} (${report.id})`);
        console.log(`  Блоков: ${report.blocks.length}, Uploads: ${uploads.length}`);

        // Распределяем uploads по блокам равномерно
        let updatedBlocks = 0;

        for (let i = 0; i < report.blocks.length; i++) {
            const block = report.blocks[i];
            const data = block.data as any;
            
            if (!data.images || !Array.isArray(data.images)) {
                continue;
            }

            // Распределяем uploads равномерно
            const imagesPerBlock = Math.ceil(uploads.length / report.blocks.length);
            const startIdx = i * imagesPerBlock;
            const endIdx = Math.min(startIdx + imagesPerBlock, uploads.length);
            const blockUploads = uploads.slice(startIdx, endIdx);

            if (blockUploads.length === 0) {
                continue;
            }

            // Создаем новые изображения
            const newImages = blockUploads.map((upload, idx) => {
                const segments = upload.path.split('/');
                const encodedSegments = segments.map(segment => encodeURIComponent(segment));
                const encodedPath = encodedSegments.join('/');
                const url = `/api/static/uploads/${encodedPath}`;

                const existingImage = data.images[idx];
                return {
                    url,
                    caption: existingImage?.caption || upload.filename.replace(/\.(png|jpg|jpeg|webp|gif)$/i, ''),
                    alt: existingImage?.alt || upload.filename.replace(/\.(png|jpg|jpeg|webp|gif)$/i, ''),
                };
            });

            // Проверяем изменения
            const currentUrls = data.images.map((img: any) => img.url).sort().join(',');
            const newUrls = newImages.map((img: any) => img.url).sort().join(',');

            if (currentUrls !== newUrls) {
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
            }
        }

        if (updatedBlocks > 0) {
            console.log(`  ✅ Обновлено блоков: ${updatedBlocks}`);
            totalUpdated += updatedBlocks;
        }
    }

    console.log(`\n=== Итого ===`);
    console.log(`Обновлено блоков: ${totalUpdated}`);
    console.log('\nГотово!');
    await prisma.$disconnect();
}

fixAllDuplicateImages().catch(console.error);
