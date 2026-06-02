import type { ReportBlockFromDB, ReportFromDB } from '@/lib/db-types';
import type { DraftMetadataPatch } from '@/lib/draft-hash';

const DB_NAME = 'otchet-admin-drafts';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;

export type StoredDraftDelta = {
    reportId: string;
    metadataPatch: DraftMetadataPatch;
    blockPatches: Record<string, ReportBlockFromDB['data']>;
    serverDraftHash: string | null;
    savedAt: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'reportId' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });

    return dbPromise;
};

const withStore = async <T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
};

export const loadDraftDelta = async (
    reportId: string
): Promise<StoredDraftDelta | null> => {
    if (typeof indexedDB === 'undefined') return null;
    try {
        return await withStore('readonly', (store) => store.get(reportId));
    } catch {
        return null;
    }
};

export const saveDraftDelta = async (delta: StoredDraftDelta): Promise<void> => {
    if (typeof indexedDB === 'undefined') return;
    try {
        await withStore('readwrite', (store) => store.put(delta));
    } catch {
        // fallback: server-only sync
    }
};

export const clearDraftDelta = async (reportId: string): Promise<void> => {
    if (typeof indexedDB === 'undefined') return;
    try {
        await withStore('readwrite', (store) => store.delete(reportId));
    } catch {
        // ignore
    }
};

export const applyDraftDelta = (
    report: ReportFromDB,
    blocks: ReportBlockFromDB[],
    delta: StoredDraftDelta | null
): { report: ReportFromDB; blocks: ReportBlockFromDB[] } => {
    if (!delta) {
        return { report, blocks };
    }

    const nextReport = { ...report, ...delta.metadataPatch };
    const nextBlocks = blocks.map((block) => {
        const patch = delta.blockPatches[block.id];
        if (!patch) return block;
        return { ...block, data: patch };
    });

    return { report: nextReport, blocks: nextBlocks };
};

export const mergeDraftDelta = (
    current: StoredDraftDelta | null,
    reportId: string,
    patch: {
        metadataPatch?: DraftMetadataPatch;
        blockPatches?: Record<string, ReportBlockFromDB['data']>;
        serverDraftHash?: string | null;
    }
): StoredDraftDelta => ({
    reportId,
    metadataPatch: {
        ...(current?.metadataPatch ?? {}),
        ...(patch.metadataPatch ?? {}),
    },
    blockPatches: {
        ...(current?.blockPatches ?? {}),
        ...(patch.blockPatches ?? {}),
    },
    serverDraftHash: patch.serverDraftHash ?? current?.serverDraftHash ?? null,
    savedAt: new Date().toISOString(),
});

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingDelta: StoredDraftDelta | null = null;

export const scheduleDraftDeltaSave = (delta: StoredDraftDelta): void => {
    pendingDelta = delta;
    if (saveTimer) clearTimeout(saveTimer);

    const write = () => {
        if (!pendingDelta) return;
        const payload = pendingDelta;
        pendingDelta = null;

        const run = () => {
            void saveDraftDelta(payload);
        };

        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(run, { timeout: 1000 });
        } else {
            setTimeout(run, 0);
        }
    };

    saveTimer = setTimeout(write, 300);
};
