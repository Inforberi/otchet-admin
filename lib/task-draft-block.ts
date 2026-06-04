import type { Prisma } from '@prisma/client';
import type { ImageData, PhotoBlockLayout, TaskBlockData } from '@/lib/db-types';
import { sanitizeRichTextHtml } from '@/lib/rich-text-sanitize';

const VALID_LAYOUTS: PhotoBlockLayout[] = [
    'full-width',
    'two-column',
    'sidebar',
    'sidebar-reverse',
];

export type TaskDraftBlockSnapshot = {
    type: string;
    data: unknown;
    taskCompletedAt?: string | null;
    taskCompletedByUserId?: string | null;
    taskCompletionNotes?: string | null;
    taskCompletionImages?: ImageData[] | null;
    taskCompletionLayout?: string | null;
};

export const parseTaskCompletedAt = (value: unknown): Date | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const d = new Date(`${value}T12:00:00`);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    return null;
};

const parseLayout = (value: unknown): PhotoBlockLayout | null => {
    if (typeof value !== 'string') return null;
    return VALID_LAYOUTS.includes(value as PhotoBlockLayout)
        ? (value as PhotoBlockLayout)
        : null;
};

const completionTimesEqual = (
    a: Date | null | undefined,
    b: Date | null | undefined
): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.getTime() === b.getTime();
};

export const sanitizeTaskDraftSnapshot = <T extends TaskDraftBlockSnapshot>(
    block: T
): T => ({
    ...block,
    taskCompletionNotes:
        block.taskCompletionNotes === null ||
        block.taskCompletionNotes === undefined
            ? null
            : sanitizeRichTextHtml(block.taskCompletionNotes),
});

export const buildTaskBlockPrismaData = (
    incoming: TaskDraftBlockSnapshot,
    existing: {
        taskCompletedAt: Date | null;
        taskCompletedByUserId: string | null;
        taskCompletionNotes: string | null;
        taskCompletionImages: unknown;
        taskCompletionLayout: string | null;
    } | null,
    editorUserId: string | null
): Prisma.ReportBlockUpdateInput => {
    const incomingAt = parseTaskCompletedAt(incoming.taskCompletedAt);
    const existingAt = existing?.taskCompletedAt ?? null;
    const notes =
        incoming.taskCompletionNotes === undefined
            ? existing?.taskCompletionNotes ?? null
            : incoming.taskCompletionNotes
              ? sanitizeRichTextHtml(incoming.taskCompletionNotes)
              : null;
    const images =
        incoming.taskCompletionImages === undefined
            ? (existing?.taskCompletionImages as ImageData[] | null) ?? null
            : incoming.taskCompletionImages?.length
              ? incoming.taskCompletionImages
              : null;
    const layout =
        parseLayout(incoming.taskCompletionLayout) ??
        parseLayout(existing?.taskCompletionLayout) ??
        'full-width';

    const wasCompleted = Boolean(existingAt);
    const isCompleted = Boolean(incomingAt);

    if (isCompleted && !incomingAt) {
        throw new Error('TASK_COMPLETED_AT_REQUIRED');
    }

    if (!wasCompleted && isCompleted) {
        return {
            taskCompletedAt: incomingAt,
            taskCompletedByUserId: editorUserId,
            taskCompletionNotes: notes,
            taskCompletionLayout: layout,
            taskCompletionImages: (images ?? null) as unknown as Prisma.InputJsonValue,
        };
    }

    if (wasCompleted && !isCompleted) {
        return {
            taskCompletedAt: null,
            taskCompletedByUserId: null,
            taskCompletionNotes: notes,
            taskCompletionLayout: layout,
            taskCompletionImages: (images ?? null) as unknown as Prisma.InputJsonValue,
        };
    }

    if (isCompleted) {
        return {
            taskCompletedAt: incomingAt,
            taskCompletedByUserId:
                incoming.taskCompletedByUserId ??
                existing?.taskCompletedByUserId ??
                editorUserId,
            taskCompletionNotes: notes,
            taskCompletionLayout: layout,
            taskCompletionImages: (images ?? null) as unknown as Prisma.InputJsonValue,
        };
    }

    return {
        taskCompletedAt: null,
        taskCompletedByUserId: null,
        taskCompletionNotes: notes,
        taskCompletionLayout: layout,
        taskCompletionImages: (images ?? null) as unknown as Prisma.InputJsonValue,
    };
};

export const taskCompletionStatusChanged = (
    incoming: TaskDraftBlockSnapshot,
    existing: { taskCompletedAt: Date | null } | null
): boolean => {
    const incomingAt = parseTaskCompletedAt(incoming.taskCompletedAt);
    const existingAt = existing?.taskCompletedAt ?? null;
    return !completionTimesEqual(incomingAt, existingAt);
};

export const getTaskAssigneesFromData = (data: unknown): TaskBlockData['assignees'] => {
    const taskData = data as TaskBlockData;
    return taskData?.assignees ?? [];
};
