import { getReportPublicPath, getReportEditPublicPath, type ReportPublicPathInput } from '@/lib/report-paths';

export type BreadcrumbItem = {
    label: string;
    href?: string;
};

export type GroupAncestor = {
    id: string;
    name: string;
    path: string;
};

export type ReportBreadcrumbPath = ReportPublicPathInput;

export const ROOT_GROUPS_CRUMB: BreadcrumbItem = {
    label: 'Группы',
    href: '/',
};

export const buildGroupBreadcrumbs = (
    ancestors: GroupAncestor[],
    currentLabel: string
): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [ROOT_GROUPS_CRUMB];

    ancestors.forEach((ancestor) => {
        items.push({
            label: ancestor.name,
            href: `/${ancestor.path}`,
        });
    });

    items.push({ label: currentLabel });
    return items;
};

export const buildReportViewBreadcrumbs = (
    ancestors: GroupAncestor[],
    group: { name: string; path: string } | null | undefined,
    reportTitle: string,
    reportPath?: ReportBreadcrumbPath | null
): BreadcrumbItem[] => {
    if (!group) {
        return [{ label: stripHtml(reportTitle) || 'Отчёт' }];
    }

    const items = buildGroupBreadcrumbs(ancestors, group.name);
    const last = items[items.length - 1];
    if (last && !last.href) {
        last.href = `/${group.path}`;
    }

    const href = reportPath ? getReportPublicPath(reportPath) : undefined;
    items.push({ label: stripHtml(reportTitle) || 'Отчёт', href });
    return items;
};

export const buildReportEditBreadcrumbs = (
    ancestors: GroupAncestor[],
    group: { name: string; path: string } | null | undefined,
    reportTitle: string,
    reportPath?: ReportBreadcrumbPath | null
): BreadcrumbItem[] => {
    const items = buildReportViewBreadcrumbs(ancestors, group, reportTitle, reportPath);
    const last = items[items.length - 1];
    if (last) {
        if (reportPath) {
            last.href = getReportPublicPath(reportPath);
        }
        last.label = stripHtml(last.label) || 'Отчёт';
    }
    const editHref = reportPath ? getReportEditPublicPath(reportPath) : undefined;
    items.push({ label: 'Редактор', href: editHref });
    return items;
};

export const stripHtml = (html: string): string =>
    html.replace(/<[^>]*>/g, '').trim();
