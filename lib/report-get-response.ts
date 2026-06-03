import { NextResponse } from 'next/server';
import type { Report, ReportBlock } from '@prisma/client';
import type { AuthenticatedUser } from '@/lib/auth';
import { canEditContent } from '@/lib/auth';
import { isViewerRole } from '@/lib/auth-helpers';
import { buildPublishedReportResponse } from '@/lib/report-published-view';
import type { GroupAncestor } from '@/lib/breadcrumbs';

type ReportWithRelations = Report & {
    blocks: ReportBlock[];
    group: {
        id: string;
        name: string;
        path: string;
        parentId: string | null;
    };
};

export const jsonReportGetResponse = (
    report: ReportWithRelations,
    ancestors: GroupAncestor[],
    user: AuthenticatedUser | null,
    view: string | null
) => {
    const forcePublished = user ? isViewerRole(user) : false;
    const usePublishedView = forcePublished || view === 'published';

    if (usePublishedView) {
        const published = buildPublishedReportResponse(report);
        if (!published) {
            if (user && canEditContent(user)) {
                const hasUnpublishedChanges =
                    Boolean(report.draftHash) &&
                    Boolean(report.publishedHash) &&
                    report.draftHash !== report.publishedHash;

                return NextResponse.json(
                    {
                        report,
                        ancestors,
                        hasUnpublishedChanges,
                        isPublishedView: false,
                    },
                    { status: 200 }
                );
            }

            return NextResponse.json(
                { error: 'Report not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                report: published.report,
                ancestors,
                hasUnpublishedChanges: published.hasUnpublishedChanges,
                isPublishedView: published.isPublishedView,
            },
            { status: 200, headers: published.headers }
        );
    }

    const hasUnpublishedChanges =
        Boolean(report.draftHash) &&
        Boolean(report.publishedHash) &&
        report.draftHash !== report.publishedHash;

    return NextResponse.json(
        { report, ancestors, hasUnpublishedChanges, isPublishedView: false },
        { status: 200 }
    );
};
