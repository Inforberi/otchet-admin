'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
    CheckCircle2,
    Circle,
    Clock,
    AlertTriangle,
    User,
    Upload,
    X,
    ClipboardCheck,
    ClipboardList,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    AlignLeft,
    AlignCenter,
    AlignRight,
} from 'lucide-react';
import type { TaskBlockData, ImageData, ScreenshotBlockData, PhotoBlockLayout } from '@/lib/db-types';
import type { TaskBlockDirtyPatch } from '@/hooks/use-report-draft-sync';
import {
    formatAssigneesList,
    normalizeTaskAssignees,
} from '@/lib/task-assignees';
import { taskBlockDataSemanticallyEqual } from '@/lib/block-data-equal';
import { canonicalRichTextValue } from '@/lib/rich-text';
import { registerDraftFlushHandler } from '@/lib/report-draft-flush-registry';
import { ScreenshotBlockView } from '@/components/report/screenshot-block-view';
import {
    TaskAssigneesBadges,
    TaskAssigneesPicker,
} from '@/components/report/task-assignees-picker';
import { Checkbox } from '@/components/ui/checkbox';

const FormattedTextEditor = dynamic(
    () => import('@/components/editor/rich-text-editor'),
    {
        ssr: false,
        loading: () => (
            <div className="space-y-2">
                <div className="h-12 rounded-t border border-zinc-700 bg-zinc-800" />
                <div className="rounded-b border border-t-0 border-zinc-700 bg-zinc-800 min-h-[120px]" />
            </div>
        ),
    }
);

type ImageAccent = 'purple' | 'green';

function isEmptyHtml(html: string | null | undefined): boolean {
    if (!html) return true;
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length === 0;
}

const stripHtml = (value: string | null | undefined): string =>
    (value ?? '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

const truncateText = (value: string, maxLength = 72): string =>
    value.length <= maxLength ? value : `${value.slice(0, maxLength).trim()}...`;

function accentFocusRing(accent: ImageAccent): string {
    return accent === 'green'
        ? 'focus:border-green-500 focus:ring-green-500/30'
        : 'focus:border-purple-500 focus:ring-purple-500/30';
}

function accentAlignActive(accent: ImageAccent, active: boolean): string {
    if (!active) return 'text-zinc-400 hover:text-zinc-200';
    return accent === 'green'
        ? 'bg-green-600/25 text-green-400 ring-1 ring-green-500/50'
        : 'bg-purple-600/25 text-purple-400 ring-1 ring-purple-500/50';
}

const PHOTO_LAYOUT_OPTIONS: { value: PhotoBlockLayout; label: string }[] = [
    { value: 'full-width', label: 'Друг под другом' },
    { value: 'two-column', label: 'Слева-справа (2 колонки)' },
    { value: 'sidebar', label: 'Текст слева, фото справа' },
    { value: 'sidebar-reverse', label: 'Фото слева, текст справа' },
];

function PhotoLayoutSelect({
    value,
    onChange,
    accent,
}: {
    value: PhotoBlockLayout;
    onChange: (layout: PhotoBlockLayout) => void;
    accent: ImageAccent;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Расположение фото</label>
            <select
                aria-label="Расположение фото"
                value={value}
                onChange={(e) => onChange(e.target.value as PhotoBlockLayout)}
                className={`w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-200 focus:border-transparent focus:outline-none focus:ring-2 ${accentFocusRing(accent)}`}
            >
                {PHOTO_LAYOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function accentDragZone(accent: ImageAccent, isDragOver: boolean): string {
    if (isDragOver) {
        return accent === 'green'
            ? 'border-green-500 bg-green-500/10 border-solid'
            : 'border-purple-500 bg-purple-500/10 border-solid';
    }
    return 'border-zinc-700 border-dashed hover:bg-zinc-800';
}

function TaskRichTextField({
    label,
    editorId,
    value,
    onChange,
    placeholder,
    minHeight = '200px',
    baseFontSize = '20',
    headingPresetPx = '24',
    titleFontSize = '40',
    onBasePresetChange,
    onHeadingPresetChange,
    mode = 'block' as 'block' | 'inline',
}: {
    label: string;
    editorId: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    minHeight?: string;
    baseFontSize?: string;
    headingPresetPx?: string;
    titleFontSize?: string;
    onBasePresetChange?: (px: string) => void;
    onHeadingPresetChange?: (px: string) => void;
    mode?: 'block' | 'inline';
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">{label}</label>
            <FormattedTextEditor
                editorId={editorId}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                minHeight={minHeight}
                baseFontSize={mode === 'block' ? baseFontSize : undefined}
                headingPresetPx={mode === 'block' ? headingPresetPx : undefined}
                onBasePresetChange={mode === 'block' ? onBasePresetChange : undefined}
                onHeadingPresetChange={
                    mode === 'block' ? onHeadingPresetChange : undefined
                }
                titleFontSize={mode === 'inline' ? titleFontSize : undefined}
                mode={mode}
            />
        </div>
    );
}

function TaskImageListEditor({
    images,
    onImagesChange,
    onRemoveAt,
    accent,
    uploading,
    isDragOver,
    onDragOver,
    onDragLeave,
    onDrop,
    fileInputRef,
    onFileInputChange,
    uploadAriaLabel,
}: {
    images: ImageData[];
    onImagesChange: (images: ImageData[]) => void;
    onRemoveAt: (index: number) => void;
    accent: ImageAccent;
    uploading: boolean;
    isDragOver: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploadAriaLabel: string;
}) {
    const updateAt = (index: number, patch: Partial<ImageData>) => {
        const next = [...images];
        next[index] = { ...next[index], ...patch };
        onImagesChange(next);
    };

    return (
        <div className="space-y-3">
            {images.map((img, idx) => (
                <div key={img.uploadId || `img-${idx}-${img.url}`} className="overflow-hidden rounded border border-zinc-700 bg-zinc-800 p-3">
                    <div className="relative flex gap-3">
                        <img src={img.url} alt={img.alt} className="relative z-0 h-36 w-36 shrink-0 rounded object-cover" />
                        <div className="relative z-10 min-w-0 flex-1 space-y-2">
                            <input
                                type="text"
                                value={img.caption || ''}
                                onChange={(e) => updateAt(idx, { caption: e.target.value })}
                                placeholder="Подпись к изображению..."
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                            />
                            <input
                                type="text"
                                value={img.alt || ''}
                                onChange={(e) => updateAt(idx, { alt: e.target.value })}
                                placeholder="Alt текст..."
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                            />
                            <div className="flex flex-wrap items-center gap-5">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Размер</span>
                                    <select
                                        aria-label="Размер изображения"
                                        value={img.fit === 'auto-height' || img.fit === 'vertical' ? 'auto-height' : 'auto-width'}
                                        onChange={(e) => updateAt(idx, { fit: e.target.value as 'auto-width' | 'auto-height' })}
                                        className={`cursor-pointer rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 focus:outline-none focus:ring-2 ${accentFocusRing(accent)}`}
                                    >
                                        <option value="auto-width">Авто ширина</option>
                                        <option value="auto-height">Авто высота</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Выравнивание</span>
                                    <div className="inline-flex rounded-lg border border-zinc-600 bg-zinc-800/50 p-0.5" role="group" aria-label="Выравнивание изображения">
                                        {(['left', 'center', 'right'] as const).map((a) => {
                                            const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                                            const active = (img.align ?? (img.center ? 'center' : 'left')) === a;
                                            const label = a === 'left' ? 'По левому краю' : a === 'center' ? 'По центру' : 'По правому краю';
                                            return (
                                                <button
                                                    key={a}
                                                    type="button"
                                                    onClick={() => updateAt(idx, { align: a })}
                                                    title={label}
                                                    aria-label={label}
                                                    className={`cursor-pointer rounded-md p-1.5 transition-colors hover:bg-zinc-700/80 ${accentAlignActive(accent, active)}`}
                                                >
                                                    <Icon className="h-4 w-4" aria-hidden />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onRemoveAt(idx)}
                            className="self-start p-1 hover:bg-red-900 rounded text-red-400 cursor-pointer"
                            title="Удалить изображение"
                            aria-label="Удалить изображение"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded border-2 p-4 transition-all ${accentDragZone(accent, isDragOver)}`}
            >
                <label className="flex w-full cursor-pointer items-center justify-center gap-2">
                    <Upload className="w-5 h-5 text-zinc-400" />
                    <span className="text-sm text-zinc-300">
                        {uploading ? 'Загрузка...' : isDragOver ? 'Отпустите для загрузки' : 'Перетащите изображения или нажмите для выбора'}
                    </span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        aria-label={uploadAriaLabel}
                        onChange={onFileInputChange}
                        disabled={uploading}
                        className="hidden"
                    />
                </label>
            </div>
        </div>
    );
}

function withNormalizedAssignees(data: TaskBlockData): TaskBlockData {
    return {
        ...data,
        assignees: normalizeTaskAssignees(data),
    };
}

function completionAtIso(
    marked: boolean,
    closedAt: string
): string | null {
    return marked && closedAt ? `${closedAt}T12:00:00.000Z` : null;
}

interface TaskBlockCardProps {
    blockId: string;
    reportId: string;
    groupId?: string;
    data: TaskBlockData;
    taskCompletedAt?: Date | string | null;
    taskCompletedByUserId?: string | null;
    taskCompletionNotes?: string | null;
    taskCompletionImages?: ImageData[] | null;
    taskCompletionLayout?: PhotoBlockLayout | null;
    currentUserId?: string | null;
    canEdit?: boolean;
    /** true = editor working area (with actions + editing); false = view-only presentation */
    showActions: boolean;
    /** Редактор: поля задачи и отчёт о выполнении → черновик отчёта */
    onTaskChange?: (patch: TaskBlockDirtyPatch) => void;
    titleFontSize?: string;
    descriptionFontSize?: string;
    contentHeadingFontSize?: string;
    captionFontSize?: string;
    onContentFontSizeChange?: (px: string) => void;
    onContentHeadingFontSizeChange?: (px: string) => void;
}

function todayDateInputValue(): string {
    return new Date().toISOString().slice(0, 10);
}

function isoToDateInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const s = iso.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10)) && iso.length <= 10;
    const d = dateOnly ? new Date(`${iso.slice(0, 10)}T12:00:00`) : new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function deadlineStatus(deadline: string | null, completed: boolean): 'ok' | 'soon' | 'overdue' | null {
    if (!deadline || completed) return null;
    const now = new Date();
    const dl = new Date(deadline);
    const diffDays = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'soon';
    return 'ok';
}

export function TaskBlockCard({
    blockId,
    reportId,
    groupId,
    data,
    taskCompletedAt,
    taskCompletedByUserId: _taskCompletedByUserId,
    taskCompletionNotes,
    taskCompletionImages,
    taskCompletionLayout,
    currentUserId: _currentUserId,
    canEdit: _canEdit = false,
    showActions,
    onTaskChange,
    titleFontSize = '40',
    descriptionFontSize = '20',
    contentHeadingFontSize = '24',
    captionFontSize = '16',
    onContentFontSizeChange,
    onContentHeadingFontSizeChange,
}: TaskBlockCardProps) {
    // --- Completion state ---
    const [markCompleted, setMarkCompleted] = useState<boolean>(!!taskCompletedAt);
    const [completedAt, setCompletedAt] = useState<string | null>(
        taskCompletedAt ? String(taskCompletedAt) : null
    );
    const isPersistedCompleted = Boolean(taskCompletedAt);
    const [notes, setNotes] = useState<string | null>(taskCompletionNotes ?? null);
    const [completionImages, setCompletionImages] = useState<ImageData[]>(taskCompletionImages ?? []);
    const [completionLayout, setCompletionLayout] = useState<PhotoBlockLayout>(
        taskCompletionLayout ?? 'full-width'
    );

    const [completionClosedAt, setCompletionClosedAt] = useState(() =>
        taskCompletedAt
            ? isoToDateInput(String(taskCompletedAt))
            : ''
    );
    const [completionUploading, setCompletionUploading] = useState(false);
    const [isCompletionDragOver, setIsCompletionDragOver] = useState(false);
    const completionFileRef = useRef<HTMLInputElement>(null);

    // --- Edit state (only when onTaskChange is provided) ---
    const isEditable = !!onTaskChange;
    const [localData, setLocalData] = useState<TaskBlockData>(() =>
        withNormalizedAssignees(data)
    );
    const [taskUploading, setTaskUploading] = useState(false);
    const [isTaskDragOver, setIsTaskDragOver] = useState(false);
    const taskFileRef = useRef<HTMLInputElement>(null);
    const onTaskChangeRef = useRef(onTaskChange);
    onTaskChangeRef.current = onTaskChange;
    const markCompletedRef = useRef(markCompleted);
    markCompletedRef.current = markCompleted;
    const completionClosedAtRef = useRef(completionClosedAt);
    completionClosedAtRef.current = completionClosedAt;

    const resolveCompletionAt = useCallback(
        (
            marked = markCompletedRef.current,
            closedAt = completionClosedAtRef.current
        ) => completionAtIso(marked, closedAt || todayDateInputValue()),
        []
    );

    const externalDataKey = useMemo(
        () => JSON.stringify(normalizeTaskAssignees(data)),
        [data]
    );

    const externalTaskKey = useMemo(
        () =>
            JSON.stringify({
                taskCompletedAt,
                taskCompletionNotes: canonicalRichTextValue(
                    taskCompletionNotes,
                    'block'
                ),
                taskCompletionImages,
                taskCompletionLayout,
            }),
        [
            taskCompletedAt,
            taskCompletionNotes,
            taskCompletionImages,
            taskCompletionLayout,
        ]
    );

    useEffect(() => {
        setLocalData((current) => {
            const next = withNormalizedAssignees(data);
            return taskBlockDataSemanticallyEqual(current, next)
                ? current
                : next;
        });
    }, [blockId, externalDataKey, data]);

    useEffect(() => {
        const pendingCompletionAt = resolveCompletionAt();
        const isCompletionPending =
            !!pendingCompletionAt && !taskCompletedAt;

        if (isCompletionPending) {
            setNotes((current) => {
                const next = taskCompletionNotes ?? null;
                return canonicalRichTextValue(current, 'block') ===
                    canonicalRichTextValue(next, 'block')
                    ? current
                    : next;
            });
            setCompletionImages(taskCompletionImages ?? []);
            setCompletionLayout(taskCompletionLayout ?? 'full-width');
            return;
        }

        setMarkCompleted(!!taskCompletedAt);
        setCompletedAt(taskCompletedAt ? String(taskCompletedAt) : null);
        setNotes((current) => {
            const next = taskCompletionNotes ?? null;
            return canonicalRichTextValue(current, 'block') ===
                canonicalRichTextValue(next, 'block')
                ? current
                : next;
        });
        setCompletionImages(taskCompletionImages ?? []);
        setCompletionLayout(taskCompletionLayout ?? 'full-width');
        setCompletionClosedAt(
            taskCompletedAt
                ? isoToDateInput(String(taskCompletedAt))
                : ''
        );
    }, [
        blockId,
        externalTaskKey,
        taskCompletedAt,
        taskCompletionNotes,
        taskCompletionImages,
        taskCompletionLayout,
        resolveCompletionAt,
    ]);

    const buildTaskPatch = useCallback(
        (overrides?: Partial<TaskBlockDirtyPatch>): TaskBlockDirtyPatch => {
            const marked = overrides?.taskCompletedAt
                ? true
                : overrides?.taskCompletedAt === null
                  ? false
                  : markCompletedRef.current;
            const closedAt =
                completionClosedAtRef.current || todayDateInputValue();
            const base: TaskBlockDirtyPatch = {
                data: localData,
                taskCompletedAt: marked ? resolveCompletionAt(marked, closedAt) : null,
                taskCompletionNotes: notes,
                taskCompletionImages: completionImages,
                taskCompletionLayout: completionLayout,
            };
            return { ...base, ...overrides };
        },
        [
            localData,
            notes,
            completionImages,
            completionLayout,
            resolveCompletionAt,
        ]
    );

    const pushTaskChange = useCallback(
        (overrides?: Partial<TaskBlockDirtyPatch>) => {
            onTaskChangeRef.current?.(buildTaskPatch(overrides));
        },
        [buildTaskPatch]
    );

    const buildTaskPatchRef = useRef(buildTaskPatch);
    buildTaskPatchRef.current = buildTaskPatch;

    useEffect(() => {
        if (!isEditable) return;
        return registerDraftFlushHandler(() => {
            onTaskChangeRef.current?.(
                buildTaskPatchRef.current({
                    taskCompletedAt: resolveCompletionAt(),
                })
            );
        });
    }, [isEditable, resolveCompletionAt]);

    useEffect(() => {
        if (!isEditable) return;
        const t = setTimeout(() => pushTaskChange(), 150);
        return () => clearTimeout(t);
    }, [isEditable, pushTaskChange, localData, completionImages, completionLayout]);

    const assignees = useMemo(
        () => normalizeTaskAssignees(localData),
        [localData]
    );

    const isCompletionPending =
        !!resolveCompletionAt() && !taskCompletedAt;
    const showAsCompleted = Boolean(taskCompletedAt) || isCompletionPending;
    const isCompleted = showAsCompleted;
    const isClosedReportView = isPersistedCompleted && !isEditable;
    const dlStatus = deadlineStatus(localData.deadline, isPersistedCompleted);

    const taskTitleFontSize = localData.titleFontSize || titleFontSize || '40';
    const taskDescriptionFontSize =
        localData.descriptionFontSize || descriptionFontSize || '20';

    const collapsible = showActions;
    const [isExpanded, setIsExpanded] = useState(true);
    const blockPreview = useMemo(() => {
        const title = stripHtml(localData.title);
        return truncateText(title || 'Задача');
    }, [localData.title]);

    // --- Upload helpers ---
    const uploadFiles = useCallback(async (files: FileList | File[]): Promise<ImageData[]> => {
        const result: ImageData[] = [];
        let gid = groupId;
        if (!gid) {
            try {
                const r = await fetch(`/api/reports/${reportId}`);
                if (r.ok) {
                    const d = await r.json() as { report?: { groupId?: string } };
                    gid = d.report?.groupId;
                }
            } catch { /* ignore */ }
        }
        if (!gid) return result;
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;
            const form = new FormData();
            form.append('file', file);
            form.append('reportId', reportId);
            form.append('groupId', gid);
            const res = await fetch('/api/uploads', { method: 'POST', body: form });
            if (res.ok) {
                const { upload } = await res.json() as { upload: { id: string; path: string } };
                result.push({
                    url: `/api/static/uploads/${upload.path}`,
                    caption: '',
                    alt: file.name,
                    uploadId: upload.id,
                });
            }
        }
        return result;
    }, [reportId, groupId]);

    // Task photos
    const handleTaskFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setTaskUploading(true);
        const imgs = await uploadFiles(e.target.files);
        setLocalData((prev) => ({ ...prev, images: [...(prev.images ?? []), ...imgs] }));
        setTaskUploading(false);
        e.target.value = '';
    }, [uploadFiles]);

    const handleTaskDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsTaskDragOver(false);
        if (!e.dataTransfer.files?.length) return;
        setTaskUploading(true);
        const imgs = await uploadFiles(e.dataTransfer.files);
        setLocalData((prev) => ({ ...prev, images: [...(prev.images ?? []), ...imgs] }));
        setTaskUploading(false);
    }, [uploadFiles]);

    const removeTaskImage = useCallback((idx: number) => {
        const img = localData.images?.[idx];
        if (img?.uploadId) {
            void fetch(`/api/uploads/by-path?path=${encodeURIComponent(img.url.replace('/api/static/uploads/', ''))}`, { method: 'DELETE' }).catch(() => { });
        }
        setLocalData((prev) => ({ ...prev, images: (prev.images ?? []).filter((_, i) => i !== idx) }));
    }, [localData.images]);

    const screenshotViewData = useMemo(
        (): ScreenshotBlockData => ({
            title: localData.title,
            description: localData.description,
            images: localData.images ?? [],
            layout: localData.layout ?? 'full-width',
        }),
        [localData.title, localData.description, localData.images, localData.layout]
    );

    const completionViewData = useMemo(
        (): ScreenshotBlockData => ({
            title: '',
            description: notes ?? '',
            images: completionImages,
            layout: completionLayout,
        }),
        [notes, completionImages, completionLayout]
    );

    const hasCompletionContent = !isEmptyHtml(notes) || completionImages.length > 0;

    // Completion photos
    const handleCompletionFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setCompletionUploading(true);
        const imgs = await uploadFiles(e.target.files);
        setCompletionImages((prev) => [...prev, ...imgs]);
        setCompletionUploading(false);
        e.target.value = '';
    }, [uploadFiles]);

    const handleCompletionDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsCompletionDragOver(false);
        if (!e.dataTransfer.files?.length) return;
        setCompletionUploading(true);
        const imgs = await uploadFiles(e.dataTransfer.files);
        setCompletionImages((prev) => [...prev, ...imgs]);
        setCompletionUploading(false);
    }, [uploadFiles]);

    const removeCompletionImage = useCallback((idx: number) => {
        const img = completionImages[idx];
        if (img?.uploadId) {
            void fetch(`/api/uploads/by-path?path=${encodeURIComponent(img.url.replace('/api/static/uploads/', ''))}`, { method: 'DELETE' }).catch(() => { });
        }
        setCompletionImages((prev) => prev.filter((_, i) => i !== idx));
    }, [completionImages]);

    // --- Shared style helpers ---
    const inputCls = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500';
    const labelCls = 'block text-xs font-medium text-zinc-400 mb-1';

    // --- Status badges ---
    const statusIcon = isCompleted
        ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        : dlStatus === 'overdue'
            ? <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            : <Circle className="w-5 h-5 text-zinc-500 flex-shrink-0" />;

    const deadlineBadge = () => {
        if (isCompleted) return (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Закрыта · {formatDate(completedAt)}
            </span>
        );
        if (!localData.deadline) return null;
        if (dlStatus === 'overdue') return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-400">
                <AlertTriangle className="w-3 h-3" />
                Просрочено · {formatDate(localData.deadline)}
            </span>
        );
        if (dlStatus === 'soon') return (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-900/40 px-2 py-0.5 text-xs font-medium text-yellow-400">
                <Clock className="w-3 h-3" />
                Срок · {formatDate(localData.deadline)}
            </span>
        );
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
                <Clock className="w-3 h-3" />
                Срок · {formatDate(localData.deadline)}
            </span>
        );
    };

    return (
        <div className={`rounded-xl border overflow-hidden transition-all ${isCompleted
                ? 'border-green-700/30 bg-zinc-900/70'
                : dlStatus === 'overdue'
                    ? 'border-red-700/40 bg-zinc-900'
                    : 'border-purple-800/30 bg-zinc-900'
            }`}>
            {collapsible && (
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="shrink-0 rounded bg-purple-600 px-2.5 py-1 text-xs font-medium text-white">
                            Задача
                        </span>
                        <p className="truncate text-base font-medium text-zinc-200 sm:text-lg">{blockPreview}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsExpanded((v) => !v)}
                        className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-800 cursor-pointer"
                        aria-label={isExpanded ? 'Свернуть блок' : 'Развернуть блок'}
                    >
                        {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                        ) : (
                            <ChevronDown className="h-5 w-5" />
                        )}
                    </button>
                </div>
            )}

            {(!collapsible || isExpanded) && (
            <>
            {/* Header — status + badges */}
            <div className="flex flex-col gap-3 px-3 pt-4 pb-3 sm:flex-row sm:items-start sm:px-5 sm:pt-5">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="mt-0.5 shrink-0">{statusIcon}</div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {deadlineBadge()}
                        <span className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-400">
                            <User className="w-3 h-3 shrink-0" />
                            {assignees.length > 0
                                ? formatAssigneesList(assignees)
                                : '— Не назначен —'}
                        </span>
                    </div>
                </div>
                </div>
            </div>

            <div className={isClosedReportView ? 'px-4 pb-4 space-y-3' : undefined}>
            {/* Zone 1 — Task details */}
            <div
                className={`rounded-lg border border-purple-800/25 bg-zinc-800/50 px-4 py-3 overflow-x-visible overflow-y-hidden ${
                    isClosedReportView ? 'mb-0' : 'mx-2 mb-4 sm:mx-4'
                }`}
            >
                <div className="flex items-center gap-1.5 mb-3">
                    <ClipboardList className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Задание</span>
                </div>

                {isEditable ? (
                    /* === EDITABLE MODE === */
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">Заголовок (опционально)</label>
                            <FormattedTextEditor
                                editorId={`${blockId}:task-title`}
                                value={localData.title || ''}
                                onChange={(value) => setLocalData((p) => ({ ...p, title: value }))}
                                placeholder="Заголовок блока..."
                                minHeight="60px"
                                titleFontSize={taskTitleFontSize}
                                onTitleFontSizeChange={(px) =>
                                    setLocalData((p) => ({ ...p, titleFontSize: px }))
                                }
                                mode="inline"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">Описание (опционально)</label>
                            <FormattedTextEditor
                                editorId={`${blockId}:task-description`}
                                value={localData.description || ''}
                                onChange={(value) => setLocalData((p) => ({ ...p, description: value }))}
                                placeholder="Описание..."
                                minHeight="200px"
                                baseFontSize={descriptionFontSize}
                                headingPresetPx={contentHeadingFontSize}
                                onBasePresetChange={onContentFontSizeChange}
                                onHeadingPresetChange={onContentHeadingFontSizeChange}
                                mode="block"
                            />
                        </div>

                        {/* Dates row */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="select-none">
                                <span className={labelCls}>
                                    <span className="flex items-center gap-1">
                                        <CalendarDays className="w-3 h-3" />
                                        Дата создания
                                    </span>
                                </span>
                                <p className="mt-1 text-sm font-medium text-zinc-200">
                                    {localData.createdAt ? formatDate(localData.createdAt) : '—'}
                                </p>
                            </div>
                            <div>
                                <label className={labelCls}>
                                    <span className="flex items-center gap-1">
                                        <CalendarDays className="w-3 h-3" />
                                        Дата начала
                                    </span>
                                </label>
                                <input
                                    type="date"
                                    value={localData.startDate || ''}
                                    onChange={(e) => setLocalData((p) => ({ ...p, startDate: e.target.value || null }))}
                                    aria-label="Дата начала"
                                    className={`${inputCls} [color-scheme:dark]`}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Крайний срок
                                    </span>
                                </label>
                                <input
                                    type="date"
                                    value={localData.deadline || ''}
                                    onChange={(e) => setLocalData((p) => ({ ...p, deadline: e.target.value || null }))}
                                    aria-label="Крайний срок"
                                    className={`${inputCls} [color-scheme:dark]`}
                                />
                            </div>
                        </div>

                        {/* Assignees */}
                        <div>
                            <label className={labelCls}>
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    Исполнители
                                </span>
                            </label>
                            <TaskAssigneesPicker
                                value={assignees}
                                onChange={(next) =>
                                    setLocalData((p) => ({ ...p, assignees: next }))
                                }
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">Изображения</label>
                            <TaskImageListEditor
                                images={localData.images ?? []}
                                onImagesChange={(images) => setLocalData((p) => ({ ...p, images }))}
                                onRemoveAt={removeTaskImage}
                                accent="purple"
                                uploading={taskUploading}
                                isDragOver={isTaskDragOver}
                                onDragOver={(e) => { e.preventDefault(); setIsTaskDragOver(true); }}
                                onDragLeave={() => setIsTaskDragOver(false)}
                                onDrop={handleTaskDrop}
                                fileInputRef={taskFileRef}
                                onFileInputChange={handleTaskFileInput}
                                uploadAriaLabel="Загрузить фото к заданию"
                            />
                            <PhotoLayoutSelect
                                value={localData.layout ?? 'full-width'}
                                onChange={(layout) => setLocalData((p) => ({ ...p, layout }))}
                                accent="purple"
                            />
                        </div>
                    </div>
                ) : (
                    /* === VIEW-ONLY MODE === */
                    <div className="space-y-4">
                        <ScreenshotBlockView
                            data={screenshotViewData}
                            titleFontSize={taskTitleFontSize}
                            descriptionFontSize={taskDescriptionFontSize}
                            captionFontSize={captionFontSize}
                            variant="embedded"
                        />
                        <div className="select-none space-y-3 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-4 py-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="flex items-center gap-2 text-sm text-zinc-300">
                                    <CalendarDays className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                                    <span>
                                        <span className="text-zinc-400">Начало: </span>
                                        {localData.startDate ? formatDate(localData.startDate) : '—'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-zinc-300">
                                    <Clock className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                                    <span>
                                        <span className="text-zinc-400">Дедлайн: </span>
                                        {localData.deadline ? formatDate(localData.deadline) : '—'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-start gap-2 text-sm text-zinc-300">
                                <User className="w-3.5 h-3.5 shrink-0 text-zinc-400 mt-0.5" />
                                <span className="text-zinc-400 shrink-0">Исполнители:</span>
                                <TaskAssigneesBadges assignees={assignees} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isClosedReportView && <div className="h-px bg-zinc-700/40" aria-hidden />}

            {/* Zone 2 — Completion report (визуально отдельно от задания) */}
            <div
                className={`rounded-lg border px-4 py-3 ${
                    isClosedReportView
                        ? 'border-green-700/40 bg-green-950/25'
                        : isEditable
                          ? 'mx-2 mb-4 border-green-800/45 bg-green-950/20 shadow-[inset_0_1px_0_0_rgba(34,197,94,0.08)] sm:mx-4'
                          : isCompleted
                            ? 'mx-2 mb-4 border-green-700/35 bg-green-950/20 sm:mx-4'
                            : 'mx-2 mb-4 border-green-900/30 bg-green-950/10 sm:mx-4'
                }`}
            >
                <div className="mb-3 flex items-center gap-1.5 border-b border-green-800/30 pb-2.5">
                    <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-green-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-green-400">
                        Отчёт о выполнении
                    </span>
                </div>

                {isEditable && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex min-h-[4.25rem] items-center rounded-lg border border-green-800/30 bg-zinc-900/40 px-3">
                                <div className="flex items-center gap-2.5">
                                    <Checkbox
                                        id={`${blockId}-task-completed`}
                                        checked={markCompleted}
                                        onCheckedChange={(checked) => {
                                            const next = checked === true;
                                            const nextClosedAt =
                                                next && !completionClosedAtRef.current
                                                    ? todayDateInputValue()
                                                    : completionClosedAtRef.current;
                                            markCompletedRef.current = next;
                                            completionClosedAtRef.current = nextClosedAt;
                                            setMarkCompleted(next);
                                            if (next && !completionClosedAt) {
                                                setCompletionClosedAt(nextClosedAt);
                                            }
                                            if (!next) {
                                                setCompletionClosedAt('');
                                            }
                                            pushTaskChange({
                                                taskCompletedAt: completionAtIso(
                                                    next,
                                                    nextClosedAt
                                                ),
                                            });
                                        }}
                                        className="border-zinc-600 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600"
                                    />
                                    <label
                                        htmlFor={`${blockId}-task-completed`}
                                        className="cursor-pointer select-none text-sm font-medium text-zinc-200"
                                    >
                                        Задача выполнена
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label
                                    htmlFor={`${blockId}-task-closed-at`}
                                    className={labelCls}
                                >
                                    <span className="flex items-center gap-1 text-green-400/90">
                                        <CalendarDays className="h-3 w-3" />
                                        Дата закрытия
                                    </span>
                                </label>
                                <input
                                    id={`${blockId}-task-closed-at`}
                                    type="date"
                                    value={completionClosedAt}
                                    onChange={(e) => {
                                        const nextClosedAt = e.target.value;
                                        if (!nextClosedAt) {
                                            completionClosedAtRef.current = '';
                                            setCompletionClosedAt('');
                                            if (markCompletedRef.current) {
                                                markCompletedRef.current = false;
                                                setMarkCompleted(false);
                                                pushTaskChange({
                                                    taskCompletedAt: null,
                                                });
                                            }
                                            return;
                                        }
                                        completionClosedAtRef.current = nextClosedAt;
                                        setCompletionClosedAt(nextClosedAt);
                                        if (!markCompletedRef.current) {
                                            markCompletedRef.current = true;
                                            setMarkCompleted(true);
                                        }
                                        pushTaskChange({
                                            taskCompletedAt: completionAtIso(
                                                true,
                                                nextClosedAt
                                            ),
                                        });
                                    }}
                                    aria-label="Дата закрытия"
                                    className={`${inputCls} [color-scheme:dark] focus:border-green-600 focus:ring-green-600`}
                                />
                            </div>
                        </div>
                        <TaskRichTextField
                            label="Что было сделано"
                            editorId={`${blockId}:completion-notes`}
                            value={notes ?? ''}
                            onChange={(value) => {
                                const next = value || null;
                                setNotes(next);
                                pushTaskChange({ taskCompletionNotes: next });
                            }}
                            placeholder="Опишите что сделано, результаты работы..."
                            minHeight="200px"
                            baseFontSize={descriptionFontSize}
                            headingPresetPx={contentHeadingFontSize}
                            onBasePresetChange={onContentFontSizeChange}
                            onHeadingPresetChange={onContentHeadingFontSizeChange}
                            mode="block"
                        />
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                Изображения
                            </label>
                            <TaskImageListEditor
                                images={completionImages}
                                onImagesChange={setCompletionImages}
                                onRemoveAt={removeCompletionImage}
                                accent="green"
                                uploading={completionUploading}
                                isDragOver={isCompletionDragOver}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsCompletionDragOver(true);
                                }}
                                onDragLeave={() => setIsCompletionDragOver(false)}
                                onDrop={handleCompletionDrop}
                                fileInputRef={completionFileRef}
                                onFileInputChange={handleCompletionFileInput}
                                uploadAriaLabel="Загрузить фото результата"
                            />
                            <PhotoLayoutSelect
                                value={completionLayout}
                                onChange={setCompletionLayout}
                                accent="green"
                            />
                        </div>
                        <p className="text-xs text-green-400/50">
                            Сохранится при сохранении отчёта (кнопка «Сохранить» или
                            автосохранение).
                        </p>
                    </div>
                )}

                {!isEditable && !isPersistedCompleted && !hasCompletionContent && (
                    <p className="text-xs text-zinc-600 italic">Задача ещё не выполнена</p>
                )}

                {!isEditable && !isPersistedCompleted && hasCompletionContent && (
                    <ScreenshotBlockView
                        data={completionViewData}
                        titleFontSize={titleFontSize}
                        descriptionFontSize={descriptionFontSize}
                        captionFontSize={captionFontSize}
                        variant="embedded"
                    />
                )}

                {!isEditable && isPersistedCompleted && (
                    <div className="space-y-4">
                        {hasCompletionContent ? (
                            <ScreenshotBlockView
                                data={completionViewData}
                                titleFontSize={titleFontSize}
                                descriptionFontSize={descriptionFontSize}
                                captionFontSize={captionFontSize}
                                variant="embedded"
                            />
                        ) : (
                            <p className="text-xs text-zinc-600 italic select-none">Отчёт о выполнении не заполнен</p>
                        )}
                    </div>
                )}
            </div>
            </div>
            </>
            )}
        </div>
    );
}
