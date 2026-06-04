import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth-helpers';
import { canEditContent } from '@/lib/auth';
import type { TaskBlockData, ImageData, PhotoBlockLayout } from '@/lib/db-types';
import { canUserActOnTask, normalizeTaskAssignees } from '@/lib/task-assignees';
import { sanitizeRichTextHtml } from '@/lib/rich-text-sanitize';

const VALID_LAYOUTS: PhotoBlockLayout[] = [
    'full-width',
    'two-column',
    'sidebar',
    'sidebar-reverse',
];

function parseLayout(value: unknown): PhotoBlockLayout | null {
    if (typeof value !== 'string') return null;
    return VALID_LAYOUTS.includes(value as PhotoBlockLayout)
        ? (value as PhotoBlockLayout)
        : null;
}

/** YYYY-MM-DD из input[type=date] */
function parseClosedAt(value: unknown): Date | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

type RouteParams = { params: Promise<{ id: string; blockId: string }> };

// POST /api/reports/[id]/blocks/[blockId]/complete — mark task as complete
export async function POST(request: NextRequest, { params }: RouteParams) {
    const user = await getRequestUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
    }
    if (user.mustChangePassword) {
        return NextResponse.json({ error: 'Требуется смена пароля.' }, { status: 403 });
    }

    try {
        const { blockId } = await params;

        const block = await prisma.reportBlock.findUnique({
            where: { id: blockId },
        });

        if (!block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        if (block.type !== 'task') {
            return NextResponse.json({ error: 'Block is not a task' }, { status: 400 });
        }

        const data = block.data as unknown as TaskBlockData;
        const isEditor = canEditContent(user);

        const assignees = normalizeTaskAssignees(data);
        if (!canUserActOnTask(user.id, assignees, isEditor)) {
            return NextResponse.json(
                { error: 'Только исполнитель может закрыть задачу.' },
                { status: 403 }
            );
        }

        let notes: string | null = null;
        let images: ImageData[] | null = null;
        let layout: PhotoBlockLayout = 'full-width';
        let closedAt: Date | null = null;
        try {
            const body = await request.json() as {
                notes?: string;
                images?: ImageData[];
                layout?: string;
                completedAt?: string;
            };
            notes = body.notes ? sanitizeRichTextHtml(body.notes) : null;
            images = body.images?.length ? body.images : null;
            layout = parseLayout(body.layout) ?? 'full-width';
            closedAt = parseClosedAt(body.completedAt);
        } catch {
            // body is optional
        }

        if (!closedAt) {
            return NextResponse.json(
                { error: 'Укажите дату закрытия.' },
                { status: 400 }
            );
        }

        const updated = await prisma.reportBlock.update({
            where: { id: blockId },
            data: {
                taskCompletedAt: closedAt,
                taskCompletedByUserId: user.id,
                taskCompletionNotes: notes,
                taskCompletionLayout: layout,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                taskCompletionImages: (images ?? null) as any,
            },
        });

        return NextResponse.json({ block: updated }, { status: 200 });
    } catch (error) {
        console.error('Error completing task block:', error);
        return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 });
    }
}

// DELETE /api/reports/[id]/blocks/[blockId]/complete — reopen task
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const user = await getRequestUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
    }
    if (user.mustChangePassword) {
        return NextResponse.json({ error: 'Требуется смена пароля.' }, { status: 403 });
    }

    try {
        const { blockId } = await params;

        const block = await prisma.reportBlock.findUnique({
            where: { id: blockId },
        });

        if (!block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        if (block.type !== 'task') {
            return NextResponse.json({ error: 'Block is not a task' }, { status: 400 });
        }

        const data = block.data as unknown as TaskBlockData;
        const isEditor = canEditContent(user);

        const assignees = normalizeTaskAssignees(data);
        if (!canUserActOnTask(user.id, assignees, isEditor)) {
            return NextResponse.json(
                { error: 'Только исполнитель может переоткрыть задачу.' },
                { status: 403 }
            );
        }

        const purge =
            request.nextUrl.searchParams.get('purge') === 'true' ||
            request.nextUrl.searchParams.get('purge') === '1';

        const updated = await prisma.reportBlock.update({
            where: { id: blockId },
            data: purge
                ? {
                      taskCompletedAt: null,
                      taskCompletedByUserId: null,
                      taskCompletionNotes: null,
                      taskCompletionImages: Prisma.DbNull,
                      taskCompletionLayout: null,
                  }
                : {
                      taskCompletedAt: null,
                      taskCompletedByUserId: null,
                  },
        });

        return NextResponse.json({ block: updated }, { status: 200 });
    } catch (error) {
        console.error('Error reopening task block:', error);
        return NextResponse.json({ error: 'Failed to reopen task' }, { status: 500 });
    }
}
