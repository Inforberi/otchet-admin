const pendingByReport = new Map<string, Set<string>>();

export const getUploadStoragePath = (url: string): string | null => {
    if (!url.includes('/api/static/uploads/')) return null;
    return url.replace('/api/static/uploads/', '').split('?')[0] || null;
};

export const queueUploadDeletion = (reportId: string, storagePath: string): void => {
    if (!storagePath) return;
    let set = pendingByReport.get(reportId);
    if (!set) {
        set = new Set();
        pendingByReport.set(reportId, set);
    }
    set.add(storagePath);
};

export const clearPendingUploadDeletions = (reportId: string): void => {
    pendingByReport.delete(reportId);
};

export const flushPendingUploadDeletions = async (
    reportId: string,
): Promise<void> => {
    const set = pendingByReport.get(reportId);
    if (!set?.size) return;

    const paths = [...set];
    pendingByReport.delete(reportId);

    await Promise.allSettled(
        paths.map((path) =>
            fetch(
                `/api/uploads/by-path?path=${encodeURIComponent(path)}`,
                { method: 'DELETE' },
            ),
        ),
    );
};
