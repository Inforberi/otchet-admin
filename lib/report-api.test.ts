import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiBlockSchema, appendBlocksSchema, createReportSchema } from './report-api';

test('фото: все настройки сохраняются в разобранном запросе', () => {
    const image = {
        url: '/api/static/uploads/group/report/photo.png', uploadId: 'upload-1',
        mimeType: 'image/png', caption: 'До изменений', alt: 'Главная страница',
        fit: 'auto-height', align: 'right',
    };
    const block = apiBlockSchema.parse({ type: 'screenshot', data: {
        title: 'Фото', description: '<p>Описание</p>', images: [image],
        layout: 'sidebar-reverse', imageSize: 'large', customWidth: '75%', spacing: 'small',
    } });
    assert.equal(block.type, 'screenshot');
    if (block.type !== 'screenshot') throw new Error('Unexpected block type');
    assert.deepEqual(block.data.images[0], image);
    assert.equal(block.data.layout, 'sidebar-reverse');
    assert.equal(block.data.customWidth, '75%');
    assert.equal(block.data.imageSize, 'large');
    assert.equal(block.data.spacing, 'small');
});

test('неизвестный тип, неверное содержимое и опасные URL отклоняются', () => {
    for (const input of [
        { type: 'unknown', data: {} },
        { type: 'text', data: { images: [] } },
        { type: 'screenshot', data: { images: [{ url: 'javascript:alert(1)' }] } },
        { type: 'screenshot', data: { images: [{ url: '//example.com/image.png' }] } },
        { type: 'screenshot', data: { images: [], layout: 'unknown' } },
    ]) assert.equal(apiBlockSchema.safeParse(input).success, false);
});

test('одиночный запрос редактора и пакетный запрос поддерживаются', () => {
    assert.equal(appendBlocksSchema.safeParse({
        expectedReportVersion: 1, type: 'text', position: 3,
        data: { title: 'Заголовок', content: 'Текст' },
    }).success, true);
    assert.equal(appendBlocksSchema.safeParse({
        expectedReportVersion: 2,
        blocks: [{ type: 'divider', data: {} }, { type: 'task', data: { title: 'Задача' } }],
    }).success, true);
    assert.equal(appendBlocksSchema.safeParse({ expectedReportVersion: 1, blocks: [] }).success, false);
    assert.equal(appendBlocksSchema.safeParse({ blocks: [{ type: 'divider', data: {} }] }).success, false);
});

test('HTML очищается, задача получает обязательные поля', () => {
    const text = apiBlockSchema.parse({ type: 'text', data: {
        content: '<p onclick="alert(1)">Текст</p><script>alert(1)</script>',
    } });
    assert.equal(JSON.stringify(text).includes('onclick'), false);
    assert.equal(JSON.stringify(text).includes('<script>'), false);
    const task = apiBlockSchema.parse({ type: 'task', data: { title: 'Проверить' } });
    if (task.type !== 'task') throw new Error('Unexpected block type');
    assert.deepEqual(task.data.assignees, []);
    assert.deepEqual(task.data.images, []);
    assert.equal(task.data.deadline, null);
    assert.ok(!Number.isNaN(Date.parse(task.data.createdAt)));
});

test('метаданные: типы, статус и календарная дата проверяются', () => {
    const base = { title: 'Отчет', groupId: 'group-1' };
    assert.equal(createReportSchema.safeParse({ ...base, date: '2026-02-30' }).success, false);
    assert.equal(createReportSchema.safeParse({ ...base, date: '2026-10-15' }).success, true);
    assert.equal(createReportSchema.safeParse({ ...base, status: 'unknown' }).success, false);
    assert.equal(createReportSchema.safeParse({ ...base, title: 123 }).success, false);
    assert.equal(createReportSchema.safeParse({ ...base, title: '<script>x</script>' }).success, false);
});
