import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRemainingFiles() {
    const remainingFiles = [
        '1768464959176_ywta9vg________cdn.png',
        '1768464959168_jn629po________________________.png',
        '1768464959154_pnt3si1____________.png',
    ];

    console.log('Проверяем оставшиеся файлы в БД...\n');

    for (const filename of remainingFiles) {
        const upload = await prisma.upload.findFirst({
            where: {
                OR: [
                    { filename: filename },
                    { path: filename },
                    { path: { contains: filename } },
                ],
            },
            include: {
                group: {
                    select: { name: true },
                },
            },
        });

        if (upload) {
            console.log(`✅ Найден: ${filename}`);
            console.log(`   Путь в БД: ${upload.path}`);
            console.log(`   reportId: ${upload.reportId || 'нет'}`);
            console.log(`   groupId: ${upload.groupId}`);
            console.log(`   Группа: ${upload.group?.name || 'неизвестна'}`);
        } else {
            console.log(`❌ Не найден в БД: ${filename}`);
        }
        console.log('');
    }

    await prisma.$disconnect();
}

checkRemainingFiles().catch(console.error);
