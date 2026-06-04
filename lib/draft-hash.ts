import type { ReportBlockFromDB, ReportFromDB } from '@/lib/db-types';

export type DraftMetadata = {
    title: string;
    subtitle: string | null;
    client: string | null;
    date: string | null;
    titleFontSize: string | null;
    descriptionFontSize: string | null;
    captionFontSize: string | null;
};

export type DraftPayload = {
    metadata: DraftMetadata;
    blocks: Array<{
        id: string;
        type: string;
        position: number;
        parentId?: string | null;
        data: unknown;
    }>;
};

export type DraftMetadataPatch = Partial<{
    title: string;
    subtitle: string | null;
    client: string | null;
    date: string | null;
    titleFontSize: string | null;
    descriptionFontSize: string | null;
    captionFontSize: string | null;
}>;

export const METADATA_FIELDS = [
    'title',
    'subtitle',
    'client',
    'date',
    'titleFontSize',
    'descriptionFontSize',
    'captionFontSize',
] as const;

export type MetadataField = (typeof METADATA_FIELDS)[number];

const sortValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }
    if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = sortValue((value as Record<string, unknown>)[key]);
                return acc;
            }, {});
    }
    return value;
};

export const canonicalDraftJson = (payload: DraftPayload): string =>
    JSON.stringify(sortValue(payload));

export const buildDraftPayload = (
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
): DraftPayload => ({
    metadata: {
        title: report.title,
        subtitle: report.subtitle ?? null,
        client: report.client ?? null,
        date: report.date ?? null,
        titleFontSize: report.titleFontSize ?? null,
        descriptionFontSize: report.descriptionFontSize ?? null,
        captionFontSize: report.captionFontSize ?? null,
    },
    blocks: [...blocks]
        .sort((a, b) => a.position - b.position)
        .map((block) => ({
            id: block.id,
            type: block.type,
            position: block.position,
            parentId: block.parentId ?? null,
            data: block.data,
        })),
});

export const computeDraftHash = async (payload: DraftPayload): Promise<string> => {
    const canonical = canonicalDraftJson(payload);

    if (typeof window !== 'undefined' && window.crypto?.subtle) {
        const buffer = await window.crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(canonical)
        );
        return Array.from(new Uint8Array(buffer))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    const { createHash } = await import('crypto');
    return createHash('sha256').update(canonical).digest('hex');
};

export const buildPublishedSnapshot = (
    report: ReportFromDB,
    blocks: ReportBlockFromDB[]
) => buildDraftPayload(report, blocks);
