import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth';
import { canManageUsers } from '@/lib/auth';
import {
    canAccessGroupId,
    type GroupAccessOptions,
} from '@/lib/group-access';

export type ReportAccessOptions = {
    showHidden?: boolean;
};

export type ReportVisibilityRow = {
    isHidden: boolean;
    createdByUserId: string | null;
};

export type ReportAccessRow = ReportVisibilityRow & {
    groupId: string;
};

export const getReportAccessOptionsFromRequest = (
    request: NextRequest
): ReportAccessOptions => ({
    showHidden: request.nextUrl.searchParams.get('showHidden') === '1',
});

export const isReportVisible = (
    report: ReportVisibilityRow,
    user: AuthenticatedUser | null,
    options?: ReportAccessOptions
): boolean => {
    if (!report.isHidden) return true;
    if (!user) return false;
    if (report.createdByUserId === user.id) return true;
    if (canManageUsers(user) && options?.showHidden) return true;
    return false;
};

export const filterVisibleReports = <T extends ReportVisibilityRow>(
    reports: T[],
    user: AuthenticatedUser | null,
    options?: ReportAccessOptions
): T[] =>
    reports.filter((report) => isReportVisible(report, user, options));

export const canAccessReport = async (
    report: ReportAccessRow,
    user: AuthenticatedUser | null,
    options?: ReportAccessOptions & GroupAccessOptions
): Promise<boolean> => {
    if (!user) return false;
    if (!(await canAccessGroupId(user, report.groupId, options))) return false;
    return isReportVisible(report, user, options);
};

export const canAccessReportId = async (
    reportId: string,
    user: AuthenticatedUser | null,
    options?: ReportAccessOptions & GroupAccessOptions
): Promise<boolean> => {
    if (!user) return false;

    const report = await prisma.report.findUnique({
        where: { id: reportId },
        select: {
            groupId: true,
            isHidden: true,
            createdByUserId: true,
        },
    });

    if (!report) return false;
    return canAccessReport(report, user, options);
};
