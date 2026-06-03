import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { UpdateBlockInput } from '@/lib/db-types';
import type { Prisma } from '@prisma/client';
import { requireEditorMiddleware } from '@/lib/auth-helpers';

const VERSION_CONFLICT = 'VERSION_CONFLICT';

// PATCH /api/reports/[id]/blocks/[blockId] - обновить блок
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; blockId: string }> }
) {
    // Проверка прав администратора
    const adminCheck = await requireEditorMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id: reportId, blockId } = await params;
        const body: Partial<UpdateBlockInput> = await request.json();
        const expectedReportVersion =
            typeof body.expectedReportVersion === 'number'
                ? body.expectedReportVersion
                : Number(body.expectedReportVersion);

        if (!Number.isInteger(expectedReportVersion) || expectedReportVersion < 1) {
            return NextResponse.json(
                { error: 'expectedReportVersion is required' },
                { status: 400 }
            );
        }

        const updateData: Prisma.ReportBlockUpdateInput = {};

        if (body.data !== undefined) {
            updateData.data = body.data as Prisma.InputJsonValue;
        }
        if (body.position !== undefined) {
            updateData.position = body.position;
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

            const existingBlock = await tx.reportBlock.findFirst({
                where: {
                    id: blockId,
                    reportId,
                },
            });

            if (!existingBlock) {
                throw new Error('BLOCK_NOT_FOUND');
            }

            const block = await tx.reportBlock.update({
                where: { id: blockId },
                data: {
                    ...updateData,
                    version: {
                        increment: 1,
                    },
                },
            });

            await tx.report.update({
                where: { id: reportId },
                data: {
                    version: {
                        increment: 1,
                    },
                },
            });

            return {
                block,
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

            if (error.message === 'REPORT_NOT_FOUND' || error.message === 'BLOCK_NOT_FOUND') {
                return NextResponse.json(
                    { error: 'Block not found' },
                    { status: 404 }
                );
            }
        }

        console.error('Error updating block:', error);
        return NextResponse.json(
            { error: 'Failed to update block' },
            { status: 500 }
        );
    }
}

// DELETE /api/reports/[id]/blocks/[blockId] - удалить блок
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; blockId: string }> }
) {
    // Проверка прав администратора
    const adminCheck = await requireEditorMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id: reportId, blockId } = await params;
        const body = await request.json().catch(() => ({}));
        const expectedReportVersion =
            typeof body.expectedReportVersion === 'number'
                ? body.expectedReportVersion
                : Number(body.expectedReportVersion);

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

            const block = await tx.reportBlock.findFirst({
                where: {
                    id: blockId,
                    reportId,
                },
                select: {
                    id: true,
                },
            });

            if (!block) {
                throw new Error('BLOCK_NOT_FOUND');
            }

            await tx.reportBlock.delete({
                where: { id: blockId },
            });

            const remainingBlocks = await tx.reportBlock.findMany({
                where: { reportId },
                orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            });

            for (let index = 0; index < remainingBlocks.length; index += 1) {
                const currentBlock = remainingBlocks[index];
                if (currentBlock.position !== index) {
                    await tx.reportBlock.update({
                        where: { id: currentBlock.id },
                        data: {
                            position: index,
                            version: {
                                increment: 1,
                            },
                        },
                    });
                }
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

            if (error.message === 'REPORT_NOT_FOUND' || error.message === 'BLOCK_NOT_FOUND') {
                return NextResponse.json(
                    { error: 'Block not found' },
                    { status: 404 }
                );
            }
        }

        console.error('Error deleting block:', error);
        return NextResponse.json(
            { error: 'Failed to delete block' },
            { status: 500 }
        );
    }
}
