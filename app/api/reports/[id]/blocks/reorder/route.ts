import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminMiddleware } from '@/lib/auth-helpers';
const VERSION_CONFLICT = 'VERSION_CONFLICT';

interface ReorderBlockIdsInput {
    blockIds: string[];
    expectedReportVersion?: number;
}

const reorderBlocks = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    // Проверка прав администратора
    const adminCheck = await requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id: reportId } = await params;
        const body: ReorderBlockIdsInput = await request.json();

        const expectedReportVersion =
            typeof body.expectedReportVersion === 'number'
                ? body.expectedReportVersion
                : Number(body.expectedReportVersion);

        if (!body.blockIds || !Array.isArray(body.blockIds)) {
            return NextResponse.json(
                { error: 'blockIds must be an array' },
                { status: 400 }
            );
        }

        if (!Number.isInteger(expectedReportVersion) || expectedReportVersion < 1) {
            return NextResponse.json(
                { error: 'expectedReportVersion is required' },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            const report = await tx.report.findUnique({
                where: { id: reportId },
                select: { id: true, version: true },
            });

            if (!report) {
                throw new Error('REPORT_NOT_FOUND');
            }

            if (report.version !== expectedReportVersion) {
                throw new Error(VERSION_CONFLICT);
            }

            const existingBlocks = await tx.reportBlock.findMany({
                where: { reportId },
                orderBy: { position: 'asc' },
            });

            if (existingBlocks.length !== body.blockIds.length) {
                throw new Error('BLOCK_SET_MISMATCH');
            }

            const existingIds = new Set(existingBlocks.map((block) => block.id));
            if (body.blockIds.some((blockId) => !existingIds.has(blockId))) {
                throw new Error('BLOCK_SET_MISMATCH');
            }

            const offset = existingBlocks.length + 1000;
            for (const block of existingBlocks) {
                await tx.reportBlock.update({
                    where: { id: block.id },
                    data: {
                        position: block.position + offset,
                        version: {
                            increment: 1,
                        },
                    },
                });
            }

            for (let index = 0; index < body.blockIds.length; index += 1) {
                await tx.reportBlock.update({
                    where: { id: body.blockIds[index] },
                    data: {
                        position: index,
                        version: {
                            increment: 1,
                        },
                    },
                });
            }

            await tx.report.update({
                where: { id: reportId },
                data: {
                    version: {
                        increment: 1,
                    },
                },
            });

            const blocks = await tx.reportBlock.findMany({
                where: { reportId },
                orderBy: { position: 'asc' },
            });

            return {
                success: true,
                blocks,
                reportVersion: report.version + 1,
            };
        });

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === VERSION_CONFLICT) {
                return NextResponse.json(
                    {
                        error: 'Report has been modified by another user',
                        code: VERSION_CONFLICT,
                    },
                    { status: 409 }
                );
            }

            if (error.message === 'REPORT_NOT_FOUND') {
                return NextResponse.json(
                    { error: 'Report not found' },
                    { status: 404 }
                );
            }

            if (error.message === 'BLOCK_SET_MISMATCH') {
                return NextResponse.json(
                    { error: 'Invalid block set for reorder' },
                    { status: 400 }
                );
            }
        }

        console.error('Error reordering blocks:', error);
        return NextResponse.json(
            { error: 'Failed to reorder blocks' },
            { status: 500 }
        );
    }
};

// PATCH /api/reports/[id]/blocks/reorder - переупорядочить блоки по массиву ID
export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return reorderBlocks(request, context);
}

// POST /api/reports/[id]/blocks/reorder - обратная совместимость
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return reorderBlocks(request, context);
}
