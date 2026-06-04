'use client';

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { type GroupAncestor } from '@/lib/breadcrumbs';
import { ReportEditorShell } from '@/components/report/report-editor-header';
import { ReportEditorToolbarActions } from '@/components/report/report-editor-toolbar-actions';
import { UnpublishedChangesBanner } from '@/components/report/unpublished-changes-banner';
import { useUserRole } from '@/hooks/use-user-role';
import type {
    ReportFromDB,
    ReportBlockFromDB,
    TextBlockData,
    ScreenshotBlockData,
    DividerBlockData,
    TaskBlockData,
    SectionBlockData,
    ImageData,
} from '@/lib/db-types';
import {
    buildEditorTree,
    getBlocksToDeleteWithGroup,
    getTargetSectionId,
    insertBlockInGroup,
    isSectionCollapsed,
    applyBlockDrag,
    BLOCK_DRAG_INTENT_LABELS,
    getBlockDragIntent,
    setSectionCollapsed,
    type BlockDragIntent,
} from '@/lib/block-tree';
import {
    BLOCK_DRAG_INTENT_BANNER_CLASS,
    BLOCK_DRAG_INTENT_CARD_CLASS,
    BLOCK_DRAG_INTENT_LABEL_CLASS,
} from '@/lib/block-drag-intent-styles';
import { EditorBlocksSidebarTree } from '@/components/report/editor-blocks-sidebar-tree';
import { SectionGroupEditor } from '@/components/report/section-group-editor';
import {
    GripVertical,
    Trash2,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Copy,
    Upload,
    X,
    AlignCenter,
    AlignLeft,
    AlignRight,
    FileText,
    Image,
    ClipboardList,
    Minus,
    LayoutGrid,
    Folder,
    type LucideIcon,
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TaskBlockCard } from '@/components/report/task-block-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { generateClientId } from '@/lib/generate-id';
import { useReportDraftSync } from '@/hooks/use-report-draft-sync';
import {
    DEFAULT_AUTOSAVE_INTERVAL_MS,
    getAutosaveIntervalMs,
    setAutosaveIntervalMs,
} from '@/lib/report-editor-preferences';
import {
    buildByPathReportApiUrl,
    getReportEditPublicPath,
    getReportPublicPath,
    joinGroupPathFromSegments,
} from '@/lib/report-paths';
import {
    insertBlockAt,
    reindexBlockPositions,
    sortBlocksByPosition,
} from '@/lib/report-block-order';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    type DraggableAttributes,
    type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import { sidebarCollisionDetection } from '@/lib/sidebar-dnd-collision';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

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

const stripHtml = (value: string | null | undefined): string =>
    (value ?? '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

const truncateText = (value: string, maxLength = 48): string =>
    value.length <= maxLength ? value : `${value.slice(0, maxLength).trim()}...`;

const EDITOR_CONTENT_MAX = 'max-w-7xl';

type ContentBlockTypeKey = 'text' | 'screenshot' | 'divider' | 'task';
type BlockTypeKey = ContentBlockTypeKey | 'section';

const BLOCK_TYPE_META: Record<
    BlockTypeKey,
    { label: string; Icon: LucideIcon; accent: string; iconBg: string }
> = {
    text: {
        label: 'Текст',
        Icon: FileText,
        accent: 'border-l-green-500',
        iconBg: 'bg-green-500/15 text-green-400',
    },
    screenshot: {
        label: 'Фото',
        Icon: Image,
        accent: 'border-l-blue-500',
        iconBg: 'bg-blue-500/15 text-blue-400',
    },
    task: {
        label: 'Задача',
        Icon: ClipboardList,
        accent: 'border-l-purple-500',
        iconBg: 'bg-purple-500/15 text-purple-400',
    },
    divider: {
        label: 'HR',
        Icon: Minus,
        accent: 'border-l-zinc-500',
        iconBg: 'bg-zinc-500/15 text-zinc-400',
    },
    section: {
        label: 'Группа',
        Icon: Folder,
        accent: 'border-l-amber-500',
        iconBg: 'bg-amber-500/15 text-amber-400',
    },
};

const ADD_BLOCK_BUTTONS: { type: ContentBlockTypeKey; label: string; Icon: LucideIcon; ring: string }[] = [
    { type: 'text', label: 'Текст', Icon: FileText, ring: 'hover:ring-green-500/40' },
    { type: 'screenshot', label: 'Фото', Icon: Image, ring: 'hover:ring-blue-500/40' },
    { type: 'task', label: 'Задача', Icon: ClipboardList, ring: 'hover:ring-purple-500/40' },
    { type: 'divider', label: 'HR', Icon: Minus, ring: 'hover:ring-zinc-500/40' },
];

const getBlockPreview = (block: ReportBlockFromDB | { type: ReportBlockFromDB['type']; data: ReportBlockFromDB['data'] }): string => {
    if (block.type === 'text') {
        const data = block.data as TextBlockData;
        const title = stripHtml(data.title);
        if (title) return title;
        const content = stripHtml(data.content);
        if (content) return content;
        return 'Текстовый блок';
    }
    if (block.type === 'screenshot') {
        const data = block.data as ScreenshotBlockData;
        const title = stripHtml(data.title);
        if (title) return title;
        const description = stripHtml(data.description);
        if (description) return description;
        return `Фото (${data.images?.length || 0})`;
    }
    if (block.type === 'task') {
        const data = block.data as TaskBlockData;
        const title = stripHtml(data.title);
        if (title) return title;
        return 'Задача';
    }
    if (block.type === 'section') {
        const data = block.data as SectionBlockData;
        const title = stripHtml(data.title);
        return title || 'Без заголовка';
    }
    return 'Разделитель';
};

const BlockListCard = memo(function BlockListCard({
    block,
    onDelete,
    onDuplicate,
    isSelected,
    onSelect,
    dragHandleProps,
    isDragOverlay,
    subtitle,
    collapseToggle,
    dropIntent = 'none',
}: {
    block: ReportBlockFromDB;
    onDelete?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
    dragHandleProps?: {
        attributes: DraggableAttributes;
        listeners: DraggableSyntheticListeners;
    };
    isDragOverlay?: boolean;
    subtitle?: string;
    collapseToggle?: { collapsed: boolean; onToggle: () => void };
    dropIntent?: BlockDragIntent;
}) {
    const blockTitle = useMemo(() => truncateText(getBlockPreview(block), 42), [block]);
    const dropIntentClass = BLOCK_DRAG_INTENT_CARD_CLASS[dropIntent];
    const dropIntentLabel =
        dropIntent !== 'none' ? BLOCK_DRAG_INTENT_LABELS[dropIntent] : null;
    const dropIntentLabelClass =
        dropIntent !== 'none' ? BLOCK_DRAG_INTENT_LABEL_CLASS[dropIntent] : '';
    const meta = BLOCK_TYPE_META[block.type];
    const TypeIcon = meta.Icon;
    const handleSelect = useCallback(() => onSelect?.(block.id), [onSelect, block.id]);
    const handleDuplicate = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDuplicate?.(block.id);
        },
        [onDuplicate, block.id]
    );
    const handleDelete = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDelete?.(block.id);
        },
        [onDelete, block.id]
    );
    const handleStopPropagation = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
    }, []);

    return (
        <div
            onClick={onSelect ? handleSelect : undefined}
            className={`group mb-1.5 rounded-lg border border-l-[3px] bg-zinc-800/80 p-2.5 transition-colors hover:bg-zinc-800 ${meta.accent} ${
                onSelect ? 'cursor-pointer' : ''
            } ${
                isDragOverlay
                    ? 'shadow-lg ring-1 ring-zinc-500 border-zinc-600'
                    : dropIntentClass || (isSelected
                          ? 'ring-1 ring-zinc-500 border-zinc-600'
                          : 'border-zinc-700/80 hover:border-zinc-600')
            }`}
        >
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {dragHandleProps ? (
                    <button
                        {...dragHandleProps.attributes}
                        {...dragHandleProps.listeners}
                        className="cursor-grab rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300 active:cursor-grabbing flex-shrink-0"
                        onClick={handleStopPropagation}
                        aria-label="Перетащить блок"
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-zinc-500">
                        <GripVertical className="h-4 w-4" aria-hidden />
                    </span>
                )}
                {collapseToggle ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            collapseToggle.onToggle();
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300 cursor-pointer"
                        aria-expanded={!collapseToggle.collapsed}
                        aria-label={
                            collapseToggle.collapsed
                                ? 'Развернуть группу'
                                : 'Свернуть группу'
                        }
                    >
                        {collapseToggle.collapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </button>
                ) : null}
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.iconBg}`}>
                    <TypeIcon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 whitespace-nowrap">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{meta.label}</p>
                    <p className="text-sm text-zinc-200">{blockTitle}</p>
                    {subtitle ? (
                        <p className="text-[10px] text-zinc-500">{subtitle}</p>
                    ) : null}
                </div>
                {onDuplicate && onDelete && (
                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                            type="button"
                            onClick={handleDuplicate}
                            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 cursor-pointer"
                            title="Дублировать"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-950 hover:text-red-400 cursor-pointer"
                            title="Удалить"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>
            {dropIntentLabel ? (
                <p
                    className={`mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wide ${dropIntentLabelClass}`}
                >
                    {dropIntentLabel}
                </p>
            ) : null}
        </div>
    );
});

function BlockEditor({
    block,
    onLocalChange,
    reportId,
    groupId,
}: {
    block: ReportBlockFromDB;
    onLocalChange: (id: string, data: ReportBlockFromDB['data']) => void;
    reportId: string;
    groupId?: string;
}) {
    const [localData, setLocalData] = useState(block.data);
    const [uploading, setUploading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [isDragOver, setIsDragOver] = useState(false);
    const skipNextChangeRef = useRef(true);

    useEffect(() => {
        setLocalData(block.data);
        skipNextChangeRef.current = true;
    }, [block.id, block.data]);

    useEffect(() => {
        if (skipNextChangeRef.current) { skipNextChangeRef.current = false; return; }
        const debounce = setTimeout(() => { onLocalChange(block.id, localData); }, 100);
        return () => clearTimeout(debounce);
    }, [localData, block.id, onLocalChange]);

    const blockPreview = useMemo(
        () => block.type === 'divider'
            ? 'Разделительная линия'
            : truncateText(getBlockPreview({ type: block.type, data: localData as ReportBlockFromDB['data'] }), 72),
        [block.type, localData]
    );

    const processFiles = useCallback(async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            const newImages: ImageData[] = [];
            let currentGroupId: string;
            if (groupId) {
                currentGroupId = groupId;
            } else {
                try {
                    const reportRes = await fetch(`/api/reports/${reportId}`);
                    if (!reportRes.ok) throw new Error('Не удалось загрузить отчет');
                    const { report: reportData } = await reportRes.json();
                    if (!reportData?.groupId) { alert('Ошибка: группа не найдена'); setUploading(false); return; }
                    currentGroupId = reportData.groupId;
                } catch (error) {
                    console.error('Error fetching report:', error);
                    alert('Ошибка: не удалось загрузить данные отчета');
                    setUploading(false);
                    return;
                }
            }
            for (const file of Array.from(files)) {
                if (!file.type.startsWith('image/')) continue;
                const formData = new FormData();
                formData.append('file', file);
                formData.append('reportId', reportId);
                formData.append('groupId', currentGroupId);
                const res = await fetch('/api/uploads', { method: 'POST', body: formData });
                if (res.ok) {
                    const { upload } = await res.json();
                    newImages.push({ url: `/api/static/uploads/${upload.path}`, caption: '', alt: file.name, uploadId: upload.id });
                }
            }
            setLocalData((prevData) => {
                const currentImages = (prevData as ScreenshotBlockData).images || [];
                return { ...(prevData as ScreenshotBlockData), images: [...currentImages, ...newImages] } as ScreenshotBlockData;
            });
        } catch (error) {
            console.error('Upload error:', error);
            alert('Ошибка загрузки изображения');
        } finally {
            setUploading(false);
        }
    }, [reportId, groupId]);

    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) await processFiles(e.target.files);
    }, [processFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }, []);
    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
        if (e.dataTransfer.files?.length) await processFiles(e.dataTransfer.files);
    }, [processFiles]);

    const handleRemoveImage = useCallback(async (index: number) => {
        setLocalData((prevData) => {
            const images = (prevData as ScreenshotBlockData).images || [];
            const imageToRemove = images[index];
            if (!imageToRemove) return prevData;
            void (async () => {
                try {
                    const urlPath = imageToRemove.url.replace('/api/static/uploads/', '');
                    await fetch(`/api/uploads/by-path?path=${encodeURIComponent(urlPath)}`, { method: 'DELETE' });
                } catch (error) { console.error('Error deleting file:', error); }
            })();
            return { ...(prevData as ScreenshotBlockData), images: images.filter((_, i) => i !== index) } as ScreenshotBlockData;
        });
    }, []);

    const handleUpdateImageCaption = useCallback((index: number, caption: string, inputRef?: HTMLInputElement) => {
        const cursorPosition = inputRef?.selectionStart ?? null;
        setLocalData((prevData) => {
            const images = [...(prevData as ScreenshotBlockData).images];
            images[index] = { ...images[index], caption };
            return { ...(prevData as ScreenshotBlockData), images } as ScreenshotBlockData;
        });
        if (inputRef && cursorPosition !== null) setTimeout(() => inputRef.setSelectionRange(cursorPosition, cursorPosition), 0);
    }, []);

    const handleUpdateImageAlt = useCallback((index: number, alt: string, inputRef?: HTMLInputElement) => {
        const cursorPosition = inputRef?.selectionStart ?? null;
        setLocalData((prevData) => {
            const images = [...(prevData as ScreenshotBlockData).images];
            images[index] = { ...images[index], alt };
            return { ...(prevData as ScreenshotBlockData), images } as ScreenshotBlockData;
        });
        if (inputRef && cursorPosition !== null) setTimeout(() => inputRef.setSelectionRange(cursorPosition, cursorPosition), 0);
    }, []);

    const handleUpdateImageFit = useCallback((index: number, fit: 'auto-width' | 'auto-height') => {
        setLocalData((prevData) => {
            const images = [...(prevData as ScreenshotBlockData).images];
            images[index] = { ...images[index], fit };
            return { ...(prevData as ScreenshotBlockData), images } as ScreenshotBlockData;
        });
    }, []);

    const handleUpdateImageAlign = useCallback((index: number, align: 'left' | 'center' | 'right') => {
        setLocalData((prevData) => {
            const images = [...(prevData as ScreenshotBlockData).images];
            images[index] = { ...images[index], align };
            return { ...(prevData as ScreenshotBlockData), images } as ScreenshotBlockData;
        });
    }, []);

    if (block.type === 'section') {
        return null;
    }

    if (block.type === 'divider') {
        return (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="px-2.5 py-1 bg-gray-600 text-white text-xs font-medium rounded">Разделитель</span>
                </div>
                <p className="text-zinc-400 text-sm">Разделительная линия между блоками</p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 mb-4">
            <div className="flex flex-col gap-2 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                    <span className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium ${block.type === 'text' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
                        {block.type === 'text' ? 'Текст' : 'Фото'}
                    </span>
                    <p className="min-w-0 truncate text-base font-medium text-zinc-200 sm:text-lg">{blockPreview}</p>
                </div>
                <button onClick={() => setIsExpanded(!isExpanded)} className="self-end rounded p-1.5 text-zinc-400 hover:bg-zinc-800 cursor-pointer sm:self-auto">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>
            {isExpanded && (
                <div className="p-4 space-y-4">
                    {block.type === 'text' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">Заголовок (опционально)</label>
                                <FormattedTextEditor
                                    editorId={`${block.id}:text-title`}
                                    value={(localData as TextBlockData).title || ''}
                                    onChange={(value) => setLocalData({ ...(localData as TextBlockData), title: value } as TextBlockData)}
                                    placeholder="Заголовок раздела..."
                                    minHeight="60px"
                                    defaultFontSize="40"
                                    mode="inline"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">Описание (опционально)</label>
                                <FormattedTextEditor
                                    editorId={`${block.id}:text-content`}
                                    value={(localData as TextBlockData).content || ''}
                                    onChange={(value) => setLocalData({ ...(localData as TextBlockData), content: value } as TextBlockData)}
                                    placeholder="Основной текст..."
                                    minHeight="200px"
                                    defaultFontSize="20"
                                    mode="block"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">Заголовок (опционально)</label>
                                <FormattedTextEditor
                                    editorId={`${block.id}:screenshot-title`}
                                    value={(localData as ScreenshotBlockData).title || ''}
                                    onChange={(value) => setLocalData({ ...(localData as ScreenshotBlockData), title: value } as ScreenshotBlockData)}
                                    placeholder="Заголовок блока..."
                                    minHeight="60px"
                                    defaultFontSize="40"
                                    mode="inline"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">Описание (опционально)</label>
                                <FormattedTextEditor
                                    editorId={`${block.id}:screenshot-description`}
                                    value={(localData as ScreenshotBlockData).description || ''}
                                    onChange={(value) => setLocalData({ ...(localData as ScreenshotBlockData), description: value } as ScreenshotBlockData)}
                                    placeholder="Описание..."
                                    minHeight="200px"
                                    defaultFontSize="20"
                                    mode="block"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">Изображения</label>
                                <div className="space-y-3">
                                    {(localData as ScreenshotBlockData).images?.map((img, idx) => (
                                        <div key={img.uploadId || `img-${idx}-${img.url}`} className="overflow-hidden rounded border border-zinc-700 bg-zinc-800 p-3">
                                            <div className="relative flex flex-col gap-3 sm:flex-row">
                                                <img src={img.url} alt={img.alt} className="relative z-0 h-auto w-full max-h-48 shrink-0 rounded object-cover sm:h-36 sm:w-36 sm:max-h-none" />
                                                <div className="relative z-10 min-w-0 flex-1 space-y-2">
                                                    <input
                                                        type="text"
                                                        value={img.caption || ''}
                                                        onChange={(e) => handleUpdateImageCaption(idx, e.target.value, e.currentTarget)}
                                                        placeholder="Подпись к изображению..."
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={img.alt || ''}
                                                        onChange={(e) => handleUpdateImageAlt(idx, e.target.value, e.currentTarget)}
                                                        placeholder="Alt текст..."
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                                                    />
                                                    <div className="flex flex-wrap items-center gap-2 sm:gap-5">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Размер</span>
                                                            <select
                                                                aria-label="Размер изображения"
                                                                value={img.fit === 'auto-height' || img.fit === 'vertical' ? 'auto-height' : 'auto-width'}
                                                                onChange={(e) => handleUpdateImageFit(idx, e.target.value as 'auto-width' | 'auto-height')}
                                                                className="cursor-pointer rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                                                                        <button key={a} type="button" onClick={() => handleUpdateImageAlign(idx, a)} title={label} aria-label={label}
                                                                            className={`cursor-pointer rounded-md p-1.5 transition-colors hover:bg-zinc-700/80 ${active ? 'bg-blue-600/25 text-blue-400 ring-1 ring-blue-500/50' : 'text-zinc-400 hover:text-zinc-200'}`}>
                                                                            <Icon className="h-4 w-4" aria-hidden />
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleRemoveImage(idx)} className="self-start p-1 hover:bg-red-900 rounded text-red-400 cursor-pointer" title="Удалить изображение">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`flex cursor-pointer items-center justify-center gap-2 rounded border-2 p-4 transition-all ${isDragOver ? 'border-blue-500 bg-blue-500/10 border-solid' : 'border-zinc-700 border-dashed hover:bg-zinc-800'}`}
                                    >
                                        <label className="flex w-full cursor-pointer items-center justify-center gap-2">
                                            <Upload className="w-5 h-5 text-zinc-400" />
                                            <span className="text-sm text-zinc-300">
                                                {uploading ? 'Загрузка...' : isDragOver ? 'Отпустите для загрузки' : 'Перетащите изображения или нажмите для выбора'}
                                            </span>
                                            <input type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} className="hidden" />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">Расположение фото</label>
                                <select
                                    aria-label="Расположение фото"
                                    value={(localData as ScreenshotBlockData).layout || 'full-width'}
                                    onChange={(e) => setLocalData({ ...(localData as ScreenshotBlockData), layout: e.target.value as ScreenshotBlockData['layout'] } as ScreenshotBlockData)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="full-width">Друг под другом</option>
                                    <option value="two-column">Слева-справа (2 колонки)</option>
                                    <option value="sidebar">Текст слева, фото справа</option>
                                    <option value="sidebar-reverse">Фото слева, текст справа</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

interface ReportEditPageProps {
    groupPath: string[];
    reportSlug: string;
}

export default function ReportEditPage({ groupPath, reportSlug }: ReportEditPageProps) {
    const router = useRouter();
    const groupPathStr = joinGroupPathFromSegments(groupPath);
    const reportApiUrl = buildByPathReportApiUrl(groupPathStr, reportSlug);
    const { canEdit, loading: roleLoading, user: currentUser } = useUserRole();

    const [resolvedReportId, setResolvedReportId] = useState<string | null>(null);
    const [autosaveIntervalMs, setAutosaveIntervalMsState] = useState(() =>
        typeof window !== 'undefined' ? getAutosaveIntervalMs() : DEFAULT_AUTOSAVE_INTERVAL_MS
    );

    const {
        report,
        blocks,
        loading,
        syncStatus,
        publishing,
        hasLocalChanges,
        hasUnpublishedChanges,
        loadReport,
        markBlockDirty,
        markMetadataDirty,
        replaceBlocksLocally,
        flush,
        publish,
        rescheduleAutosave,
    } = useReportDraftSync(resolvedReportId ?? '', autosaveIntervalMs);

    const reportId = resolvedReportId ?? '';

    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [blockToDeleteId, setBlockToDeleteId] = useState<string | null>(null);
    const [publishSuccessOpen, setPublishSuccessOpen] = useState(false);
    const [mobileBlocksPanelOpen, setMobileBlocksPanelOpen] = useState(false);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [overBlockId, setOverBlockId] = useState<string | null>(null);
    const [isLargeScreen, setIsLargeScreen] = useState(false);
    const [ancestors, setAncestors] = useState<GroupAncestor[]>([]);
    const draftLoadedForReportIdRef = useRef<string | null>(null);
    const mobileDockRef = useRef<HTMLDivElement>(null);
    const editorHeaderRef = useRef<HTMLElement>(null);

    const pointerActivation = { delay: 100, tolerance: 8 } as const;
    const touchActivation = { delay: 150, tolerance: 8 } as const;

    useEffect(() => {
        if (!reportApiUrl) return;
        setResolvedReportId(null);
        draftLoadedForReportIdRef.current = null;
        void fetch(reportApiUrl)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.report?.id) setResolvedReportId(data.report.id);
                if (data?.ancestors) setAncestors(data.ancestors);
            })
            .catch(() => setAncestors([]));
    }, [reportApiUrl]);

    const groupBackHref = groupPathStr ? `/${groupPathStr}` : '/';
    const groupBackLabel = report?.group?.name ?? ancestors.at(-1)?.name ?? 'К группе';

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: pointerActivation }),
        useSensor(TouchSensor, { activationConstraint: touchActivation }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const sortedBlocks = useMemo(() => sortBlocksByPosition(blocks), [blocks]);
    const editorTree = useMemo(() => buildEditorTree(blocks), [blocks]);
    const hasBlocks = sortedBlocks.length > 0;
    const blockToDelete = blockToDeleteId
        ? blocks.find((b) => b.id === blockToDeleteId)
        : null;

    const activeBlock = useMemo(
        () => (activeBlockId ? sortedBlocks.find((b) => b.id === activeBlockId) : null),
        [activeBlockId, sortedBlocks]
    );

    const dragIntentPreview = useMemo(
        () =>
            activeBlockId && overBlockId
                ? getBlockDragIntent(blocks, activeBlockId, overBlockId)
                : 'none',
        [activeBlockId, overBlockId, blocks]
    );

    useEffect(() => {
        const header = editorHeaderRef.current;
        if (!header) return;

        const updateHeaderHeight = () => {
            document.documentElement.style.setProperty(
                '--editor-header-h',
                `${header.offsetHeight}px`
            );
        };

        updateHeaderHeight();
        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(header);
        return () => {
            observer.disconnect();
            document.documentElement.style.removeProperty('--editor-header-h');
        };
    }, []);

    const syncStatusLabel = useMemo(() => {
        switch (syncStatus) {
            case 'local':
                return '● Есть локальные изменения';
            case 'autosaving':
                return '↻ Автосохранение...';
            case 'saving':
                return '↻ Сохранение...';
            case 'conflict':
                return '⚠ Конфликт';
            case 'error':
                return '⚠ Ошибка';
            default:
                if (hasUnpublishedChanges) return '● Есть неопубликованные изменения';
                if (report?.publishedHash) return '✓ Опубликовано';
                return '✓ Сохранено';
        }
    }, [hasUnpublishedChanges, report?.publishedHash, syncStatus]);

    const syncStatusShortLabel = useMemo(() => {
        switch (syncStatus) {
            case 'local':
                return 'Локальные';
            case 'autosaving':
                return 'Авто…';
            case 'saving':
                return 'Сохранение…';
            case 'conflict':
                return 'Конфликт';
            case 'error':
                return 'Ошибка';
            default:
                if (hasUnpublishedChanges) return 'Не опубл.';
                if (report?.publishedHash) return 'Опубликовано';
                return 'Сохранено';
        }
    }, [hasUnpublishedChanges, report?.publishedHash, syncStatus]);

    const syncStatusBadge = useMemo(() => {
        const base =
            'inline-flex h-8 max-w-full shrink-0 items-center rounded-full px-2.5 text-xs font-medium';
        switch (syncStatus) {
            case 'local':
                return {
                    className: `${base} bg-amber-500/15 text-amber-300`,
                    text: syncStatusLabel,
                    shortText: syncStatusShortLabel,
                };
            case 'autosaving':
            case 'saving':
                return {
                    className: `${base} bg-blue-500/15 text-blue-300`,
                    text: syncStatusLabel,
                    shortText: syncStatusShortLabel,
                };
            case 'conflict':
            case 'error':
                return {
                    className: `${base} bg-red-500/15 text-red-300`,
                    text: syncStatusLabel,
                    shortText: syncStatusShortLabel,
                };
            default:
                if (hasUnpublishedChanges) {
                    return {
                        className: `${base} bg-amber-500/15 text-amber-300`,
                        text: syncStatusLabel,
                        shortText: syncStatusShortLabel,
                    };
                }
                return {
                    className: `${base} bg-zinc-700/80 text-zinc-400`,
                    text: syncStatusLabel,
                    shortText: syncStatusShortLabel,
                };
        }
    }, [syncStatus, syncStatusLabel, syncStatusShortLabel, hasUnpublishedChanges]);

    const canPublish = useMemo(() => {
        if (!report) return false;
        return (
            !publishing &&
            syncStatus !== 'saving' &&
            syncStatus !== 'autosaving' &&
            (hasLocalChanges || hasUnpublishedChanges || !report.publishedHash)
        );
    }, [hasLocalChanges, hasUnpublishedChanges, publishing, report, syncStatus]);

    const handleLogout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }, [router]);

    const handleAutosaveIntervalChange = useCallback(
        (ms: number) => {
            setAutosaveIntervalMsState(ms);
            setAutosaveIntervalMs(ms);
            if (ms > 0 && hasLocalChanges) {
                rescheduleAutosave();
            }
        },
        [hasLocalChanges, rescheduleAutosave]
    );

    const handleSaveDraft = useCallback(async () => {
        await flush({ reason: 'manual' });
    }, [flush]);

    const handlePublish = useCallback(async () => {
        const ok = await publish();
        if (ok) setPublishSuccessOpen(true);
    }, [publish]);

    const handleViewReport = useCallback(() => {
        if (!report) return;
        router.push(
            getReportPublicPath({
                slug: report.slug ?? reportSlug,
                group: report.group ?? (groupPathStr ? { path: groupPathStr } : null),
            })
        );
    }, [report, reportSlug, groupPathStr, router]);

    const saveDisabled = syncStatus === 'saving' || syncStatus === 'autosaving';
    const saveLabel = syncStatus === 'saving' ? 'Сохранение...' : 'Сохранить';

    const showUnpublishedBanner = useMemo(() => {
        if (!report?.publishedHash) return hasUnpublishedChanges || hasLocalChanges;
        return hasUnpublishedChanges;
    }, [hasUnpublishedChanges, hasLocalChanges, report?.publishedHash]);

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const update = () => setIsLargeScreen(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        const dock = mobileDockRef.current;
        if (!dock) return;

        const updateDockHeight = () => {
            document.documentElement.style.setProperty(
                '--editor-mobile-dock-h',
                `${dock.offsetHeight}px`
            );
        };

        updateDockHeight();
        const observer = new ResizeObserver(updateDockHeight);
        observer.observe(dock);
        return () => {
            observer.disconnect();
            document.documentElement.style.removeProperty('--editor-mobile-dock-h');
        };
    }, [mobileBlocksPanelOpen, hasBlocks]);

    const handleBlocksDragStart = useCallback((event: DragStartEvent) => {
        setActiveBlockId(String(event.active.id));
        setOverBlockId(null);
    }, []);

    const handleBlocksDragOver = useCallback((event: DragOverEvent) => {
        setOverBlockId(event.over?.id ? String(event.over.id) : null);
    }, []);

    const handleBlocksDragCancel = useCallback(() => {
        setActiveBlockId(null);
        setOverBlockId(null);
    }, []);

    const handleBlocksDragEnd = useCallback(
        (event: DragEndEvent) => {
            setActiveBlockId(null);
            setOverBlockId(null);
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            replaceBlocksLocally(
                applyBlockDrag(blocks, String(active.id), String(over.id))
            );
        },
        [blocks, replaceBlocksLocally]
    );

    const handleDeleteBlock = useCallback((id: string) => {
        setBlockToDeleteId(id);
    }, []);

    const confirmDeleteBlock = useCallback(() => {
        const id = blockToDeleteId;
        if (!id) return;
        const idsToDelete = new Set(getBlocksToDeleteWithGroup(blocks, id));
        const nextBlocks = reindexBlockPositions(
            sortBlocksByPosition(blocks).filter((block) => !idsToDelete.has(block.id))
        );
        replaceBlocksLocally(nextBlocks);
        setSelectedBlockId((cur) =>
            cur && idsToDelete.has(cur) ? nextBlocks[0]?.id ?? null : cur
        );
        setBlockToDeleteId(null);
    }, [blockToDeleteId, blocks, replaceBlocksLocally]);

    const handleDuplicateBlock = useCallback(
        (id: string) => {
            const blockToDup = blocks.find((b) => b.id === id);
            if (!blockToDup) return;
            const duplicatedBlock: ReportBlockFromDB = {
                ...blockToDup,
                id: generateClientId(),
                position: 0,
                version: 1,
                parentId: blockToDup.type === 'section' ? null : blockToDup.parentId ?? null,
                createdAt: new Date(),
                updatedAt: new Date(),
                data: JSON.parse(JSON.stringify(blockToDup.data)) as ReportBlockFromDB['data'],
            };
            const nextBlocks = insertBlockAt(blocks, duplicatedBlock, id);
            replaceBlocksLocally(nextBlocks);
            setSelectedBlockId(duplicatedBlock.id);
        },
        [blocks, replaceBlocksLocally]
    );

    const handleAddBlock = useCallback(
        (type: 'text' | 'screenshot' | 'divider' | 'task') => {
            if (!reportId || !report) return;
            const defaultData = (): ReportBlockFromDB['data'] => {
                if (type === 'text') return { title: '', content: '' };
                if (type === 'divider') return {} as never;
                if (type === 'task')
                    return {
                        title: '',
                        description: '',
                        images: [],
                        createdAt: new Date().toISOString().slice(0, 10),
                        startDate: null,
                        deadline: null,
                        assignees: [],
                        layout: 'full-width',
                    } satisfies TaskBlockData;
                return { title: '', description: '', images: [], layout: 'full-width' };
            };
            const newBlock: ReportBlockFromDB = {
                id: generateClientId(),
                reportId,
                type,
                position: 0,
                version: 1,
                parentId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                data: defaultData(),
            };
            const sectionId = getTargetSectionId(blocks, selectedBlockId);
            const nextBlocks = sectionId
                ? insertBlockInGroup(blocks, newBlock, sectionId, selectedBlockId)
                : insertBlockAt(blocks, newBlock, selectedBlockId);
            replaceBlocksLocally(nextBlocks);
            setSelectedBlockId(newBlock.id);
        },
        [blocks, report, reportId, replaceBlocksLocally, selectedBlockId]
    );

    const handleAddSection = useCallback(() => {
        if (!reportId || !report) return;
        const newBlock: ReportBlockFromDB = {
            id: generateClientId(),
            reportId,
            type: 'section',
            position: 0,
            version: 1,
            parentId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            data: { title: '', collapsed: false } satisfies SectionBlockData,
        };
        const nextBlocks = insertBlockAt(blocks, newBlock, selectedBlockId);
        replaceBlocksLocally(nextBlocks);
        setSelectedBlockId(newBlock.id);
    }, [blocks, report, reportId, replaceBlocksLocally, selectedBlockId]);

    const handleToggleSectionCollapsed = useCallback(
        (sectionId: string) => {
            const section = blocks.find((b) => b.id === sectionId && b.type === 'section');
            if (!section) return;
            const next = setSectionCollapsed(section, !isSectionCollapsed(section));
            markBlockDirty(sectionId, next.data as SectionBlockData);
        },
        [blocks, markBlockDirty]
    );

    const handleSelectBlock = useCallback((id: string) => {
        setSelectedBlockId(id);
        setMobileBlocksPanelOpen(false);
    }, []);

    useEffect(() => {
        if (!report?.slug || !report.group?.path) return;
        const canonical = getReportEditPublicPath(report);
        const current = getReportEditPublicPath({
            slug: reportSlug,
            group: { path: groupPathStr },
        });
        if (canonical !== current) {
            router.replace(canonical);
        }
    }, [report?.slug, report?.group?.path, reportSlug, groupPathStr, router, report]);

    useEffect(() => {
        if (roleLoading) return;
        if (!canEdit) {
            router.push(
                report
                    ? getReportPublicPath({
                          slug: report.slug ?? reportSlug,
                          group: report.group ?? (groupPathStr ? { path: groupPathStr } : null),
                      })
                    : `/${groupPathStr}`
            );
            return;
        }
        if (!resolvedReportId) return;
        if (draftLoadedForReportIdRef.current === resolvedReportId) return;
        draftLoadedForReportIdRef.current = resolvedReportId;
        void loadReport().then((merged) => {
            if (merged && merged.blocks.length > 0) {
                const sorted = sortBlocksByPosition(merged.blocks);
                setSelectedBlockId(sorted[0]?.id ?? null);
            }
        });
    }, [resolvedReportId, canEdit, roleLoading, router, loadReport, groupPathStr, reportSlug, report]);

    useEffect(() => {
        if (report && !report.date) markMetadataDirty({ date: new Date().toISOString().split('T')[0] });
    }, [report, markMetadataDirty]);

    useEffect(() => {
        if (selectedBlockId) {
            document.getElementById(`block-${selectedBlockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedBlockId]);

    if (roleLoading) return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="text-zinc-400">Загрузка...</div></div>;
    if (!canEdit) return null;
    if (loading) return <div className="p-8 bg-zinc-950 text-white min-h-screen">Загрузка...</div>;
    if (!report) return <div className="p-8 bg-zinc-950 text-white min-h-screen">Отчет не найден</div>;

    const sortableBlockList = hasBlocks ? (
        <EditorBlocksSidebarTree
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            activeBlockId={activeBlockId}
            overBlockId={overBlockId}
            onSelect={handleSelectBlock}
            onDelete={handleDeleteBlock}
            onDuplicate={handleDuplicateBlock}
            onToggleSectionCollapsed={handleToggleSectionCollapsed}
            BlockListCard={BlockListCard}
        />
    ) : null;

    const renderContentBlock = (block: ReportBlockFromDB) => (
        <div
            key={block.id}
            id={`block-${block.id}`}
            className={`isolate overflow-hidden transition-all rounded-xl ${
                selectedBlockId === block.id
                    ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-950'
                    : ''
            }`}
        >
            {block.type === 'task' ? (
                <TaskBlockCard
                    blockId={block.id}
                    reportId={reportId}
                    groupId={report?.groupId}
                    data={block.data as TaskBlockData}
                    taskCompletedAt={block.taskCompletedAt}
                    taskCompletedByUserId={block.taskCompletedByUserId}
                    taskCompletionNotes={block.taskCompletionNotes}
                    taskCompletionImages={block.taskCompletionImages as ImageData[] | null}
                    taskCompletionLayout={block.taskCompletionLayout ?? null}
                    currentUserId={currentUser?.id}
                    canEdit={canEdit}
                    showActions={true}
                    titleFontSize={report.titleFontSize || '40'}
                    descriptionFontSize={report.descriptionFontSize || '20'}
                    captionFontSize={report.captionFontSize || '16'}
                    onDataChange={(data) => markBlockDirty(block.id, data)}
                />
            ) : (
                <BlockEditor
                    block={block}
                    onLocalChange={markBlockDirty}
                    reportId={reportId}
                    groupId={report?.groupId}
                />
            )}
        </div>
    );

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-zinc-950">
            <ReportEditorShell
                ref={editorHeaderRef}
                groupBackHref={groupBackHref}
                groupBackLabel={groupBackLabel}
                reportTitle={stripHtml(report.title || '') || undefined}
                onLogout={handleLogout}
                toolbar={
                    <ReportEditorToolbarActions
                        syncStatusBadge={syncStatusBadge}
                        autosaveIntervalMs={autosaveIntervalMs}
                        onAutosaveIntervalChange={handleAutosaveIntervalChange}
                        onSave={() => void handleSaveDraft()}
                        onView={handleViewReport}
                        onPublish={() => void handlePublish()}
                        saveDisabled={saveDisabled}
                        saveLabel={saveLabel}
                        publishDisabled={!canPublish}
                        publishing={publishing}
                        canPublish={canPublish}
                    />
                }
            />

            <DndContext
                sensors={sensors}
                collisionDetection={sidebarCollisionDetection}
                modifiers={[restrictToVerticalAxis]}
                onDragStart={handleBlocksDragStart}
                onDragOver={handleBlocksDragOver}
                onDragCancel={handleBlocksDragCancel}
                onDragEnd={handleBlocksDragEnd}
            >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch">
                {/* Main editing lane */}
                <div
                    className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 max-lg:pb-[calc(var(--editor-mobile-dock-h,9rem)+env(safe-area-inset-bottom)+1rem)] lg:pb-6"
                >
                    <div className={`${EDITOR_CONTENT_MAX} mx-auto w-full space-y-6`}>
                        {showUnpublishedBanner && <UnpublishedChangesBanner />}
                        {/* Metadata */}
                        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Метаданные отчёта</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Название отчёта *</label>
                                    <FormattedTextEditor editorId="report:title" value={report.title} onChange={(value) => markMetadataDirty({ title: value })} placeholder="Отчёт по аудиту сайта" minHeight="60px" defaultFontSize="40" mode="inline" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Описание (опционально)</label>
                                    <FormattedTextEditor editorId="report:subtitle" value={report.subtitle || ''} onChange={(value) => markMetadataDirty({ subtitle: value })} placeholder="Анализ производительности и SEO" mode="block" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Дата</label>
                                    <input type="date" aria-label="Дата отчета" value={report.date || new Date().toISOString().split('T')[0]} onChange={(e) => markMetadataDirty({ date: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]" />
                                </div>
                                <div className="pt-4">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                                        Размеры шрифта
                                    </p>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {[
                                            { label: 'Заголовок', field: 'titleFontSize' as const, default: '40' },
                                            { label: 'Описание', field: 'descriptionFontSize' as const, default: '20' },
                                            { label: 'Подпись', field: 'captionFontSize' as const, default: '16' },
                                        ].map(({ label, field, default: def }) => (
                                            <div key={field}>
                                                <label className="mb-1 block text-xs font-medium text-zinc-400">{label}</label>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        aria-label={`${label}, px`}
                                                        value={report[field] || def}
                                                        onChange={(e) => {
                                                            const input = e.currentTarget;
                                                            const pos = input.selectionStart || 0;
                                                            markMetadataDirty({ [field]: e.target.value || null });
                                                            setTimeout(() => input.setSelectionRange(pos, pos), 0);
                                                        }}
                                                        className="w-full max-w-[5rem] rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                                                        placeholder={def}
                                                        min="8"
                                                        max="200"
                                                    />
                                                    <span className="text-xs text-zinc-500">px</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {!hasBlocks ? (
                            <div className="text-center py-16 text-zinc-500 bg-zinc-900 rounded-lg border border-zinc-800">
                                <p>Нет блоков</p>
                                <p className="text-sm text-zinc-600 mt-2">
                                    <span className="lg:hidden">Добавьте первый блок кнопками внизу</span>
                                    <span className="hidden lg:inline">Добавьте первый блок через панель справа</span>
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {editorTree.map((node) => {
                                    if (node.kind === 'section') {
                                        const collapsed = isSectionCollapsed(node.section);
                                        return (
                                            <div
                                                key={node.section.id}
                                                id={`block-${node.section.id}`}
                                                className={`transition-all ${
                                                    selectedBlockId === node.section.id
                                                        ? 'rounded-xl ring-2 ring-amber-500/80 ring-offset-2 ring-offset-zinc-950'
                                                        : ''
                                                }`}
                                            >
                                                <SectionGroupEditor
                                                    section={node.section}
                                                    titlePreview={truncateText(
                                                        getBlockPreview(node.section),
                                                        72
                                                    )}
                                                    childCount={node.children.length}
                                                    onDataChange={(data) =>
                                                        markBlockDirty(node.section.id, data)
                                                    }
                                                    onToggleCollapsed={() =>
                                                        handleToggleSectionCollapsed(node.section.id)
                                                    }
                                                />
                                                {!collapsed && node.children.length > 0 && (
                                                    <div className="ml-3 space-y-4 border-l border-zinc-800/60 pl-2 pb-4 sm:ml-4 sm:pl-3">
                                                        {node.children.map((child) =>
                                                            renderContentBlock(child)
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return renderContentBlock(node.block);
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop sidebar — на всю высоту колонки, без зазора под шапкой */}
                <aside
                    className="hidden w-96 shrink-0 flex-col overflow-hidden border-l border-zinc-800 bg-zinc-900 lg:flex"
                    aria-label="Панель блоков"
                >
                    <div className="shrink-0 border-b border-zinc-800 p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            Добавить блок
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {ADD_BLOCK_BUTTONS.map(({ type, label, Icon, ring }) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleAddBlock(type)}
                                    className={`flex flex-col items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-2 py-2.5 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-800 hover:ring-1 ${ring} cursor-pointer`}
                                >
                                    <Icon className="h-4 w-4" aria-hidden />
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={handleAddSection}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-2 py-2.5 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-800 hover:ring-1 hover:ring-amber-500/40 cursor-pointer"
                        >
                            <Folder className="h-4 w-4 text-amber-400" aria-hidden />
                            Группа
                        </button>
                    </div>
                    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-zinc-900 p-3 touch-pan-y">
                        {activeBlockId && dragIntentPreview !== 'none' ? (
                            <div
                                className={`mb-2 rounded-md border px-2 py-1.5 text-center text-[11px] font-medium ${BLOCK_DRAG_INTENT_BANNER_CLASS[dragIntentPreview]}`}
                                role="status"
                                aria-live="polite"
                            >
                                {BLOCK_DRAG_INTENT_LABELS[dragIntentPreview]}
                            </div>
                        ) : null}
                        {hasBlocks && isLargeScreen ? (
                            sortableBlockList
                        ) : !hasBlocks ? (
                            <div className="flex flex-col items-center px-2 py-12 text-center text-zinc-500">
                                <LayoutGrid className="mb-3 h-8 w-8 text-zinc-600" aria-hidden />
                                <p className="text-sm text-zinc-400">Добавьте блок кнопками выше</p>
                            </div>
                        ) : null}
                    </div>
                </aside>
            </div>

            {/* Mobile sticky blocks panel */}
            <div
                ref={mobileDockRef}
                className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]"
            >
                {mobileBlocksPanelOpen && (
                    <div className="scrollbar-thin max-h-[min(50vh,400px)] overflow-y-auto border-b border-zinc-800 p-3">
                        {activeBlockId && dragIntentPreview !== 'none' ? (
                            <div
                                className={`mb-2 rounded-md border px-2 py-1.5 text-center text-[11px] font-medium ${BLOCK_DRAG_INTENT_BANNER_CLASS[dragIntentPreview]}`}
                                role="status"
                                aria-live="polite"
                            >
                                {BLOCK_DRAG_INTENT_LABELS[dragIntentPreview]}
                            </div>
                        ) : null}
                        {hasBlocks && !isLargeScreen ? (
                            sortableBlockList
                        ) : !hasBlocks ? (
                            <p className="py-4 text-center text-sm text-zinc-500">
                                Блоков пока нет — добавьте кнопками ниже
                            </p>
                        ) : null}
                    </div>
                )}
                <div className="space-y-2 p-3">
                    <button
                        type="button"
                        onClick={() => setMobileBlocksPanelOpen((v) => !v)}
                        className="flex w-full items-center justify-between rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 cursor-pointer"
                        aria-expanded={mobileBlocksPanelOpen}
                    >
                        <span className="flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4 text-zinc-400" aria-hidden />
                            Блоки ({sortedBlocks.length})
                        </span>
                        {mobileBlocksPanelOpen ? (
                            <ChevronDown className="h-5 w-5 text-zinc-400" />
                        ) : (
                            <ChevronUp className="h-5 w-5 text-zinc-400" />
                        )}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                        {ADD_BLOCK_BUTTONS.map(({ type, label, Icon, ring }) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => handleAddBlock(type)}
                                className={`flex flex-col items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-2 py-2 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-800 hover:ring-1 ${ring} cursor-pointer`}
                            >
                                <Icon className="h-4 w-4" aria-hidden />
                                {label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleAddSection}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-2 py-2 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-800 hover:ring-1 hover:ring-amber-500/40 cursor-pointer"
                    >
                        <Folder className="h-4 w-4 text-amber-400" aria-hidden />
                        Группа
                    </button>
                </div>
            </div>

            <DragOverlay dropAnimation={null}>
                {activeBlock ? (
                    <div className="w-[min(100vw-2rem,20rem)]">
                        <BlockListCard
                            block={activeBlock}
                            isDragOverlay
                            dropIntent={
                                overBlockId
                                    ? getBlockDragIntent(
                                          blocks,
                                          activeBlock.id,
                                          overBlockId
                                      )
                                    : 'none'
                            }
                        />
                    </div>
                ) : null}
            </DragOverlay>
            </DndContext>

            <AlertDialog open={publishSuccessOpen} onOpenChange={setPublishSuccessOpen}>
                <AlertDialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">Отчёт опубликован</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Читатели увидят актуальную версию отчёта.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction className="bg-green-700 text-white hover:bg-green-600">
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ConfirmDialog
                open={blockToDeleteId !== null}
                onOpenChange={(open) => {
                    if (!open) setBlockToDeleteId(null);
                }}
                title={
                    blockToDelete?.type === 'section' ? 'Удалить группу?' : 'Удалить блок?'
                }
                description={
                    blockToDelete?.type === 'section'
                        ? `Группа и все вложенные блоки (${getBlocksToDeleteWithGroup(blocks, blockToDelete.id).length - 1}) будут удалены из черновика.`
                        : 'Блок будет удалён из черновика. Изменения сохранятся при следующей синхронизации.'
                }
                confirmLabel="Удалить"
                variant="destructive"
                onConfirm={confirmDeleteBlock}
            />

        </div>
    );
}
