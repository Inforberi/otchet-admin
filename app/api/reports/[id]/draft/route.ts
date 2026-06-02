import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    buildDraftPayload,
    computeDraftHash,
    type DraftMetadataPatch,
} from '@/lib/draft-hash';
import type { ReportBlockFromDB } from '@/lib/db-types';
import type { Prisma } from '@prisma/client';
import { requireAdminMiddleware } from '@/lib/auth-helpers';
import { createSlug, generateUniqueSlug } from '@/lib/slug';

type DraftBlockPatch = {
    id: string;
    data?: unknown;
    position?: number;
};

type DraftPatchBody = {
    draftHash?: string;
    metadata?: DraftMetadataPatch;
    blocks?: DraftBlockPatch[];
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

export const PATCH = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const adminCheck = requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id } = await params;
        const body = (await request.json()) as DraftPatchBody;

        const currentReport = await prisma.report.findUnique({
            where: { id },
            include: {
                blocks: {
                    orderBy: { position: 'asc' },
                },
            },
        });

        if (!currentReport) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const metadataPatch = body.metadata ?? {};
        const blockPatches = body.blocks ?? [];

        const nextReportState = {
            title: metadataPatch.title ?? currentReport.title,
            subtitle:
                metadataPatch.subtitle !== undefined
                    ? metadataPatch.subtitle
                    : currentReport.subtitle,
            client:
                metadataPatch.client !== undefined
                    ? metadataPatch.client
                    : currentReport.client,
            date:
                metadataPatch.date !== undefined
                    ? metadataPatch.date
                    : currentReport.date,
            titleFontSize:
                metadataPatch.titleFontSize !== undefined
                    ? metadataPatch.titleFontSize
                    : currentReport.titleFontSize,
            descriptionFontSize:
                metadataPatch.descriptionFontSize !== undefined
                    ? metadataPatch.descriptionFontSize
                    : currentReport.descriptionFontSize,
            captionFontSize:
                metadataPatch.captionFontSize !== undefined
                    ? metadataPatch.captionFontSize
                    : currentReport.captionFontSize,
        };

        const nextBlocks = currentReport.blocks.map((block) => {
            const patch = blockPatches.find((item) => item.id === block.id);
            if (!patch) return block;
            return {
                ...block,
                data: patch.data !== undefined ? patch.data : block.data,
                position:
                    patch.position !== undefined ? patch.position : block.position,
            };
        });

        const payload = buildDraftPayload(
            nextReportState,
            nextBlocks as ReportBlockFromDB[]
        );
        const nextDraftHash = await computeDraftHash(payload);

        if (currentReport.draftHash && currentReport.draftHash === nextDraftHash) {
            return new NextResponse(null, { status: 204 });
        }

        const updateData: Prisma.ReportUpdateInput = {
            draftHash: nextDraftHash,
            draftUpdatedAt: new Date(),
            ...(metadataPatch.title !== undefined && { title: metadataPatch.title }),
            ...(metadataPatch.subtitle !== undefined && {
                subtitle: metadataPatch.subtitle,
            }),
            ...(metadataPatch.client !== undefined && { client: metadataPatch.client }),
            ...(metadataPatch.date !== undefined && { date: metadataPatch.date }),
            ...(metadataPatch.titleFontSize !== undefined && {
                titleFontSize: metadataPatch.titleFontSize,
            }),
            ...(metadataPatch.descriptionFontSize !== undefined && {
                descriptionFontSize: metadataPatch.descriptionFontSize,
            }),
            ...(metadataPatch.captionFontSize !== undefined && {
                captionFontSize: metadataPatch.captionFontSize,
            }),
        };

        if (
            metadataPatch.title !== undefined &&
            metadataPatch.title !== currentReport.title
        ) {
            const baseSlug = createSlug(metadataPatch.title);
            updateData.slug = await generateUniqueSlug(baseSlug, async (slug) => {
                const exists = await prisma.report.findUnique({
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

        const syncedBlockIds: string[] = [];

        await prisma.$transaction(async (tx) => {
            await tx.report.update({
                where: { id },
                data: updateData,
            });

            for (const patch of blockPatches) {
                const existingBlock = currentReport.blocks.find(
                    (block) => block.id === patch.id
                );
                if (!existingBlock) continue;

                const blockUpdate: Prisma.ReportBlockUpdateInput = {};
                if (patch.data !== undefined) {
                    blockUpdate.data = patch.data as Prisma.InputJsonValue;
                }
                if (patch.position !== undefined) {
                    blockUpdate.position = patch.position;
                }

                if (Object.keys(blockUpdate).length === 0) continue;

                await tx.reportBlock.update({
                    where: { id: patch.id },
                    data: {
                        ...blockUpdate,
                        version: { increment: 1 },
                    },
                });
                syncedBlockIds.push(patch.id);
            }
        });

        const draftUpdatedAt = new Date().toISOString();

        return NextResponse.json(
            {
                draftHash: nextDraftHash,
                draftUpdatedAt,
                syncedBlockIds,
            },
            { status: 200 }
        );
    } catch (error) {
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
