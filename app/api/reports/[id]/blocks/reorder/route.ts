import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminMiddleware } from '@/lib/auth-helpers';

interface ReorderBlockInput {
    blockId: string;
    newPosition: number;
}

interface ReorderBlockIdsInput {
    blockIds: string[];
}

// PATCH /api/reports/[id]/blocks/reorder - переупорядочить блоки по массиву ID
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Проверка прав администратора
    const adminCheck = requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id: reportId } = await params;
        const body: ReorderBlockIdsInput = await request.json();

        if (!body.blockIds || !Array.isArray(body.blockIds)) {
            return NextResponse.json(
                { error: 'blockIds must be an array' },
                { status: 400 }
            );
        }

        // Обновляем позиции всех блоков в транзакции
        await prisma.$transaction(
            body.blockIds.map((blockId, index) =>
                prisma.reportBlock.update({
                    where: { id: blockId },
                    data: { position: index },
                })
            )
        );

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Error reordering blocks:', error);
        return NextResponse.json(
            { error: 'Failed to reorder blocks' },
            { status: 500 }
        );
    }
}

// POST /api/reports/[id]/blocks/reorder - переупорядочить блоки
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Проверка прав администратора
    const adminCheck = requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id: reportId } = await params;
        const body: ReorderBlockInput[] = await request.json();

        // Обновляем позиции всех блоков в транзакции
        await prisma.$transaction(
            body.map((item) =>
                prisma.reportBlock.update({
                    where: { id: item.blockId },
                    data: { position: item.newPosition },
                })
            )
        );

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Error reordering blocks:', error);
        return NextResponse.json(
            { error: 'Failed to reorder blocks' },
            { status: 500 }
        );
    }
}
