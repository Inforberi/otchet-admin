import type { ImageData, ReportBlockFromDB, TaskBlockData } from '@/lib/db-types';
import { preferRichTextWithMoreSpacers } from '@/lib/rich-text';

const preferLongerImages = (
    prev: ImageData[] | null | undefined,
    server: ImageData[] | null | undefined
): ImageData[] | null | undefined => {
    const prevLen = prev?.length ?? 0;
    const serverLen = server?.length ?? 0;
    if (prevLen > serverLen) return prev ?? null;
    return server ?? null;
};

const completionTimeEqual = (
    a: Date | string | null | undefined,
    b: Date | string | null | undefined
): boolean => String(a ?? '') === String(b ?? '');

/** После save: не терять локальные completion/spacers, если сервер вернул урезанные данные. */
export const mergeTaskBlockAfterSave = (
    prev: ReportBlockFromDB,
    server: ReportBlockFromDB
): ReportBlockFromDB => {
    if (prev.type !== 'task' || server.type !== 'task') return server;

    const prevData = prev.data as TaskBlockData;
    const serverData = server.data as TaskBlockData;

    const mergedData: TaskBlockData = {
        ...serverData,
        description:
            preferRichTextWithMoreSpacers(
                prevData.description,
                serverData.description
            ) ?? serverData.description,
        images:
            preferLongerImages(prevData.images, serverData.images) ??
            serverData.images,
    };

    let merged: ReportBlockFromDB = {
        ...server,
        data: mergedData,
        taskCompletionNotes:
            preferRichTextWithMoreSpacers(
                prev.taskCompletionNotes,
                server.taskCompletionNotes
            ) ?? server.taskCompletionNotes,
        taskCompletionImages: preferLongerImages(
            prev.taskCompletionImages as ImageData[] | null | undefined,
            server.taskCompletionImages as ImageData[] | null | undefined
        ),
    };

    const prevCompleted = Boolean(prev.taskCompletedAt);
    const serverCompleted = Boolean(server.taskCompletedAt);

    if (prevCompleted && !serverCompleted) {
        merged = {
            ...merged,
            taskCompletedAt: prev.taskCompletedAt,
            taskCompletedByUserId: prev.taskCompletedByUserId,
            taskCompletionNotes:
                prev.taskCompletionNotes ?? merged.taskCompletionNotes,
            taskCompletionImages:
                prev.taskCompletionImages ?? merged.taskCompletionImages,
            taskCompletionLayout:
                prev.taskCompletionLayout ?? merged.taskCompletionLayout,
        };
    } else if (
        prevCompleted &&
        serverCompleted &&
        completionTimeEqual(prev.taskCompletedAt, server.taskCompletedAt)
    ) {
        merged = {
            ...merged,
            taskCompletionImages: preferLongerImages(
                prev.taskCompletionImages as ImageData[] | null | undefined,
                server.taskCompletionImages as ImageData[] | null | undefined
            ),
        };
    }

    return merged;
};
