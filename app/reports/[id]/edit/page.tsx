import { notFound, permanentRedirect } from 'next/navigation';
import {
    getReportEditPublicPath,
    isReportUuid,
    resolveReportById,
    resolveReportBySlug,
} from '@/lib/report-resolve';
import { getCurrentUserFromSession } from '@/lib/auth';

export default async function LegacyReportEditRedirect({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await getCurrentUserFromSession();

    const resolved = isReportUuid(id)
        ? await resolveReportById(id, user)
        : await resolveReportBySlug(id, user);

    if (!resolved?.report.group || !resolved.report.slug) {
        notFound();
    }

    permanentRedirect(getReportEditPublicPath(resolved.report));
}
