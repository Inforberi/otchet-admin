import { GROUP_REPORTS_SEGMENT, joinGroupPath } from '@/lib/group-utils';

export type ReportPublicPathInput = {
    slug?: string | null;
    group?: { path: string } | null;
};

export const getReportPublicPath = (
    report: ReportPublicPathInput,
    fallbackSlug?: string
): string => {
    const slug = report.slug ?? fallbackSlug;
    if (!slug) return '/';

    const groupPath = report.group?.path ?? '';
    return groupPath
        ? `/${groupPath}/${GROUP_REPORTS_SEGMENT}/${slug}`
        : `/${GROUP_REPORTS_SEGMENT}/${slug}`;
};

export const getReportEditPublicPath = (
    report: ReportPublicPathInput,
    fallbackSlug?: string
): string => `${getReportPublicPath(report, fallbackSlug)}/edit`;

export const buildByPathReportApiUrl = (
    groupPath: string,
    reportSlug: string
): string => {
    const segments = groupPath ? groupPath.split('/').filter(Boolean) : [];
    const path = [...segments, GROUP_REPORTS_SEGMENT, reportSlug].join('/');
    return `/api/groups/by-path/${path}`;
};

export const joinGroupPathFromSegments = (segments: string[]): string =>
    joinGroupPath(segments);
