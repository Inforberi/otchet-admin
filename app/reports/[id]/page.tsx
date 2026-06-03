import { notFound, permanentRedirect } from 'next/navigation';
import {
    getReportPublicPath,
    isReportUuid,
    resolveReportById,
    resolveReportBySlug,
} from '@/lib/report-resolve';

export default async function LegacyReportViewRedirect({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const resolved = isReportUuid(id)
        ? await resolveReportById(id, null)
        : await resolveReportBySlug(id, null);

    if (!resolved?.report.group || !resolved.report.slug) {
        notFound();
    }

    permanentRedirect(getReportPublicPath(resolved.report));
}
