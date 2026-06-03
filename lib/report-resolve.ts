import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth';
import { canAccessGroupId } from '@/lib/group-access';
import { getGroupAncestors, resolveGroupByPath } from '@/lib/group-service';
import {
    getReportPublicPath,
    getReportEditPublicPath,
    buildByPathReportApiUrl,
    joinGroupPathFromSegments,
    type ReportPublicPathInput,
} from '@/lib/report-paths';

export type { ReportPublicPathInput };
export {
    getReportPublicPath,
    getReportEditPublicPath,
    buildByPathReportApiUrl,
    joinGroupPathFromSegments,
};

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isReportUuid = (value: string): boolean => UUID_RE.test(value);

export type ReportPathParts = {
    groupPathSegments: string[];
    reportSlug: string;
};

const reportInclude = {
    group: {
        select: {
            id: true,
            name: true,
            path: true,
            parentId: true,
        },
    },
    blocks: {
        orderBy: { position: 'asc' as const },
    },
};

export const resolveReportByGroupPathAndSlug = async (
    groupPathSegments: string[],
    reportSlug: string,
    user: AuthenticatedUser | null
) => {
    const group = await resolveGroupByPath(groupPathSegments);
    if (!group) return null;

    if (user && !(await canAccessGroupId(user, group.id))) {
        return null;
    }

    const report = await prisma.report.findUnique({
        where: {
            groupId_slug: {
                groupId: group.id,
                slug: reportSlug,
            },
        },
        include: reportInclude,
    });

    if (!report) return null;

    const ancestors = group.parentId
        ? await getGroupAncestors(group.parentId)
        : [];

    return { report, ancestors, group };
};

/** Legacy URL `/reports/:slug` без группы в пути */
export const resolveReportBySlug = async (
    slug: string,
    user: AuthenticatedUser | null
) => {
    const reports = await prisma.report.findMany({
        where: { slug },
        include: reportInclude,
    });

    if (reports.length === 0) return null;

    for (const report of reports) {
        if (user && !(await canAccessGroupId(user, report.groupId))) {
            continue;
        }
        const ancestors = report.group?.parentId
            ? await getGroupAncestors(report.group.parentId)
            : [];
        return { report, ancestors };
    }

    return null;
};

export const resolveReportById = async (
    id: string,
    user: AuthenticatedUser | null
) => {
    const report = await prisma.report.findUnique({
        where: { id },
        include: reportInclude,
    });

    if (!report) return null;

    if (user && !(await canAccessGroupId(user, report.groupId))) {
        return null;
    }

    const ancestors = report.group?.parentId
        ? await getGroupAncestors(report.group.parentId)
        : [];

    return { report, ancestors };
};
