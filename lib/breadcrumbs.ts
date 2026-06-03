export type BreadcrumbItem = {
    label: string;
    href?: string;
};

export type GroupAncestor = {
    id: string;
    name: string;
    path: string;
};

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

export const buildReportEditBreadcrumbs = (
    ancestors: GroupAncestor[],
    group: { name: string; path: string } | null | undefined,
    reportTitle: string,
    reportId: string
): BreadcrumbItem[] => {
    const items = buildReportViewBreadcrumbs(ancestors, group, reportTitle);
    const last = items[items.length - 1];
    if (last) {
        last.href = `/reports/${reportId}`;
        last.label = stripHtml(last.label) || 'Отчёт';
    }
    items.push({ label: 'Редактор' });
    return items;
};

export const buildReportViewBreadcrumbs = (
    ancestors: GroupAncestor[],
    group: { name: string; path: string } | null | undefined,
    reportTitle: string
): BreadcrumbItem[] => {
    if (!group) {
        return [{ label: stripHtml(reportTitle) || 'Отчёт' }];
    }

    const items = buildGroupBreadcrumbs(ancestors, group.name);
    const last = items[items.length - 1];
    if (last && !last.href) {
        last.href = `/${group.path}`;
    }
    items.push({ label: stripHtml(reportTitle) || 'Отчёт' });
    return items;
};

export const stripHtml = (html: string): string =>
    html.replace(/<[^>]*>/g, '').trim();
