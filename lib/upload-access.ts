import type { NextRequest } from 'next/server';

import { getRequestUser } from '@/lib/auth-helpers';
import type { AuthenticatedUser } from '@/lib/auth';
import {
    canAccessGroupId,
    getGroupAccessOptionsFromRequest,
    type GroupAccessOptions,
} from '@/lib/group-access';
import {
    canAccessReport,
    getReportAccessOptionsFromRequest,
    type ReportAccessOptions,
} from '@/lib/report-access';
import { prisma } from '@/lib/prisma';

export type UploadAccessRow = {
    groupId: string;
    reportId: string | null;
};

export const getUploadAccessOptionsFromRequest = (
    request: NextRequest
): GroupAccessOptions & ReportAccessOptions => ({
    ...getGroupAccessOptionsFromRequest(request),
    ...getReportAccessOptionsFromRequest(request),
});

export const canAccessUpload = async (
    upload: UploadAccessRow,
    user: AuthenticatedUser | null,
    options?: GroupAccessOptions & ReportAccessOptions
): Promise<boolean> => {
    if (!user) return false;

    if (!upload.reportId) {
        return canAccessGroupId(user, upload.groupId, options);
    }

    const report = await prisma.report.findUnique({
        where: { id: upload.reportId },
        select: {
            groupId: true,
            isHidden: true,
            createdByUserId: true,
        },
    });

    if (!report) return false;
    return canAccessReport(report, user, options);
};

export const canAccessUploadFromRequest = async (
    request: NextRequest,
    upload: UploadAccessRow
): Promise<boolean> => {
    const user = await getRequestUser(request);
    return canAccessUpload(upload, user, getUploadAccessOptionsFromRequest(request));
};
