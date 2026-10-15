import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { createSession } from './auth';
import { POST } from '../app/api/reports/[id]/blocks/route';

const restorers: (() => void)[] = [];
// Делегаты Prisma — Proxy: заменяем методы через setter, без обращения к БД.
const stub = (target: object, key: string, implementation: (...args: never[]) => unknown) => {
    const original: unknown = Reflect.get(target, key);
    Reflect.set(target, key, implementation);
    restorers.push(() => { Reflect.set(target, key, original); });
};
const restore = () => {
    while (restorers.length) restorers.pop()?.();
};

const existing = {
    id: 'existing', reportId: 'report', type: 'text', position: 0,
    data: { title: 'Существующий блок', content: '<p>Сохраненные данные</p>' },
};

const setup = (options?: { conflict?: boolean; editor?: boolean }) => {
    const calls: { creates: unknown[]; committed: boolean; claimed: boolean } = {
        creates: [], committed: false, claimed: false,
    };
    stub(prisma.user, 'findUnique', async () => ({
        id: 'user', appRoleId: 'editor', isActive: true, mustChangePassword: false,
        appRole: { id: 'editor', name: 'Редактор', canEditContent: options?.editor ?? true,
            canManageUsers: false, restrictGroups: false },
    }));
    stub(prisma.reportGroup, 'findMany', async () => [
        { id: 'group', path: 'group', isHidden: false, createdByUserId: 'user' },
    ]);
    stub(prisma.report, 'findUnique', async () => ({
        groupId: 'group', isHidden: false, createdByUserId: 'user',
    }));
    const tx = {
        report: {
            findUnique: async () => ({ id: 'report', version: 4 }),
            updateMany: async () => {
                calls.claimed = true;
                return { count: options?.conflict ? 0 : 1 };
            },
            findUniqueOrThrow: async () => ({
                id: 'report', title: 'Отчет', blocks: [existing, ...calls.creates],
            }),
            update: async () => ({}),
        },
        reportBlock: {
            findFirst: async () => ({ position: 0 }),
            findMany: async () => [],
            create: async ({ data }: { data: Record<string, unknown> }) => {
                assert.equal(calls.claimed, true, 'Проверка версии должна предшествовать записи');
                const block = { ...data, id: `new-${calls.creates.length}` };
                calls.creates.push(block);
                return block;
            },
        },
    };
    stub(prisma, '$transaction', async (callback: (client: typeof tx) => Promise<unknown>) => {
        const result = await callback(tx);
        calls.committed = true;
        return result;
    });
    return calls;
};

const request = (body: unknown) => new NextRequest('http://localhost/api/reports/report/blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: `admin_session=${createSession('user', 'editor')}` },
    body: JSON.stringify(body),
});
const params = { params: Promise.resolve({ id: 'report' }) };

test('API добавляет пакет после существующих блоков и возвращает новую версию', async () => {
    try {
        const calls = setup();
        const before = structuredClone(existing);
        const response = await POST(request({ expectedReportVersion: 4, blocks: [
            { type: 'text', data: { content: 'Новый текст' } },
            { type: 'screenshot', data: { images: [{ url: '/api/static/uploads/photo.jpg' }], layout: 'two-column' } },
        ] }), params);
        assert.equal(response.status, 201);
        const body = await response.json();
        assert.equal(body.reportVersion, 5);
        assert.deepEqual(body.blocks.map((block: { position: number }) => block.position), [1, 2]);
        assert.deepEqual(existing, before);
        assert.equal(calls.committed, true);
    } finally { restore(); }
});

test('API при проигранной проверке версии не создает блоки', async () => {
    try {
        const calls = setup({ conflict: true });
        const response = await POST(request({ expectedReportVersion: 4,
            type: 'divider', data: {},
        }), params);
        assert.equal(response.status, 409);
        assert.equal((await response.json()).code, 'VERSION_CONFLICT');
        assert.deepEqual(calls.creates, []);
        assert.equal(calls.committed, false);
    } finally { restore(); }
});

test('API сохраняет одиночный формат запроса и ответа редактора', async () => {
    try {
        setup();
        const response = await POST(request({ expectedReportVersion: 4,
            type: 'text', position: 999, data: { title: 'Заголовок', content: 'Текст' },
        }), params);
        assert.equal(response.status, 201);
        const body = await response.json();
        assert.equal(body.block.position, 1);
        assert.equal(body.block.type, 'text');
        assert.equal(body.reportVersion, 5);
        assert.equal(body.blocks, undefined);
    } finally { restore(); }
});

test('API отклоняет ссылку на отсутствующую или чужую секцию без записи блоков', async () => {
    try {
        const calls = setup();
        const response = await POST(request({ expectedReportVersion: 4,
            type: 'text', parentId: 'foreign-section', data: { content: 'Текст' },
        }), params);
        assert.equal(response.status, 400);
        assert.deepEqual(calls.creates, []);
        assert.equal(calls.committed, false);
    } finally { restore(); }
});

test('API запрещает запись пользователю без права редактирования', async () => {
    try {
        const calls = setup({ editor: false });
        const response = await POST(request({ expectedReportVersion: 4, type: 'divider', data: {} }), params);
        assert.equal(response.status, 403);
        assert.equal(calls.claimed, false);
    } finally { restore(); }
});
