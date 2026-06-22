import { NextRequest, NextResponse } from 'next/server';
import { getGroupAncestors, resolveGroupByPath } from '@/lib/group-service';
import { getRequestUser } from '@/lib/auth-helpers';
import {
    canAccessGroupId,
    getGroupAccessOptionsFromRequest,
} from '@/lib/group-access';
import { GROUP_REPORTS_SEGMENT } from '@/lib/group-utils';
import { jsonReportGetResponse } from '@/lib/report-get-response';
import { resolveReportByGroupPathAndSlug } from '@/lib/report-resolve';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path } = await params;

        // If path ends with reports/{slug}, serve as report-by-path
        const reportsIdx = path.lastIndexOf(GROUP_REPORTS_SEGMENT);
        if (reportsIdx !== -1 && reportsIdx === path.length - 2) {
            const groupSegments = path.slice(0, reportsIdx);
            const reportSlug = path[reportsIdx + 1];
            const user = await getRequestUser(request);
            const view = request.nextUrl.searchParams.get('view');
            const accessOptions = getGroupAccessOptionsFromRequest(request);

            const resolved = await resolveReportByGroupPathAndSlug(
                groupSegments,
                reportSlug,
                user,
                accessOptions
            );

            if (!resolved) {
                return NextResponse.json(
                    { error: 'Report not found' },
                    { status: 404 }
                );
            }

            return jsonReportGetResponse(
                resolved.report,
                resolved.ancestors,
                user,
                view
            );
        }

        // Otherwise serve as group-by-path
        const group = await resolveGroupByPath(path);

        if (!group) {
            return NextResponse.json(
                { error: 'Group not found' },
                { status: 404 }
            );
        }

        const user = await getRequestUser(request);
        const accessOptions = getGroupAccessOptionsFromRequest(request);

        if (user && !(await canAccessGroupId(user, group.id, accessOptions))) {
            return NextResponse.json(
                { error: 'Group not found' },
                { status: 404 }
            );
        }

        const ancestors = await getGroupAncestors(group.parentId);

        return NextResponse.json({ group, ancestors }, { status: 200 });
    } catch (error) {
        console.error('Error resolving by path:', error);
        return NextResponse.json(
            { error: 'Failed to resolve' },
            { status: 500 }
        );
    }
}
