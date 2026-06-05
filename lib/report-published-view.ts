import type { Report, ReportBlock } from '@prisma/client';
import type { DraftPayloadBlock } from '@/lib/draft-hash';

type ReportWithBlocks = Report & {
    blocks: ReportBlock[];
};

type PublishedSnapshot = {
    metadata: {
        title: string;
        subtitle: string | null;
        client: string | null;
        date: string | null;
        titleFontSize: string | null;
        descriptionFontSize: string | null;
        contentHeadingFontSize: string | null;
        captionFontSize: string | null;
    };
    blocks: DraftPayloadBlock[];
};

const liveBlockById = (
    blocks: ReportBlock[],
    id: string
): ReportBlock | undefined => blocks.find((block) => block.id === id);

export const buildPublishedReportResponse = (report: ReportWithBlocks) => {
    const hasUnpublishedChanges =
        Boolean(report.draftHash) &&
        Boolean(report.publishedHash) &&
        report.draftHash !== report.publishedHash;

    if (!report.publishedSnapshot) {
        return null;
    }

    const snapshot = report.publishedSnapshot as PublishedSnapshot;

    const publishedReport = {
        ...report,
        title: snapshot.metadata.title,
        subtitle: snapshot.metadata.subtitle,
        client: snapshot.metadata.client,
        date: snapshot.metadata.date,
        titleFontSize: snapshot.metadata.titleFontSize,
        descriptionFontSize: snapshot.metadata.descriptionFontSize,
        contentHeadingFontSize: snapshot.metadata.contentHeadingFontSize,
        captionFontSize: snapshot.metadata.captionFontSize,
        blocks: snapshot.blocks.map((block) => {
            const live = liveBlockById(report.blocks, block.id);

            const base = {
                id: block.id,
                reportId: report.id,
                type: block.type,
                position: block.position,
                parentId: block.parentId ?? live?.parentId ?? null,
                data: block.data,
                version: live?.version ?? 1,
                createdAt: live?.createdAt ?? report.createdAt,
                updatedAt: live?.updatedAt ?? report.updatedAt,
            };

            if (block.type !== 'task') return base;

            return {
                ...base,
                taskCompletedAt:
                    block.taskCompletedAt != null
                        ? new Date(block.taskCompletedAt)
                        : live?.taskCompletedAt ?? null,
                taskCompletedByUserId: live?.taskCompletedByUserId ?? null,
                taskCompletionNotes:
                    block.taskCompletionNotes ?? live?.taskCompletionNotes ?? null,
                taskCompletionImages:
                    block.taskCompletionImages ?? live?.taskCompletionImages ?? null,
                taskCompletionLayout:
                    block.taskCompletionLayout ?? live?.taskCompletionLayout ?? null,
            };
        }),
    };

    const headers = report.publishedHash
        ? { ETag: `"${report.publishedHash}"` }
        : undefined;

    return {
        report: publishedReport,
        hasUnpublishedChanges,
        isPublishedView: true,
        headers,
    };
};
