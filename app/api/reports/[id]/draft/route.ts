import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    buildDraftPayload,
    computeDraftHash,
    type DraftMetadata,
} from '@/lib/draft-hash';
import type { ReportBlockFromDB } from '@/lib/db-types';
import { Prisma } from '@prisma/client';
import {
    getRequestUser,
    isViewerRole,
    requireEditorMiddleware,
} from '@/lib/auth-helpers';
import { createSlug, generateUniqueSlug } from '@/lib/slug';
import { sanitizeRichTextHtml } from '@/lib/rich-text-sanitize';
import { canEditContent } from '@/lib/auth';
import { canUserActOnTask, normalizeTaskAssignees } from '@/lib/task-assignees';
import {
    buildTaskBlockPrismaData,
    sanitizeTaskDraftSnapshot,
    taskCompletionStatusChanged,
} from '@/lib/task-draft-block';
import type { ImageData, TaskBlockData } from '@/lib/db-types';

const VERSION_CONFLICT = 'VERSION_CONFLICT';

type DraftBlockSnapshot = {
    id?: string;
    type: 'text' | 'screenshot' | 'divider' | 'task' | 'section';
    position: number;
    parentId?: string | null;
    data: ReportBlockFromDB['data'];
    taskCompletedAt?: string | null;
    taskCompletedByUserId?: string | null;
    taskCompletionNotes?: string | null;
    taskCompletionImages?: ImageData[] | null;
    taskCompletionLayout?: string | null;
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
    contentHeadingFontSize: true,
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

const sanitizeDraftMetadata = (report: DraftMetadata): DraftMetadata => ({
    title: sanitizeRichTextHtml(report.title),
    subtitle:
        report.subtitle === null
            ? null
            : sanitizeRichTextHtml(report.subtitle),
    client: report.client,
    date: report.date,
    titleFontSize: report.titleFontSize,
    descriptionFontSize: report.descriptionFontSize,
    contentHeadingFontSize: report.contentHeadingFontSize,
    captionFontSize: report.captionFontSize,
});

const sanitizeDraftBlocks = (
    blocks: DraftBlockSnapshot[]
): DraftBlockSnapshot[] =>
    blocks.map((block) => {
        if (block.type === 'text') {
            const data = block.data as Extract<
                ReportBlockFromDB['data'],
                { content: string }
            >;

            return {
                ...block,
                data: {
                    ...data,
                    title: sanitizeRichTextHtml(data.title ?? ''),
                    content: sanitizeRichTextHtml(data.content ?? ''),
                } as Extract<ReportBlockFromDB['data'], { content: string }>,
            };
        }

        if (block.type === 'screenshot') {
            const data = block.data as Extract<
                ReportBlockFromDB['data'],
                { images: unknown[] }
            >;

            return {
                ...block,
                data: {
                    ...data,
                    title: sanitizeRichTextHtml(data.title ?? ''),
                    description: sanitizeRichTextHtml(data.description ?? ''),
                } as Extract<ReportBlockFromDB['data'], { images: unknown[] }>,
            };
        }

        if (block.type === 'task') {
            const data = block.data as Extract<
                ReportBlockFromDB['data'],
                { createdAt: string }
            >;

            return sanitizeTaskDraftSnapshot({
                ...block,
                data: {
                    ...data,
                    title: sanitizeRichTextHtml(data.title ?? ''),
                    description: sanitizeRichTextHtml(data.description ?? ''),
                } as Extract<ReportBlockFromDB['data'], { createdAt: string }>,
            });
        }

        if (block.type === 'section') {
            const data = block.data as Extract<
                ReportBlockFromDB['data'],
                { title: string }
            >;

            return {
                ...block,
                data: {
                    ...data,
                    title: sanitizeRichTextHtml(data.title ?? ''),
                } as Extract<ReportBlockFromDB['data'], { title: string }>,
            };
        }

        return block;
    });

export const PATCH = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const adminCheck = await requireEditorMiddleware(request);
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

        const sanitizedReport = sanitizeDraftMetadata(body.report);
        const sortedBlocks = sanitizeDraftBlocks(body.blocks).sort(
            (a, b) => a.position - b.position
        );

        const requestUser = await getRequestUser(request);
        const isEditor = requestUser ? canEditContent(requestUser) : false;

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
                title: sanitizedReport.title ?? currentReport.title,
                subtitle:
                    sanitizedReport.subtitle !== undefined
                        ? sanitizedReport.subtitle
                        : currentReport.subtitle,
                client:
                    sanitizedReport.client !== undefined
                        ? sanitizedReport.client
                        : currentReport.client,
                date:
                    sanitizedReport.date !== undefined
                        ? sanitizedReport.date
                        : currentReport.date,
                titleFontSize:
                    sanitizedReport.titleFontSize !== undefined
                        ? sanitizedReport.titleFontSize
                        : currentReport.titleFontSize,
                descriptionFontSize:
                    sanitizedReport.descriptionFontSize !== undefined
                        ? sanitizedReport.descriptionFontSize
                        : currentReport.descriptionFontSize,
                contentHeadingFontSize:
                    sanitizedReport.contentHeadingFontSize !== undefined
                        ? sanitizedReport.contentHeadingFontSize
                        : currentReport.contentHeadingFontSize,
                captionFontSize:
                    sanitizedReport.captionFontSize !== undefined
                        ? sanitizedReport.captionFontSize
                        : currentReport.captionFontSize,
            };

            const nextBlocksForHash = sortedBlocks.map((block, index) => {
                const base = {
                    id: block.id ?? `generated-${index}`,
                    reportId: currentReport.id,
                    type: block.type,
                    position: index,
                    parentId: block.parentId ?? null,
                    data: block.data,
                    version: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                if (block.type !== 'task') return base as ReportBlockFromDB;

                return {
                    ...base,
                    taskCompletedAt: block.taskCompletedAt
                        ? new Date(block.taskCompletedAt)
                        : null,
                    taskCompletedByUserId: block.taskCompletedByUserId ?? null,
                    taskCompletionNotes: block.taskCompletionNotes ?? null,
                    taskCompletionImages: block.taskCompletionImages ?? null,
                    taskCompletionLayout: block.taskCompletionLayout ?? null,
                } as ReportBlockFromDB;
            });

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

                if (block.type === 'task') {
                    const assignees = normalizeTaskAssignees(
                        block.data as TaskBlockData
                    );
                    const canAct = requestUser
                        ? canUserActOnTask(
                              requestUser.id,
                              assignees,
                              isEditor
                          )
                        : false;

                    if (
                        existing &&
                        taskCompletionStatusChanged(block, existing) &&
                        !canAct
                    ) {
                        throw new Error('TASK_COMPLETION_FORBIDDEN');
                    }

                    const incomingAt = block.taskCompletedAt;
                    if (
                        incomingAt &&
                        !existing?.taskCompletedAt &&
                        !canAct
                    ) {
                        throw new Error('TASK_COMPLETION_FORBIDDEN');
                    }
                }

                const taskPrismaFields =
                    block.type === 'task'
                        ? buildTaskBlockPrismaData(
                              block,
                              existing
                                  ? {
                                        taskCompletedAt:
                                            existing.taskCompletedAt,
                                        taskCompletedByUserId:
                                            existing.taskCompletedByUserId,
                                        taskCompletionNotes:
                                            existing.taskCompletionNotes,
                                        taskCompletionImages:
                                            existing.taskCompletionImages,
                                        taskCompletionLayout:
                                            existing.taskCompletionLayout,
                                    }
                                  : null,
                              requestUser?.id ?? null
                          )
                        : {};

                if (existing) {
                    await tx.reportBlock.update({
                        where: { id: existing.id },
                        data: {
                            type: block.type,
                            parentId: block.parentId ?? null,
                            data: block.data as Prisma.InputJsonValue,
                            position: index,
                            version: {
                                increment: 1,
                            },
                            ...taskPrismaFields,
                        } as Prisma.ReportBlockUpdateInput,
                    });
                    continue;
                }

                const createData: Prisma.ReportBlockUncheckedCreateInput = {
                    id: block.id,
                    reportId: id,
                    type: block.type,
                    parentId: block.parentId ?? null,
                    position: index,
                    data: block.data as Prisma.InputJsonValue,
                };

                if (block.type === 'task') {
                    const tf = taskPrismaFields;
                    createData.taskCompletedAt =
                        (tf.taskCompletedAt as Date | null | undefined) ?? null;
                    createData.taskCompletedByUserId =
                        (tf.taskCompletedByUserId as string | null | undefined) ??
                        null;
                    createData.taskCompletionNotes =
                        (tf.taskCompletionNotes as string | null | undefined) ??
                        null;
                    createData.taskCompletionLayout =
                        (tf.taskCompletionLayout as string | null | undefined) ??
                        null;
                    if (tf.taskCompletionImages !== undefined) {
                        createData.taskCompletionImages =
                            tf.taskCompletionImages === null
                                ? Prisma.DbNull
                                : (tf.taskCompletionImages as Prisma.InputJsonValue);
                    }
                }

                await tx.reportBlock.create({ data: createData });
            }

            const updateData: Prisma.ReportUpdateInput = {
                title: nextReportState.title,
                subtitle: nextReportState.subtitle,
                client: nextReportState.client,
                date: nextReportState.date,
                titleFontSize: nextReportState.titleFontSize,
                descriptionFontSize: nextReportState.descriptionFontSize,
                contentHeadingFontSize: nextReportState.contentHeadingFontSize,
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

            if (error.message === 'TASK_COMPLETION_FORBIDDEN') {
                return NextResponse.json(
                    { error: 'Только исполнитель может изменить статус задачи.' },
                    { status: 403 }
                );
            }

            if (error.message === 'TASK_COMPLETED_AT_REQUIRED') {
                return NextResponse.json(
                    { error: 'Укажите дату закрытия.' },
                    { status: 400 }
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
    const user = await getRequestUser(request);
    if (!user || isViewerRole(user)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
