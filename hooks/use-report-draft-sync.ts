'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    DividerBlockData,
    ReportBlockFromDB,
    ReportFromDB,
    ScreenshotBlockData,
    TextBlockData,
} from '@/lib/db-types';
import {
    buildDraftPayload,
    computeDraftHash,
    METADATA_FIELDS,
    type DraftMetadataPatch,
    type MetadataField,
} from '@/lib/draft-hash';
import {
    applyDraftDelta,
    clearDraftDelta,
    loadDraftDelta,
    mergeDraftDelta,
    scheduleDraftDeltaSave,
    type StoredDraftDelta,
} from '@/lib/report-draft-storage';

export type SyncStatus = 'synced' | 'local' | 'syncing' | 'conflict' | 'error';

const DEBOUNCE_MS = 600;
const MAX_WAIT_MS = 4000;

type BlockData = TextBlockData | ScreenshotBlockData | DividerBlockData;

type DraftFlushResponse = {
    draftHash: string;
    draftUpdatedAt: string;
    syncedBlockIds: string[];
};

export const useReportDraftSync = (reportId: string) => {
    const [report, setReport] = useState<ReportFromDB | null>(null);
    const [blocks, setBlocks] = useState<ReportBlockFromDB[]>([]);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);

    const reportRef = useRef<ReportFromDB | null>(null);
    const blocksRef = useRef<ReportBlockFromDB[]>([]);
    const dirtyBlockIdsRef = useRef<Set<string>>(new Set());
    const dirtyMetadataRef = useRef<Set<MetadataField>>(new Set());
    const storedDeltaRef = useRef<StoredDraftDelta | null>(null);
    const serverDraftHashRef = useRef<string | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flushInFlightRef = useRef(false);
    const pendingFlushRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);

    reportRef.current = report;
    blocksRef.current = blocks;

    const resetDirty = useCallback(() => {
        dirtyBlockIdsRef.current.clear();
        dirtyMetadataRef.current.clear();
    }, []);

    const persistLocalDelta = useCallback(() => {
        const currentReport = reportRef.current;
        if (!currentReport) return;

        const metadataPatch: DraftMetadataPatch = {};
        for (const field of dirtyMetadataRef.current) {
            (metadataPatch as Record<string, unknown>)[field] = currentReport[field];
        }

        const blockPatches: Record<string, BlockData> = {};
        for (const blockId of dirtyBlockIdsRef.current) {
            const block = blocksRef.current.find((item) => item.id === blockId);
            if (block) blockPatches[blockId] = block.data;
        }

        if (
            Object.keys(metadataPatch).length === 0 &&
            Object.keys(blockPatches).length === 0
        ) {
            return;
        }

        const delta = mergeDraftDelta(storedDeltaRef.current, reportId, {
            metadataPatch,
            blockPatches,
            serverDraftHash: serverDraftHashRef.current,
        });
        storedDeltaRef.current = delta;
        scheduleDraftDeltaSave(delta);
    }, [reportId]);

    const commitSyncedState = useCallback(
        async (nextReport: ReportFromDB, nextBlocks: ReportBlockFromDB[], draftHash: string) => {
            serverDraftHashRef.current = draftHash;
            resetDirty();
            storedDeltaRef.current = null;
            await clearDraftDelta(reportId);
            setReport({ ...nextReport, draftHash });
            setBlocks(nextBlocks);
            setSyncStatus('synced');
        },
        [reportId, resetDirty]
    );

    const buildFlushBody = useCallback(async () => {
        const currentReport = reportRef.current;
        const currentBlocks = blocksRef.current;
        if (!currentReport) return null;

        const payload = buildDraftPayload(currentReport, currentBlocks);
        const draftHash = await computeDraftHash(payload);

        const metadata: DraftMetadataPatch = {};
        for (const field of dirtyMetadataRef.current) {
            (metadata as Record<string, unknown>)[field] = currentReport[field];
        }

        const dirtyBlocks = [...dirtyBlockIdsRef.current]
            .map((blockId) => currentBlocks.find((block) => block.id === blockId))
            .filter((block): block is ReportBlockFromDB => Boolean(block))
            .map((block) => ({
                id: block.id,
                data: block.data,
            }));

        return {
            draftHash,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            blocks: dirtyBlocks.length > 0 ? dirtyBlocks : undefined,
        };
    }, []);

    const flush = useCallback(
        async (options?: { force?: boolean }) => {
            const currentReport = reportRef.current;
            if (!currentReport) return false;

            if (
                !options?.force &&
                dirtyBlockIdsRef.current.size === 0 &&
                dirtyMetadataRef.current.size === 0
            ) {
                setSyncStatus('synced');
                return true;
            }

            if (flushInFlightRef.current) {
                pendingFlushRef.current = true;
                return false;
            }

            const body = await buildFlushBody();
            if (!body) return false;

            if (
                !options?.force &&
                !body.metadata &&
                (!body.blocks || body.blocks.length === 0)
            ) {
                setSyncStatus('synced');
                return true;
            }

            flushInFlightRef.current = true;
            setSyncStatus('syncing');
            abortRef.current?.abort();
            abortRef.current = new AbortController();

            try {
                const response = await fetch(`/api/reports/${reportId}/draft`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: abortRef.current.signal,
                });

                if (response.status === 204) {
                    resetDirty();
                    storedDeltaRef.current = null;
                    await clearDraftDelta(reportId);
                    setSyncStatus('synced');
                    return true;
                }

                if (!response.ok) {
                    throw new Error('Failed to sync draft');
                }

                const data = (await response.json()) as DraftFlushResponse;
                serverDraftHashRef.current = data.draftHash;
                resetDirty();
                storedDeltaRef.current = null;
                await clearDraftDelta(reportId);
                setReport((prev) =>
                    prev
                        ? {
                              ...prev,
                              draftHash: data.draftHash,
                              draftUpdatedAt: data.draftUpdatedAt,
                          }
                        : prev
                );
                setSyncStatus('synced');
                return true;
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    return false;
                }
                setSyncStatus('error');
                return false;
            } finally {
                flushInFlightRef.current = false;
                if (pendingFlushRef.current) {
                    pendingFlushRef.current = false;
                    void flush();
                }
            }
        },
        [buildFlushBody, reportId, resetDirty]
    );

    const scheduleFlush = useCallback(() => {
        setSyncStatus('local');
        persistLocalDelta();

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            void flush();
            if (maxWaitTimerRef.current) {
                clearTimeout(maxWaitTimerRef.current);
                maxWaitTimerRef.current = null;
            }
        }, DEBOUNCE_MS);

        if (!maxWaitTimerRef.current) {
            maxWaitTimerRef.current = setTimeout(() => {
                void flush({ force: true });
                maxWaitTimerRef.current = null;
            }, MAX_WAIT_MS);
        }
    }, [flush, persistLocalDelta]);

    const markBlockDirty = useCallback(
        (blockId: string, data: BlockData) => {
            setBlocks((prev) =>
                prev.map((block) =>
                    block.id === blockId ? { ...block, data } : block
                )
            );
            dirtyBlockIdsRef.current.add(blockId);
            scheduleFlush();
        },
        [scheduleFlush]
    );

    const markMetadataDirty = useCallback(
        (patch: DraftMetadataPatch) => {
            setReport((prev) => (prev ? { ...prev, ...patch } : prev));
            for (const key of Object.keys(patch) as MetadataField[]) {
                dirtyMetadataRef.current.add(key);
            }
            scheduleFlush();
        },
        [scheduleFlush]
    );

    const afterStructuralChange = useCallback(
        (nextReport: ReportFromDB, nextBlocks: ReportBlockFromDB[]) => {
            resetDirty();
            storedDeltaRef.current = null;
            void clearDraftDelta(reportId);
            serverDraftHashRef.current = nextReport.draftHash ?? null;
            setReport(nextReport);
            setBlocks(nextBlocks);

            for (const block of nextBlocks) {
                dirtyBlockIdsRef.current.add(block.id);
            }
            for (const field of METADATA_FIELDS) {
                dirtyMetadataRef.current.add(field);
            }
            scheduleFlush();
        },
        [reportId, resetDirty, scheduleFlush]
    );

    const loadReport = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/reports/${reportId}`);
            if (!response.ok) throw new Error('Failed to fetch report');
            const { report: reportData } = await response.json();
            const blocksData = (reportData.blocks || []) as ReportBlockFromDB[];
            const sortedBlocks = blocksData.sort((a, b) => a.position - b.position);

            serverDraftHashRef.current = reportData.draftHash ?? null;

            const localDelta = await loadDraftDelta(reportId);
            storedDeltaRef.current = localDelta;

            const canRestoreLocal =
                localDelta &&
                (!localDelta.serverDraftHash ||
                    localDelta.serverDraftHash === reportData.draftHash);

            const merged = canRestoreLocal
                ? applyDraftDelta(reportData, sortedBlocks, localDelta)
                : { report: reportData, blocks: sortedBlocks };

            if (localDelta && !canRestoreLocal) {
                await clearDraftDelta(reportId);
                storedDeltaRef.current = null;
            }

            setReport(merged.report);
            setBlocks(merged.blocks);

            if (canRestoreLocal && localDelta) {
                for (const blockId of Object.keys(localDelta.blockPatches)) {
                    dirtyBlockIdsRef.current.add(blockId);
                }
                for (const field of Object.keys(localDelta.metadataPatch) as MetadataField[]) {
                    dirtyMetadataRef.current.add(field);
                }
                setSyncStatus('local');
                scheduleFlush();
            } else {
                setSyncStatus('synced');
            }

            return merged;
        } catch (error) {
            console.error(error);
            setSyncStatus('error');
            return null;
        } finally {
            setLoading(false);
        }
    }, [reportId, scheduleFlush]);

    const handleVersionConflict = useCallback(async () => {
        setSyncStatus('conflict');
        await loadReport();
    }, [loadReport]);

    const publish = useCallback(async () => {
        const currentReport = reportRef.current;
        if (!currentReport) return false;

        setPublishing(true);
        try {
            await flush({ force: true });

            const response = await fetch(`/api/reports/${reportId}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expectedVersion: reportRef.current?.version }),
            });

            if (response.status === 409) {
                await handleVersionConflict();
                return false;
            }

            if (!response.ok) {
                throw new Error('Failed to publish');
            }

            const data = await response.json();
            if (data.report) {
                const nextBlocks = (data.report.blocks || []) as ReportBlockFromDB[];
                await commitSyncedState(
                    data.report,
                    nextBlocks.sort((a, b) => a.position - b.position),
                    data.report.draftHash ?? data.report.publishedHash
                );
            }
            return true;
        } catch (error) {
            console.error(error);
            setSyncStatus('error');
            return false;
        } finally {
            setPublishing(false);
        }
    }, [commitSyncedState, flush, handleVersionConflict, reportId]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                void flush({ force: true });
            }
        };

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (syncStatus === 'local' || syncStatus === 'syncing') {
                event.preventDefault();
                event.returnValue = '';
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
            abortRef.current?.abort();
        };
    }, [flush, syncStatus]);

    return {
        report,
        blocks,
        setBlocks,
        loading,
        syncStatus,
        publishing,
        loadReport,
        markBlockDirty,
        markMetadataDirty,
        flush,
        publish,
        afterStructuralChange,
        handleVersionConflict,
    };
};
