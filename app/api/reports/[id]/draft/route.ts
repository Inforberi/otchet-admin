import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    buildDraftPayload,
    computeDraftHash,
    type DraftMetadata,
} from '@/lib/draft-hash';
import type { ReportBlockFromDB } from '@/lib/db-types';
import type { Prisma } from '@prisma/client';
import { requireAdminMiddleware } from '@/lib/auth-helpers';
import { createSlug, generateUniqueSlug } from '@/lib/slug';

const VERSION_CONFLICT = 'VERSION_CONFLICT';

type DraftBlockSnapshot = {
    id?: string;
    type: 'text' | 'screenshot' | 'divider';
    position: number;
    data: ReportBlockFromDB['data'];
};

type DraftSnapshotBody = {
    expectedVersion?: number;
    report?: DraftMetadata;
    blocks?: DraftBlockSnapshot[];
};

const selectReportDraftFields = {
    id: true,
    title: true,
    subtitle: true,
    client: true,
    date: true,
    status: true,
    titleFontSize: true,
    descriptionFontSize: true,
    captionFontSize: true,
    groupId: true,
    slug: true,
    version: true,
    draftHash: true,
    publishedHash: true,
    draftUpdatedAt: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
} as const;

const getFullReport = async (id: string) =>
    prisma.report.findUnique({
        where: { id },
        include: {
            group: {
                select: {
                    id: true,
                    name: true,
                    path: true,
                },
            },
            blocks: {
                orderBy: { position: 'asc' },
            },
        },
    });

export const PATCH = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const adminCheck = requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id } = await params;
        const body = (await request.json()) as DraftSnapshotBody;
        const expectedVersion =
            typeof body.expectedVersion === 'number'
                ? body.expectedVersion
                : Number(body.expectedVersion);

        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
            return NextResponse.json(
                { error: 'expectedVersion is required' },
                { status: 400 }
            );
        }

        if (!body.report || !Array.isArray(body.blocks)) {
            return NextResponse.json(
                { error: 'report and blocks are required' },
                { status: 400 }
            );
        }

        const sortedBlocks = [...body.blocks].sort((a, b) => a.position - b.position);

        await prisma.$transaction(async (tx) => {
            const currentReport = await tx.report.findUnique({
                where: { id },
                include: {
                    blocks: {
                        orderBy: { position: 'asc' },
                    },
                },
            });

            if (!currentReport) {
                throw new Error('REPORT_NOT_FOUND');
            }

            if (currentReport.version !== expectedVersion) {
                throw new Error(VERSION_CONFLICT);
            }

            const nextReportState = {
                title: body.report?.title ?? currentReport.title,
                subtitle:
                    body.report?.subtitle !== undefined
                        ? body.report.subtitle
                        : currentReport.subtitle,
                client:
                    body.report?.client !== undefined
                        ? body.report.client
                        : currentReport.client,
                date:
                    body.report?.date !== undefined
                        ? body.report.date
                        : currentReport.date,
                titleFontSize:
                    body.report?.titleFontSize !== undefined
                        ? body.report.titleFontSize
                        : currentReport.titleFontSize,
                descriptionFontSize:
                    body.report?.descriptionFontSize !== undefined
                        ? body.report.descriptionFontSize
                        : currentReport.descriptionFontSize,
                captionFontSize:
                    body.report?.captionFontSize !== undefined
                        ? body.report.captionFontSize
                        : currentReport.captionFontSize,
            };

            const nextBlocksForHash = sortedBlocks.map((block, index) => ({
                id: block.id ?? `generated-${index}`,
                reportId: currentReport.id,
                type: block.type,
                position: index,
                data: block.data,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            })) as ReportBlockFromDB[];

            const nextDraftHash = await computeDraftHash(
                buildDraftPayload(nextReportState, nextBlocksForHash)
            );

            if (
                currentReport.draftHash &&
                currentReport.draftHash === nextDraftHash
            ) {
                return;
            }

            const existingBlocksById = new Map(
                currentReport.blocks.map((block) => [block.id, block])
            );
            const incomingIds = new Set(
                sortedBlocks.flatMap((block) => (block.id ? [block.id] : []))
            );

            const blocksToDelete = currentReport.blocks
                .filter((block) => !incomingIds.has(block.id))
                .map((block) => block.id);

            if (blocksToDelete.length > 0) {
                await tx.reportBlock.deleteMany({
                    where: {
                        reportId: id,
                        id: {
                            in: blocksToDelete,
                        },
                    },
                });
            }

            const blocksToOffset = currentReport.blocks
                .filter((block) => incomingIds.has(block.id))
                .map((block) => block.id);

            if (blocksToOffset.length > 0) {
                for (const blockId of blocksToOffset) {
                    const existing = existingBlocksById.get(blockId);
                    if (!existing) continue;

                    await tx.reportBlock.update({
                        where: { id: blockId },
                        data: {
                            position: existing.position + sortedBlocks.length + 1000,
                            version: {
                                increment: 1,
                            },
                        },
                    });
                }
            }

            for (let index = 0; index < sortedBlocks.length; index += 1) {
                const block = sortedBlocks[index];
                const existing = block.id ? existingBlocksById.get(block.id) : null;

                if (existing) {
                    await tx.reportBlock.update({
                        where: { id: existing.id },
                        data: {
                            type: block.type,
                            data: block.data as Prisma.InputJsonValue,
                            position: index,
                            version: {
                                increment: 1,
                            },
                        },
                    });
                    continue;
                }

                await tx.reportBlock.create({
                    data: {
                        id: block.id,
                        reportId: id,
                        type: block.type,
                        position: index,
                        data: block.data as Prisma.InputJsonValue,
                    },
                });
            }

            const updateData: Prisma.ReportUpdateInput = {
                title: nextReportState.title,
                subtitle: nextReportState.subtitle,
                client: nextReportState.client,
                date: nextReportState.date,
                titleFontSize: nextReportState.titleFontSize,
                descriptionFontSize: nextReportState.descriptionFontSize,
                captionFontSize: nextReportState.captionFontSize,
                draftHash: nextDraftHash,
                draftUpdatedAt: new Date(),
                version: {
                    increment: 1,
                },
            };

            if (nextReportState.title !== currentReport.title) {
                const baseSlug = createSlug(nextReportState.title);
                updateData.slug = await generateUniqueSlug(baseSlug, async (slug) => {
                    const exists = await tx.report.findUnique({
                        where: {
                            groupId_slug: {
                                groupId: currentReport.groupId,
                                slug,
                            },
                        },
                    });

                    return !exists || exists.id === id;
                });
            }

            await tx.report.update({
                where: { id },
                data: updateData,
            });
        });

        const report = await getFullReport(id);

        return NextResponse.json({ report }, { status: 200 });
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
        }

        console.error('Error syncing draft:', error);
        return NextResponse.json({ error: 'Failed to sync draft' }, { status: 500 });
    }
};

export const GET = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    try {
        const { id } = await params;
        const report = await prisma.report.findUnique({
            where: { id },
            select: {
                ...selectReportDraftFields,
                publishedSnapshot: true,
            },
        });

        if (!report) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const hasUnpublishedChanges =
            Boolean(report.draftHash) &&
            Boolean(report.publishedHash) &&
            report.draftHash !== report.publishedHash;

        return NextResponse.json({
            report,
            hasUnpublishedChanges,
        });
    } catch (error) {
        console.error('Error fetching draft state:', error);
        return NextResponse.json({ error: 'Failed to fetch draft state' }, { status: 500 });
    }
};
