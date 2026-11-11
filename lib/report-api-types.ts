import type { ApiBlock } from '@/lib/report-api';
import type { ImageData, ReportFromDB } from '@/lib/db-types';

export type { ApiBlockInput, AppendBlocksInput, CreateReportApiInput } from '@/lib/report-api';

export interface CompleteTaskApiInput {
    completedAt: string; // YYYY-MM-DD
    notes?: string;
    images?: ImageData[];
    layout?: 'full-width' | 'sidebar' | 'sidebar-reverse' | 'two-column';
}

/** JSON ответа API: даты сериализованы в ISO-строки. */
export type ApiReportBlock = ApiBlock & {
    id: string;
    reportId: string;
    position: number;
    version: number;
    createdAt: string;
    updatedAt: string;
    taskCompletedAt?: string | null;
    taskCompletedByUserId?: string | null;
    taskCompletionNotes?: string | null;
    taskCompletionImages?: ImageData[] | null;
    taskCompletionLayout?: string | null;
};

export type ApiReport = Omit<ReportFromDB,
    'createdAt' | 'updatedAt' | 'publishedAt' | 'draftUpdatedAt' | 'blocks'
> & {
    createdAt: string;
    updatedAt: string;
    publishedAt?: string | null;
    draftUpdatedAt?: string | null;
    blocks?: ApiReportBlock[];
};

export interface UploadApiResponse {
    upload: {
        id: string;
        reportId: string | null;
        groupId: string;
        filename: string;
        path: string;
        mimeType: string;
        size: number;
        createdAt: string;
    };
    url: string;
    /** Можно сразу передать элементом data.images. */
    image: ImageData;
}

export interface AppendBlocksResponse {
    blocks: ApiReportBlock[];
    reportVersion: number;
}

export interface ApiError {
    error: string;
    code?: string;
    issues?: { path: string; message: string }[];
}
