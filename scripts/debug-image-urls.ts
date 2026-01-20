import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugImageUrls() {
    const reportId = '0488c9e4-adc7-4523-9a35-09f4a1408e28';
    
    const blocks = await prisma.reportBlock.findMany({
        where: {
            reportId: reportId,
            type: 'screenshot',
        },
        orderBy: { position: 'asc' },
    });

    console.log('Проверяем URL изображений в блоках:\n');

    for (const block of blocks) {
        const data = block.data as any;
        console.log(`Блок ${block.id}:`);
        
        if (data.images && Array.isArray(data.images)) {
            data.images.forEach((img: any, idx: number) => {
                console.log(`  [${idx}] URL: ${img.url}`);
                
                if (img.url && img.url.startsWith('/api/static/uploads/')) {
                    const pathFromUrl = img.url.replace('/api/static/uploads/', '');
                    const parts = pathFromUrl.split('/');
                    const filename = parts[parts.length - 1];
                    console.log(`      Путь: ${pathFromUrl}`);
                    console.log(`      Имя файла: ${filename}`);
                }
            });
        }
        console.log('');
    }

    await prisma.$disconnect();
}

debugImageUrls().catch(console.error);
