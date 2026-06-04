'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    ReportBlockFromDB,
    ReportFromDB,
    DividerBlockData,
    SectionBlockData,
    ScreenshotBlockData,
    TextBlockData,
    TaskBlockData,
    ImageData,
    PhotoBlockLayout,
} from '@/lib/db-types';
import {
    applyStoredDraftSnapshot,
    buildStoredDraftSnapshot,
    clearStoredDraftSnapshot,
    loadStoredDraftSnapshot,
    saveStoredDraftSnapshot,
} from '@/lib/report-draft-storage';
import { reportBlocksSemanticallyEqual } from '@/lib/block-data-equal';
import { mergeTaskBlockAfterSave } from '@/lib/report-block-merge';
import { normalizeBlockOrder } from '@/lib/block-tree';
import { runDraftFlushHandlers } from '@/lib/report-draft-flush-registry';

export type SyncStatus =
    | 'synced'
    | 'local'
    | 'autosaving'
    | 'saving'
    | 'conflict'
    | 'error';

type BlockData =
    | TextBlockData
    | ScreenshotBlockData
    | DividerBlockData
    | TaskBlockData
    | SectionBlockData;
type FlushReason = 'manual' | 'autosave' | 'publish' | 'hidden';

type DraftSaveResponse = {
    report: ReportFromDB;
};

const LOCAL_STORAGE_DEBOUNCE_MS = 300;
const DEFAULT_AUTOSAVE_MS = 60_000;
const MIN_SAVING_DISPLAY_MS = 400;
const MIN_AUTOSAVING_DISPLAY_MS = 250;
const SAVING_INDICATOR_DELAY_MS = 150;

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const hasUnpublishedChanges = (report: ReportFromDB | null): boolean =>
    Boolean(
        report?.draftHash &&
            report?.publishedHash &&
            report.draftHash !== report.publishedHash
    );

const sortBlocks = (blocks: ReportBlockFromDB[]): ReportBlockFromDB[] =>
    [...blocks].sort((a, b) => a.position - b.position);

const serializeTaskCompletedAt = (
    value: Date | string | null | undefined
): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return value.toISOString();
};

export type TaskBlockDirtyPatch = {
    data?: TaskBlockData;
    taskCompletedAt?: Date | string | null;
    taskCompletedByUserId?: string | null;
    taskCompletionNotes?: string | null;
    taskCompletionImages?: ImageData[] | null;
    taskCompletionLayout?: PhotoBlockLayout | null;
};

const toDraftRequest = (
    report: ReportFromDB,
    blocks: ReportBlockFromDB[],
    expectedVersion: number
) => ({
    expectedVersion,
    report: {
        title: report.title,
        subtitle: report.subtitle ?? null,
        client: report.client ?? null,
        date: report.date ?? null,
        titleFontSize: report.titleFontSize ?? null,
        descriptionFontSize: report.descriptionFontSize ?? null,
        contentHeadingFontSize: report.contentHeadingFontSize ?? null,
        captionFontSize: report.captionFontSize ?? null,
    },
    blocks: sortBlocks(blocks).map((block) => {
        const base = {
            id: block.id,
            type: block.type,
            position: block.position,
            parentId: block.parentId ?? null,
            data: block.data,
        };

        if (block.type !== 'task') return base;

        return {
            ...base,
            taskCompletedAt: serializeTaskCompletedAt(block.taskCompletedAt),
            taskCompletedByUserId: block.taskCompletedByUserId ?? null,
            taskCompletionNotes: block.taskCompletionNotes ?? null,
            taskCompletionImages: block.taskCompletionImages ?? null,
            taskCompletionLayout: block.taskCompletionLayout ?? null,
        };
    }),
});

export const useReportDraftSync = (
    reportId: string,
    autosaveIntervalMs: number = DEFAULT_AUTOSAVE_MS
) => {
    const [report, setReport] = useState<ReportFromDB | null>(null);
    const [blocks, setBlocks] = useState<ReportBlockFromDB[]>([]);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [hasLocalChanges, setHasLocalChanges] = useState(false);
    const [isFlushInFlight, setIsFlushInFlight] = useState(false);
    const [showSavingIndicator, setShowSavingIndicator] = useState(false);

    const reportRef = useRef<ReportFromDB | null>(null);
    const blocksRef = useRef<ReportBlockFromDB[]>([]);
    const hasLocalChangesRef = useRef(false);
    const baseVersionRef = useRef<number | null>(null);
    const localSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flushPromiseRef = useRef<Promise<boolean> | null>(null);
    const pendingFlushReasonRef = useRef<FlushReason | null>(null);
    const flushRef = useRef<(options?: { reason?: FlushReason }) => Promise<boolean>>(
        async () => false
    );
    const autosaveIntervalMsRef = useRef(autosaveIntervalMs);

    reportRef.current = report;
    blocksRef.current = blocks;
    hasLocalChangesRef.current = hasLocalChanges;

    const clearLocalTimers = useCallback(() => {
        if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current);
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        localSaveTimerRef.current = null;
        autosaveTimerRef.current = null;
    }, []);

    const clearLocalDraft = useCallback(() => {
        clearStoredDraftSnapshot(reportId);
    }, [reportId]);

    const persistLocalSnapshot = useCallback(() => {
        const currentReport = reportRef.current;
        const currentBaseVersion = baseVersionRef.current;
        if (!currentReport || !hasLocalChangesRef.current || !currentBaseVersion) {
            return;
        }

        const result = saveStoredDraftSnapshot(
            buildStoredDraftSnapshot(
                reportId,
                currentBaseVersion,
                currentReport,
                blocksRef.current
            )
        );

        if (!result.ok) {
            setSyncStatus('error');
        }
    }, [hasLocalChanges, reportId]);

    const scheduleLocalPersistence = useCallback(() => {
        if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current);
        localSaveTimerRef.current = setTimeout(() => {
            persistLocalSnapshot();
        }, LOCAL_STORAGE_DEBOUNCE_MS);
    }, [persistLocalSnapshot]);

    const scheduleAutosave = useCallback(() => {
        const intervalMs = autosaveIntervalMsRef.current;
        if (intervalMs <= 0) return;
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
            void flushRef.current({ reason: 'autosave' });
        }, intervalMs);
    }, []);

    useEffect(() => {
        autosaveIntervalMsRef.current = autosaveIntervalMs;
        if (autosaveIntervalMs <= 0) {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
            return;
        }
        if (hasLocalChangesRef.current) {
            scheduleAutosave();
        }
    }, [autosaveIntervalMs, scheduleAutosave]);

    const rescheduleAutosave = useCallback(() => {
        if (autosaveIntervalMsRef.current <= 0 || !hasLocalChangesRef.current) return;
        scheduleAutosave();
    }, [scheduleAutosave]);

    const markDirty = useCallback(() => {
        setHasLocalChanges(true);
        setSyncStatus('local');
        scheduleLocalPersistence();
        scheduleAutosave();
    }, [scheduleAutosave, scheduleLocalPersistence]);

    const commitServerState = useCallback(
        (nextReport: ReportFromDB) => {
            const nextBlocks = sortBlocks(
                (nextReport.blocks || []) as ReportBlockFromDB[]
            );
            const prevBlocks = blocksRef.current;
            const hadLocalChanges = hasLocalChangesRef.current;
            const mergedBlocks = nextBlocks.map((block) => {
                const prev = prevBlocks.find((item) => item.id === block.id);
                if (!prev) return block;

                if (
                    hadLocalChanges &&
                    prev.type === 'task' &&
                    block.type === 'task'
                ) {
                    const merged = mergeTaskBlockAfterSave(prev, block);
                    if (reportBlocksSemanticallyEqual(prev, merged)) {
                        return prev;
                    }
                    return merged;
                }

                if (prev && reportBlocksSemanticallyEqual(prev, block)) {
                    return prev;
                }
                return block;
            });
            baseVersionRef.current = nextReport.version;
            reportRef.current = nextReport;
            blocksRef.current = mergedBlocks;
            setReport(nextReport);
            setBlocks(normalizeBlockOrder(mergedBlocks));
            setHasLocalChanges(false);
            setSyncStatus('synced');
            clearLocalDraft();
        },
        [clearLocalDraft]
    );

    const loadReport = useCallback(
        async (options?: { discardLocalDraft?: boolean }) => {
            setLoading(true);
            try {
                const response = await fetch(`/api/reports/${reportId}`);
                if (!response.ok) throw new Error('Failed to fetch report');

                const { report: reportData } = (await response.json()) as {
                    report: ReportFromDB;
                };

                const sortedBlocks = normalizeBlockOrder(
                    (reportData.blocks || []) as ReportBlockFromDB[]
                );
                baseVersionRef.current = reportData.version;

                if (options?.discardLocalDraft) {
                    clearLocalDraft();
                    setReport(reportData);
                    setBlocks(sortedBlocks);
                    setHasLocalChanges(false);
                    setSyncStatus('synced');
                    return { report: reportData, blocks: sortedBlocks };
                }

                const localSnapshot = loadStoredDraftSnapshot(reportId);
                if (localSnapshot && localSnapshot.baseVersion === reportData.version) {
                    const restored = applyStoredDraftSnapshot(
                        reportData,
                        sortedBlocks,
                        localSnapshot
                    );
                    const restoredBlocks = normalizeBlockOrder(restored.blocks);
                    blocksRef.current = restoredBlocks;
                    setReport(restored.report);
                    setBlocks(restoredBlocks);
                    setHasLocalChanges(true);
                    setSyncStatus('local');
                    scheduleAutosave();
                    return restored;
                }

                if (localSnapshot) {
                    clearLocalDraft();
                }

                setReport(reportData);
                setBlocks(sortedBlocks);
                setHasLocalChanges(false);
                setSyncStatus('synced');
                return { report: reportData, blocks: sortedBlocks };
            } catch (error) {
                console.error(error);
                setSyncStatus('error');
                return null;
            } finally {
                setLoading(false);
            }
        },
        [clearLocalDraft, reportId, scheduleAutosave]
    );

    const handleVersionConflict = useCallback(async () => {
        clearLocalDraft();
        clearLocalTimers();
        setHasLocalChanges(false);
        await loadReport({ discardLocalDraft: true });
        setSyncStatus('conflict');
    }, [clearLocalDraft, clearLocalTimers, loadReport]);

    const runFlush = useCallback(
        async (reason: FlushReason): Promise<boolean> => {
            const currentReport = reportRef.current;
            if (!currentReport) return false;

            if (!hasLocalChangesRef.current) {
                setSyncStatus('synced');
                return true;
            }

            runDraftFlushHandlers();

            const savingStarted = Date.now();
            setIsFlushInFlight(true);
            setSyncStatus(reason === 'autosave' ? 'autosaving' : 'saving');

            const indicatorTimer = setTimeout(() => {
                setShowSavingIndicator(true);
            }, SAVING_INDICATOR_DELAY_MS);

            try {
                const response = await fetch(`/api/reports/${reportId}/draft`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                        toDraftRequest(
                            currentReport,
                            blocksRef.current,
                            baseVersionRef.current ?? currentReport.version
                        )
                    ),
                });

                if (response.status === 409) {
                    await handleVersionConflict();
                    return false;
                }

                if (!response.ok) {
                    throw new Error('Failed to save draft');
                }

                const minMs =
                    reason === 'autosave'
                        ? MIN_AUTOSAVING_DISPLAY_MS
                        : MIN_SAVING_DISPLAY_MS;
                const elapsed = Date.now() - savingStarted;
                if (elapsed < minMs) {
                    await sleep(minMs - elapsed);
                }

                const data = (await response.json()) as DraftSaveResponse;
                commitServerState(data.report);
                return true;
            } catch (error) {
                console.error(error);
                setSyncStatus('error');
                return false;
            } finally {
                clearTimeout(indicatorTimer);
                setShowSavingIndicator(false);
                setIsFlushInFlight(false);
            }
        },
        [commitServerState, handleVersionConflict, reportId]
    );

    const flush = useCallback(
        async (options?: { reason?: FlushReason }) => {
            const reason = options?.reason ?? 'manual';

            if (flushPromiseRef.current) {
                pendingFlushReasonRef.current =
                    pendingFlushReasonRef.current === 'publish' ||
                    reason === 'publish'
                        ? 'publish'
                        : pendingFlushReasonRef.current === 'manual' ||
                            reason === 'manual'
                          ? 'manual'
                          : reason;

                const currentPromise = flushPromiseRef.current;
                const ok = await currentPromise;
                if (!ok) return false;
                return flush({ reason: pendingFlushReasonRef.current ?? reason });
            }

            pendingFlushReasonRef.current = null;

            const promise = runFlush(reason).finally(() => {
                flushPromiseRef.current = null;
            });
            flushPromiseRef.current = promise;

            const ok = await promise;
            if (!ok) return false;

            if (pendingFlushReasonRef.current) {
                const nextReason = pendingFlushReasonRef.current;
                pendingFlushReasonRef.current = null;
                return flush({ reason: nextReason });
            }

            return true;
        },
        [runFlush]
    );
    flushRef.current = flush;

    const replaceBlocksLocally = useCallback(
        (nextBlocks: ReportBlockFromDB[]) => {
            setBlocks(sortBlocks(normalizeBlockOrder(nextBlocks)));
            markDirty();
        },
        [markDirty]
    );

    const markBlockDirty = useCallback(
        (blockId: string, data: BlockData) => {
            const next = sortBlocks(
                blocksRef.current.map((block) =>
                    block.id === blockId ? { ...block, data } : block
                )
            );
            blocksRef.current = next;
            setBlocks(next);
            markDirty();
        },
        [markDirty]
    );

    const markTaskBlockDirty = useCallback(
        (blockId: string, patch: TaskBlockDirtyPatch) => {
            const next = sortBlocks(
                blocksRef.current.map((block) =>
                    block.id === blockId && block.type === 'task'
                        ? { ...block, ...patch }
                        : block
                )
            );
            blocksRef.current = next;
            setBlocks(next);
            markDirty();
        },
        [markDirty]
    );

    const markMetadataDirty = useCallback(
        (patch: Partial<
            Pick<
                ReportFromDB,
                | 'title'
                | 'subtitle'
                | 'client'
                | 'date'
                | 'titleFontSize'
                | 'descriptionFontSize'
                | 'contentHeadingFontSize'
                | 'captionFontSize'
            >
        >) => {
            setReport((prev) => (prev ? { ...prev, ...patch } : prev));
            markDirty();
        },
        [markDirty]
    );

    const publish = useCallback(async () => {
        const currentReport = reportRef.current;
        if (!currentReport) return false;

        setPublishing(true);
        try {
            const saved = await flush({ reason: 'publish' });
            if (!saved) return false;

            const versionToPublish =
                baseVersionRef.current ?? reportRef.current?.version;
            if (!versionToPublish) return false;

            const response = await fetch(`/api/reports/${reportId}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expectedVersion: versionToPublish }),
            });

            if (response.status === 409) {
                await handleVersionConflict();
                return false;
            }

            if (!response.ok) {
                throw new Error('Failed to publish');
            }

            const data = (await response.json()) as { report: ReportFromDB };
            commitServerState(data.report);
            return true;
        } catch (error) {
            console.error(error);
            setSyncStatus('error');
            return false;
        } finally {
            setPublishing(false);
        }
    }, [commitServerState, flush, handleVersionConflict, reportId]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden' && hasLocalChanges) {
                void flush({ reason: 'hidden' });
            }
        };

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (hasLocalChanges) {
                event.preventDefault();
                event.returnValue = '';
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearLocalTimers();
        };
    }, [clearLocalTimers, flush, hasLocalChanges]);

    useEffect(
        () => () => {
            clearLocalTimers();
        },
        [clearLocalTimers]
    );

    return {
        report,
        blocks,
        loading,
        syncStatus,
        isFlushInFlight,
        showSavingIndicator,
        publishing,
        hasLocalChanges,
        hasUnpublishedChanges: hasUnpublishedChanges(report) || hasLocalChanges,
        loadReport,
        markBlockDirty,
        markTaskBlockDirty,
        markMetadataDirty,
        replaceBlocksLocally,
        flush,
        publish,
        rescheduleAutosave,
        handleVersionConflict,
    };
};
