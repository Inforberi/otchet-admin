import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDuplicateImages() {
    const reportId = '1160fac6-4468-4267-995d-2639043bb94b';
    
    console.log(`Проверяем отчет ${reportId}...\n`);

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
        orderBy: { createdAt: 'asc' },
    });

    console.log(`Uploads в БД: ${uploads.length}`);
    uploads.forEach((upload, idx) => {
        console.log(`  [${idx}] ${upload.filename} -> ${upload.path}`);
    });
    console.log('');

    // Проверяем блоки и находим дубликаты
    const imageUrls = new Set<string>();
    const duplicateBlocks: typeof report.blocks = [];

    for (const block of report.blocks) {
        const data = block.data as any;
        
        if (!data.images || !Array.isArray(data.images)) {
            continue;
        }

        // Проверяем, есть ли дубликаты URL
        const blockUrls = data.images.map((img: any) => img.url);
        const hasDuplicates = blockUrls.some((url: string) => imageUrls.has(url));
        
        if (hasDuplicates || blockUrls.length === 0) {
            duplicateBlocks.push(block);
        } else {
            blockUrls.forEach((url: string) => imageUrls.add(url));
        }
    }

    console.log(`Блоков с дубликатами или без изображений: ${duplicateBlocks.length}\n`);

    // Обновляем блоки с правильными изображениями
    let updatedBlocks = 0;

    for (let i = 0; i < report.blocks.length; i++) {
        const block = report.blocks[i];
        const data = block.data as any;
        
        if (!data.images || !Array.isArray(data.images)) {
            continue;
        }

        // Определяем, какие изображения должны быть в этом блоке
        // Используем порядок uploads для распределения по блокам
        const imagesPerBlock = Math.ceil(uploads.length / report.blocks.length);
        const startIdx = i * imagesPerBlock;
        const endIdx = Math.min(startIdx + imagesPerBlock, uploads.length);
        const blockUploads = uploads.slice(startIdx, endIdx);

        if (blockUploads.length === 0) {
            console.log(`⚠️  Блок ${i} - нет uploads для этого блока`);
            continue;
        }

        // Создаем новые изображения из uploads
        const newImages = blockUploads.map((upload, idx) => {
            // Экранируем путь
            const segments = upload.path.split('/');
            const encodedSegments = segments.map(segment => encodeURIComponent(segment));
            const encodedPath = encodedSegments.join('/');
            const url = `/api/static/uploads/${encodedPath}`;

            // Сохраняем существующие caption и alt, если они есть
            const existingImage = data.images[idx];
            return {
                url,
                caption: existingImage?.caption || upload.filename.replace(/\.(png|jpg|jpeg|webp|gif)$/i, ''),
                alt: existingImage?.alt || upload.filename.replace(/\.(png|jpg|jpeg|webp|gif)$/i, ''),
            };
        });

        // Проверяем, изменились ли изображения
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
            console.log(`✅ Обновлен блок ${i} (${newImages.length} изображений)`);
            newImages.forEach((img, idx) => {
                console.log(`   [${idx}] ${img.url}`);
            });
        } else {
            console.log(`✓ Блок ${i} уже правильный`);
        }
        console.log('');
    }

    console.log(`\n=== Результаты ===`);
    console.log(`Обновлено блоков: ${updatedBlocks}`);
    console.log('\nГотово!');
    await prisma.$disconnect();
}

fixDuplicateImages().catch(console.error);
