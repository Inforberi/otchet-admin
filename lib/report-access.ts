import type { NextRequest } from 'next/server';

import type { AuthenticatedUser } from '@/lib/auth';
import { canManageUsers } from '@/lib/auth';

export type ReportAccessOptions = {
    showHidden?: boolean;
};

export type ReportVisibilityRow = {
    isHidden: boolean;
    createdByUserId: string | null;
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
