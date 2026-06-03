'use client';

import { useParams } from 'next/navigation';
import { GROUP_REPORTS_SEGMENT } from '@/lib/group-utils';
import GroupPage from '@/components/pages/group-page';
import ReportViewPage from '@/components/pages/report-view-page';
import ReportEditPage from '@/components/pages/report-edit-page';

export default function CatchAllPage() {
    const params = useParams();
    const rawPath = params.path;
    const segments: string[] = Array.isArray(rawPath)
        ? rawPath
        : rawPath
          ? [rawPath]
          : [];

    const reportsIdx = segments.lastIndexOf(GROUP_REPORTS_SEGMENT);

    if (reportsIdx !== -1) {
        const groupPath = segments.slice(0, reportsIdx);
        const reportSlug = segments[reportsIdx + 1] ?? '';
        const isEdit = segments[reportsIdx + 2] === 'edit';

        if (isEdit) {
            return <ReportEditPage groupPath={groupPath} reportSlug={reportSlug} />;
        }
        return <ReportViewPage groupPath={groupPath} reportSlug={reportSlug} />;
    }

    return <GroupPage groupPath={segments} />;
}
