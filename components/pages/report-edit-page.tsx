'use client';

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppPageHeader } from '@/components/layout/app-page-header';
import { stripHtml as stripHtmlLabel, type GroupAncestor } from '@/lib/breadcrumbs';
import { useUserRole } from '@/hooks/use-user-role';
import type {
    ReportFromDB,
    ReportBlockFromDB,
    TextBlockData,
    ScreenshotBlockData,
    DividerBlockData,
    TaskBlockData,
    ImageData,
} from '@/lib/db-types';
import {
    GripVertical,
    Trash2,
    Eye,
    ChevronDown,
    ChevronUp,
    Copy,
    Upload,
    X,
    Save,
    AlignCenter,
    AlignLeft,
    AlignRight,
    ArrowLeft,
    FileText,
    Image,
    ClipboardList,
    Minus,
    LayoutGrid,
    type LucideIcon,
} from 'lucide-react';
import { TaskBlockCard } from '@/components/report/task-block-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReportAutosaveControl } from '@/components/report/report-autosave-control';
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
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const EDITOR_PANE_HEIGHT = 'calc(100vh - 6.75rem)';
const EDITOR_CONTENT_MAX = 'max-w-7xl';

type BlockTypeKey = ReportBlockFromDB['type'];

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
};

const ADD_BLOCK_BUTTONS: { type: BlockTypeKey; label: string; Icon: LucideIcon; ring: string }[] = [
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
        if (data.title) return data.title;
        return 'Задача';
    }
    return 'Разделитель';
};

const SortableBlockCard = memo(function SortableBlockCard({
    block,
    onDelete,
    onDuplicate,
    isSelected,
    onSelect,
}: {
    block: ReportBlockFromDB;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    isSelected: boolean;
    onSelect: (id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id });

    const style = useMemo(() => ({
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }), [transform, transition, isDragging]);

    const blockTitle = useMemo(() => truncateText(getBlockPreview(block), 42), [block]);
    const meta = BLOCK_TYPE_META[block.type];
    const TypeIcon = meta.Icon;
    const handleSelect = useCallback(() => onSelect(block.id), [onSelect, block.id]);
    const handleDuplicate = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onDuplicate(block.id); }, [onDuplicate, block.id]);
    const handleDelete = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onDelete(block.id); }, [onDelete, block.id]);
    const handleStopPropagation = useCallback((e: React.MouseEvent) => { e.stopPropagation(); }, []);

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={handleSelect}
            className={`group mb-1.5 cursor-pointer rounded-lg border border-l-[3px] bg-zinc-800/80 p-2.5 transition-all hover:bg-zinc-800 ${meta.accent} ${
                isSelected
                    ? 'ring-1 ring-zinc-500 border-zinc-600'
                    : 'border-zinc-700/80 hover:border-zinc-600'
            }`}
        >
            <div className="flex items-center gap-2">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300 active:cursor-grabbing flex-shrink-0"
                    onClick={handleStopPropagation}
                    aria-label="Перетащить блок"
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.iconBg}`}>
                    <TypeIcon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{meta.label}</p>
                    <p className="truncate text-sm text-zinc-200">{blockTitle}</p>
                </div>
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
            </div>
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
    onLocalChange: (id: string, data: TextBlockData | ScreenshotBlockData | DividerBlockData | TaskBlockData) => void;
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
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded ${block.type === 'text' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
                            {block.type === 'text' ? 'Текст' : 'Фото'}
                        </span>
                        <p className="text-lg font-medium text-zinc-200">{blockPreview}</p>
                    </div>
                </div>
                <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 cursor-pointer">
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
                                            <div className="relative flex gap-3">
                                                <img src={img.url} alt={img.alt} className="relative z-0 h-36 w-36 shrink-0 rounded object-cover" />
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
                                                    <div className="flex flex-wrap items-center gap-5">
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
    const [ancestors, setAncestors] = useState<GroupAncestor[]>([]);
    const draftLoadedForReportIdRef = useRef<string | null>(null);

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
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const sortedBlocks = useMemo(() => sortBlocksByPosition(blocks), [blocks]);
    const hasBlocks = sortedBlocks.length > 0;

    const handleLogout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }, [router]);

    const syncStatusLabel = useMemo(() => {
        switch (syncStatus) {
            case 'local': return '● Есть локальные изменения';
            case 'autosaving': return '↻ Автосохранение...';
            case 'saving': return '↻ Сохранение...';
            case 'conflict': return '⚠ Конфликт';
            case 'error': return '⚠ Ошибка';
            default:
                if (hasUnpublishedChanges) return '● Есть неопубликованные изменения';
                if (report?.publishedHash) return '✓ Опубликовано';
                return '✓ Сохранено';
        }
    }, [hasUnpublishedChanges, report?.publishedHash, syncStatus]);

    const syncStatusBadge = useMemo(() => {
        const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium';
        switch (syncStatus) {
            case 'local':
                return { className: `${base} bg-amber-500/15 text-amber-300`, text: syncStatusLabel };
            case 'autosaving':
            case 'saving':
                return { className: `${base} bg-blue-500/15 text-blue-300`, text: syncStatusLabel };
            case 'conflict':
            case 'error':
                return { className: `${base} bg-red-500/15 text-red-300`, text: syncStatusLabel };
            default:
                if (hasUnpublishedChanges) {
                    return { className: `${base} bg-amber-500/15 text-amber-300`, text: syncStatusLabel };
                }
                return { className: `${base} bg-zinc-700/80 text-zinc-400`, text: syncStatusLabel };
        }
    }, [syncStatus, syncStatusLabel, hasUnpublishedChanges]);

    const canPublish = useMemo(() => {
        if (!report) return false;
        return !publishing && syncStatus !== 'saving' && syncStatus !== 'autosaving' && (hasLocalChanges || hasUnpublishedChanges || !report.publishedHash);
    }, [hasLocalChanges, hasUnpublishedChanges, publishing, report, syncStatus]);

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

    const handleBlocksDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            const sorted = sortBlocksByPosition(blocks);
            const oldIndex = sorted.findIndex((b) => b.id === active.id);
            const newIndex = sorted.findIndex((b) => b.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return;
            replaceBlocksLocally(
                reindexBlockPositions(arrayMove(sorted, oldIndex, newIndex))
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
        const nextBlocks = reindexBlockPositions(
            sortBlocksByPosition(blocks).filter((block) => block.id !== id)
        );
        replaceBlocksLocally(nextBlocks);
        setSelectedBlockId((cur) => (cur === id ? nextBlocks[0]?.id || null : cur));
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
                createdAt: new Date(),
                updatedAt: new Date(),
                data: defaultData(),
            };
            const nextBlocks = insertBlockAt(blocks, newBlock, selectedBlockId);
            replaceBlocksLocally(nextBlocks);
            setSelectedBlockId(newBlock.id);
        },
        [blocks, report, reportId, replaceBlocksLocally, selectedBlockId]
    );

    const handleSelectBlock = useCallback((id: string) => setSelectedBlockId(id), []);

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

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col">
            <div className="flex flex-col border-b border-zinc-800 bg-zinc-900">
                <AppPageHeader
                    variant="editor"
                    showBreadcrumbs={false}
                    onLogout={handleLogout}
                    breadcrumbs={[]}
                    title={
                        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                            <Link
                                href={groupBackHref}
                                className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
                            >
                                <ArrowLeft className="h-4 w-4 shrink-0" />
                                {groupBackLabel}
                            </Link>
                            <div className="hidden h-4 w-px bg-zinc-700 sm:block" aria-hidden />
                            <div className="min-w-0">
                                <p className="text-lg font-semibold text-white">Конструктор отчёта</p>
                                {stripHtmlLabel(report.title || '') && (
                                    <p className="truncate text-sm text-zinc-400">
                                        {stripHtmlLabel(report.title || '')}
                                    </p>
                                )}
                            </div>
                        </div>
                    }
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={syncStatusBadge.className}>{syncStatusBadge.text}</span>
                            <div className="hidden h-6 w-px bg-zinc-700 sm:block" aria-hidden />
                            <ReportAutosaveControl
                                intervalMs={autosaveIntervalMs}
                                onIntervalChange={handleAutosaveIntervalChange}
                            />
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={syncStatus === 'saving' || syncStatus === 'autosaving'}
                                className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-transparent px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <Save className="h-4 w-4" />
                                {syncStatus === 'saving' ? 'Сохранение...' : 'Сохранить'}
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        getReportPublicPath({
                                            slug: report.slug ?? reportSlug,
                                            group:
                                                report.group ??
                                                (groupPathStr ? { path: groupPathStr } : null),
                                        })
                                    )
                                }
                                className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-transparent px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 cursor-pointer"
                            >
                                <Eye className="h-4 w-4" />
                                Просмотр
                            </button>
                            <button
                                type="button"
                                onClick={handlePublish}
                                disabled={!canPublish}
                                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                {publishing ? 'Публикация...' : canPublish ? 'Опубликовать' : 'Опубликовано'}
                            </button>
                        </div>
                    }
                />
            </div>

            <div className="flex-1 flex">
                {/* Main editing lane */}
                <div
                    className="scrollbar-thin flex-1 overflow-y-auto p-6"
                    style={{ height: EDITOR_PANE_HEIGHT }}
                >
                    <div className={`${EDITOR_CONTENT_MAX} mx-auto w-full space-y-6`}>
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
                                <p className="text-sm text-zinc-600 mt-2">Добавьте первый блок через панель справа</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sortedBlocks.map((block) => (
                                    <div
                                        key={block.id}
                                        id={`block-${block.id}`}
                                        className={`isolate overflow-hidden transition-all rounded-xl ${selectedBlockId === block.id ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-950' : ''}`}
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
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right sidebar */}
                <div
                    className="flex w-96 shrink-0 flex-col border-l border-zinc-800 bg-zinc-900/95"
                    style={{ minHeight: EDITOR_PANE_HEIGHT }}
                >
                    <div className="border-b border-zinc-800 p-4">
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
                    </div>
                    <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
                        {hasBlocks && (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleBlocksDragEnd}
                            >
                                <SortableContext
                                    items={sortedBlocks.map((b) => b.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {sortedBlocks.map((block) => (
                                        <SortableBlockCard
                                            key={block.id}
                                            block={block}
                                            isSelected={selectedBlockId === block.id}
                                            onSelect={handleSelectBlock}
                                            onDelete={handleDeleteBlock}
                                            onDuplicate={handleDuplicateBlock}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        )}

                        {!hasBlocks && (
                            <div className="flex flex-col items-center px-2 py-12 text-center text-zinc-500">
                                <LayoutGrid className="mb-3 h-8 w-8 text-zinc-600" aria-hidden />
                                <p className="text-sm text-zinc-400">Добавьте блок кнопками выше</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={blockToDeleteId !== null}
                onOpenChange={(open) => {
                    if (!open) setBlockToDeleteId(null);
                }}
                title="Удалить блок?"
                description="Блок будет удалён из черновика. Изменения сохранятся при следующей синхронизации."
                confirmLabel="Удалить"
                variant="destructive"
                onConfirm={confirmDeleteBlock}
            />

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
        </div>
    );
}
