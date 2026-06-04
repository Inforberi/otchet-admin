import type { Report, ReportBlock } from '@prisma/client';

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
    blocks: Array<{
        id: string;
        type: string;
        position: number;
        data: unknown;
    }>;
};

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
        blocks: snapshot.blocks.map((block) => ({
            id: block.id,
            reportId: report.id,
            type: block.type,
            position: block.position,
            data: block.data,
            version: 1,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
        })),
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
