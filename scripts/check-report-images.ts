import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkReportImages() {
    const reportId = '0488c9e4-adc7-4523-9a35-09f4a1408e28';
    
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
    });

    console.log(`Uploads в БД: ${uploads.length}`);
    uploads.forEach(upload => {
        console.log(`  - ${upload.filename} -> ${upload.path}`);
    });
    console.log('');

    // Проверяем блоки
    for (const block of report.blocks) {
        const data = block.data as any;
        console.log(`Блок ${block.id}:`);
        
        if (data.images && Array.isArray(data.images)) {
            data.images.forEach((img: any, idx: number) => {
                console.log(`  Изображение ${idx + 1}:`);
                console.log(`    URL: ${img.url}`);
                
                // Извлекаем путь из URL
                if (img.url && img.url.startsWith('/api/static/uploads/')) {
                    const pathFromUrl = img.url.replace('/api/static/uploads/', '');
                    const filename = pathFromUrl.split('/').pop();
                    
                    // Проверяем, существует ли файл
                    const upload = uploads.find(u => u.filename === filename || u.path.includes(filename));
                    if (upload) {
                        console.log(`    ✅ Найден в БД: ${upload.path}`);
                        if (upload.path !== pathFromUrl) {
                            console.log(`    ⚠️  Путь не совпадает! Нужно обновить на: ${upload.path}`);
                        }
                    } else {
                        console.log(`    ❌ Не найден в БД для этого отчета`);
                    }
                }
            });
        }
        console.log('');
    }

    await prisma.$disconnect();
}

checkReportImages().catch(console.error);
