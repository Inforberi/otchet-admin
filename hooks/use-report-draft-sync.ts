'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    ReportBlockFromDB,
    ReportFromDB,
    DividerBlockData,
    ScreenshotBlockData,
    TextBlockData,
    TaskBlockData,
} from '@/lib/db-types';
import {
    applyStoredDraftSnapshot,
    buildStoredDraftSnapshot,
    clearStoredDraftSnapshot,
    loadStoredDraftSnapshot,
    saveStoredDraftSnapshot,
} from '@/lib/report-draft-storage';

export type SyncStatus =
    | 'synced'
    | 'local'
    | 'autosaving'
    | 'saving'
    | 'conflict'
    | 'error';

type BlockData = TextBlockData | ScreenshotBlockData | DividerBlockData | TaskBlockData;
type FlushReason = 'manual' | 'autosave' | 'publish' | 'hidden';

type DraftSaveResponse = {
    report: ReportFromDB;
};

const LOCAL_STORAGE_DEBOUNCE_MS = 300;
const AUTOSAVE_MS = 45_000;

const hasUnpublishedChanges = (report: ReportFromDB | null): boolean =>
    Boolean(
        report?.draftHash &&
            report?.publishedHash &&
            report.draftHash !== report.publishedHash
    );

const sortBlocks = (blocks: ReportBlockFromDB[]): ReportBlockFromDB[] =>
    [...blocks].sort((a, b) => a.position - b.position);

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
        captionFontSize: report.captionFontSize ?? null,
    },
    blocks: sortBlocks(blocks).map((block) => ({
        id: block.id,
        type: block.type,
        position: block.position,
        data: block.data,
    })),
});

export const useReportDraftSync = (reportId: string) => {
    const [report, setReport] = useState<ReportFromDB | null>(null);
    const [blocks, setBlocks] = useState<ReportBlockFromDB[]>([]);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [hasLocalChanges, setHasLocalChanges] = useState(false);

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
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
            void flushRef.current({ reason: 'autosave' });
        }, AUTOSAVE_MS);
    }, []);

    const markDirty = useCallback(() => {
        setHasLocalChanges(true);
        setSyncStatus('local');
        scheduleLocalPersistence();
        scheduleAutosave();
    }, [scheduleAutosave, scheduleLocalPersistence]);

    const commitServerState = useCallback(
        (nextReport: ReportFromDB) => {
            const nextBlocks = sortBlocks((nextReport.blocks || []) as ReportBlockFromDB[]);
            baseVersionRef.current = nextReport.version;
            reportRef.current = nextReport;
            blocksRef.current = nextBlocks;
            setReport(nextReport);
            setBlocks(nextBlocks);
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

                const sortedBlocks = sortBlocks(
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
                    setReport(restored.report);
                    setBlocks(restored.blocks);
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

            setSyncStatus(reason === 'autosave' ? 'autosaving' : 'saving');

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

                const data = (await response.json()) as DraftSaveResponse;
                commitServerState(data.report);
                return true;
            } catch (error) {
                console.error(error);
                setSyncStatus('error');
                return false;
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
            setBlocks(sortBlocks(nextBlocks));
            markDirty();
        },
        [markDirty]
    );

    const markBlockDirty = useCallback(
        (blockId: string, data: BlockData) => {
            setBlocks((prev) =>
                sortBlocks(
                    prev.map((block) =>
                        block.id === blockId ? { ...block, data } : block
                    )
                )
            );
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
        publishing,
        hasLocalChanges,
        hasUnpublishedChanges: hasUnpublishedChanges(report) || hasLocalChanges,
        loadReport,
        markBlockDirty,
        markMetadataDirty,
        replaceBlocksLocally,
        flush,
        publish,
        handleVersionConflict,
    };
};
