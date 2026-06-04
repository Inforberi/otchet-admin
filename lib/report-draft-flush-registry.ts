/** Синхронные колбэки перед PATCH черновика (актуализация локального state → blocksRef). */
const handlers = new Set<() => void>();

export const registerDraftFlushHandler = (handler: () => void): (() => void) => {
    handlers.add(handler);
    return () => {
        handlers.delete(handler);
    };
};

export const runDraftFlushHandlers = (): void => {
    handlers.forEach((handler) => {
        try {
            handler();
        } catch (error) {
            console.error('Draft flush handler failed:', error);
        }
    });
};
