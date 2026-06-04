'use client';

import { Eye, Save } from 'lucide-react';
import { ReportAutosaveControl } from '@/components/report/report-autosave-control';

const TOOLBAR_BTN =
    'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-600 px-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';

const PUBLISH_BTN =
    'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-green-600 px-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';

type ReportEditorToolbarActionsProps = {
    syncStatusBadge: { className: string; text: string; shortText: string };
    autosaveIntervalMs: number;
    onAutosaveIntervalChange: (ms: number) => void;
    onSave: () => void;
    onView: () => void;
    onPublish: () => void;
    saveDisabled: boolean;
    saveLabel: string;
    publishDisabled: boolean;
    publishing: boolean;
    canPublish: boolean;
};

function ToolbarDivider() {
    return <span className="mx-0.5 h-5 w-px shrink-0 bg-zinc-700" aria-hidden />;
}

export function ReportEditorToolbarActions({
    syncStatusBadge,
    autosaveIntervalMs,
    onAutosaveIntervalChange,
    onSave,
    onView,
    onPublish,
    saveDisabled,
    saveLabel,
    publishDisabled,
    publishing,
    canPublish,
}: ReportEditorToolbarActionsProps) {
    const publishLabel = publishing
        ? 'Публикация...'
        : canPublish
          ? 'Опубликовать'
          : 'Опубликовано';

    return (
        <div
            className="inline-flex w-max shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/50 px-1.5 py-1"
            role="toolbar"
            aria-label="Действия редактора"
        >
            <span
                className={`${syncStatusBadge.className} inline-flex min-w-[10.5rem] shrink-0 items-center justify-center truncate xl:min-w-[19rem]`}
                title={syncStatusBadge.text}
                aria-live="polite"
            >
                <span className="xl:hidden">{syncStatusBadge.shortText}</span>
                <span className="hidden xl:inline">{syncStatusBadge.text}</span>
            </span>
            <ToolbarDivider />
            <ReportAutosaveControl
                variant="inline"
                intervalMs={autosaveIntervalMs}
                onIntervalChange={onAutosaveIntervalChange}
            />
            <ToolbarDivider />
            <button
                type="button"
                onClick={onSave}
                disabled={saveDisabled}
                className={`${TOOLBAR_BTN} min-w-[8.75rem]`}
                title={saveLabel}
            >
                <Save className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden md:inline">{saveLabel}</span>
            </button>
            <button
                type="button"
                onClick={onView}
                className={TOOLBAR_BTN}
                title="Просмотр"
            >
                <Eye className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden md:inline">Просмотр</span>
            </button>
            <button
                type="button"
                onClick={onPublish}
                disabled={publishDisabled}
                className={PUBLISH_BTN}
                title={publishLabel}
            >
                {publishLabel}
            </button>
        </div>
    );
}
