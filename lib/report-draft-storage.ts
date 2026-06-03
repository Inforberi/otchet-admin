import type { DraftMetadata } from '@/lib/draft-hash';
import type { ReportBlockFromDB, ReportFromDB } from '@/lib/db-types';

const STORAGE_KEY_PREFIX = 'report-editor-draft:';

export type StoredDraftBlock = {
    id: string;
    type: ReportBlockFromDB['type'];
    position: number;
    data: ReportBlockFromDB['data'];
};

export type StoredDraftSnapshot = {
    reportId: string;
    baseVersion: number;
    savedAt: string;
    report: DraftMetadata;
    blocks: StoredDraftBlock[];
};

const getStorageKey = (reportId: string): string =>
    `${STORAGE_KEY_PREFIX}${reportId}`;

const isBrowser = (): boolean => typeof window !== 'undefined';

const toDraftMetadata = (
    report: Pick<
        ReportFromDB,
        | 'title'
        | 'subtitle'
        | 'client'
        | 'date'
        | 'titleFontSize'
        | 'descriptionFontSize'
        | 'captionFontSize'
    >
): DraftMetadata => ({
    title: report.title,
    subtitle: report.subtitle ?? null,
    client: report.client ?? null,
    date: report.date ?? null,
    titleFontSize: report.titleFontSize ?? null,
    descriptionFontSize: report.descriptionFontSize ?? null,
    captionFontSize: report.captionFontSize ?? null,
});

export const buildStoredDraftSnapshot = (
    reportId: string,
    baseVersion: number,
    report: Pick<
        ReportFromDB,
        | 'title'
        | 'subtitle'
        | 'client'
        | 'date'
        | 'titleFontSize'
        | 'descriptionFontSize'
        | 'captionFontSize'
    >,
    blocks: ReportBlockFromDB[]
): StoredDraftSnapshot => ({
    reportId,
    baseVersion,
    savedAt: new Date().toISOString(),
    report: toDraftMetadata(report),
    blocks: [...blocks]
        .sort((a, b) => a.position - b.position)
        .map((block) => ({
            id: block.id,
            type: block.type,
            position: block.position,
            data: block.data,
        })),
});

export const saveStoredDraftSnapshot = (
    snapshot: StoredDraftSnapshot
): { ok: true } | { ok: false; error: Error } => {
    if (!isBrowser()) return { ok: true };

    try {
        window.localStorage.setItem(
            getStorageKey(snapshot.reportId),
            JSON.stringify(snapshot)
        );
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error : new Error('Failed to save draft'),
        };
    }
};

export const loadStoredDraftSnapshot = (
    reportId: string
): StoredDraftSnapshot | null => {
    if (!isBrowser()) return null;

    try {
        const raw = window.localStorage.getItem(getStorageKey(reportId));
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<StoredDraftSnapshot>;
        if (
            parsed.reportId !== reportId ||
            typeof parsed.baseVersion !== 'number' ||
            !parsed.report ||
            !Array.isArray(parsed.blocks)
        ) {
            return null;
        }

        return {
            reportId,
            baseVersion: parsed.baseVersion,
            savedAt:
                typeof parsed.savedAt === 'string'
                    ? parsed.savedAt
                    : new Date().toISOString(),
            report: {
                title: parsed.report.title ?? '',
                subtitle: parsed.report.subtitle ?? null,
                client: parsed.report.client ?? null,
                date: parsed.report.date ?? null,
                titleFontSize: parsed.report.titleFontSize ?? null,
                descriptionFontSize: parsed.report.descriptionFontSize ?? null,
                captionFontSize: parsed.report.captionFontSize ?? null,
            },
            blocks: parsed.blocks.map((block, index) => ({
                id: typeof block?.id === 'string' ? block.id : `invalid-${index}`,
                type:
                    block?.type === 'divider' ||
                    block?.type === 'screenshot' ||
                    block?.type === 'text'
                        ? block.type
                        : 'text',
                position:
                    typeof block?.position === 'number' ? block.position : index,
                data: block?.data as ReportBlockFromDB['data'],
            })),
        };
    } catch {
        return null;
    }
};

export const clearStoredDraftSnapshot = (reportId: string): void => {
    if (!isBrowser()) return;
    window.localStorage.removeItem(getStorageKey(reportId));
};

export const applyStoredDraftSnapshot = (
    report: ReportFromDB,
    blocks: ReportBlockFromDB[],
    snapshot: StoredDraftSnapshot
): { report: ReportFromDB; blocks: ReportBlockFromDB[] } => {
    const blocksById = new Map(blocks.map((block) => [block.id, block]));
    const savedAt = new Date(snapshot.savedAt);

    return {
        report: {
            ...report,
            ...snapshot.report,
        },
        blocks: snapshot.blocks
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((block) => {
                const existing = blocksById.get(block.id);
                return {
                    id: block.id,
                    reportId: report.id,
                    type: block.type,
                    position: block.position,
                    data: block.data,
                    version: existing?.version ?? 1,
                    createdAt: existing?.createdAt ?? savedAt,
                    updatedAt: existing?.updatedAt ?? savedAt,
                };
            }),
    };
};
