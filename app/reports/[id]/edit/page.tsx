'use client';

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import { AppPageHeader } from '@/components/layout/app-page-header';
import {
    buildReportEditBreadcrumbs,
    stripHtml as stripHtmlLabel,
    type GroupAncestor,
} from '@/lib/breadcrumbs';
import { useUserRole } from '@/hooks/use-user-role';
import type {
    ReportFromDB,
    ReportBlockFromDB,
    TextBlockData,
    ScreenshotBlockData,
    DividerBlockData,
    ImageData,
} from '@/lib/db-types';
import {
    GripVertical,
    Trash2,
    Plus,
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
} from 'lucide-react';
import { useReportDraftSync } from '@/hooks/use-report-draft-sync';
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

    return 'Разделитель';
};

// Компактная карточка блока в sidebar
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

    const blockTitle = useMemo(
        () => truncateText(getBlockPreview(block), 30),
        [block]
    );

    const handleSelect = useCallback(() => {
        onSelect(block.id);
    }, [onSelect, block.id]);

    const handleDuplicate = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onDuplicate(block.id);
    }, [onDuplicate, block.id]);

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(block.id);
    }, [onDelete, block.id]);

    const handleStopPropagation = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
    }, []);

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={handleSelect}
            className={`rounded border mb-2 p-3 hover:border-zinc-600 transition-colors cursor-pointer ${isSelected
                ? 'bg-zinc-700 border-blue-500'
                : 'bg-zinc-800 border-zinc-700'
                }`}
        >
            <div className="flex items-center gap-2">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 hover:bg-zinc-700 rounded flex-shrink-0"
                    onClick={handleStopPropagation}
                >
                    <GripVertical className="w-4 h-4 text-zinc-400" />
                </button>

                <div className="flex-1 min-w-0">
                    <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded mb-1 ${block.type === 'text'
                            ? 'bg-green-600 text-white'
                            : block.type === 'divider'
                                ? 'bg-gray-600 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                    >
                        {block.type === 'text'
                            ? 'Текст'
                            : block.type === 'divider'
                                ? 'HR'
                                : 'Фото'}
                    </span>
                    <p className="text-xs text-zinc-300 truncate">
                        {blockTitle}
                    </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={handleDuplicate}
                        className="p-1 hover:bg-zinc-700 rounded text-zinc-400 cursor-pointer"
                        title="Дублировать"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-1 hover:bg-red-900 rounded text-red-400 cursor-pointer"
                        title="Удалить"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
});

// Полноценный редактор блока (инлайн)
function BlockEditor({
    block,
    onLocalChange,
    reportId,
    groupId,
}: {
    block: ReportBlockFromDB;
    onLocalChange: (
        id: string,
        data: TextBlockData | ScreenshotBlockData | DividerBlockData
    ) => void;
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
        if (skipNextChangeRef.current) {
            skipNextChangeRef.current = false;
            return;
        }

        const debounce = setTimeout(() => {
            onLocalChange(block.id, localData);
        }, 100);
        return () => clearTimeout(debounce);
    }, [localData, block.id, onLocalChange]);

    const blockPreview = useMemo(
        () =>
            block.type === 'divider'
                ? 'Разделительная линия'
                : truncateText(
                      getBlockPreview({
                          type: block.type,
                          data: localData as ReportBlockFromDB['data'],
                      }),
                      72
                  ),
        [block.type, localData]
    );

    const processFiles = useCallback(async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const newImages: ImageData[] = [];

            // Получаем groupId из пропа или из API
            let currentGroupId: string;
            if (groupId) {
                currentGroupId = groupId;
            } else {
                // Если groupId не передан, получаем его из API
                try {
                    const reportRes = await fetch(`/api/reports/${reportId}`);
                    if (!reportRes.ok) {
                        throw new Error('Не удалось загрузить отчет');
                    }
                    const { report: reportData } = await reportRes.json();
                    if (!reportData?.groupId) {
                        alert('Ошибка: группа не найдена');
                        setUploading(false);
                        return;
                    }
                    currentGroupId = reportData.groupId;
                } catch (error) {
                    console.error('Error fetching report:', error);
                    alert('Ошибка: не удалось загрузить данные отчета');
                    setUploading(false);
                    return;
                }
            }

            for (const file of Array.from(files)) {
                // Проверяем, что это изображение
                if (!file.type.startsWith('image/')) {
                    continue;
                }

                const formData = new FormData();
                formData.append('file', file);
                formData.append('reportId', reportId);
                formData.append('groupId', currentGroupId);

                const res = await fetch('/api/uploads', {
                    method: 'POST',
                    body: formData,
                });

                if (res.ok) {
                    const { upload } = await res.json();
                    newImages.push({
                        url: `/api/static/uploads/${upload.path}`,
                        caption: '',
                        alt: file.name,
                        uploadId: upload.id,
                    });
                }
            }

            setLocalData((prevData) => {
                const currentImages =
                    (prevData as ScreenshotBlockData).images || [];
                return {
                    ...(prevData as ScreenshotBlockData),
                    images: [...currentImages, ...newImages],
                } as ScreenshotBlockData;
            });
        } catch (error) {
            console.error('Upload error:', error);
            alert('Ошибка загрузки изображения');
        } finally {
            setUploading(false);
        }
    }, [reportId, groupId]);

    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        await processFiles(files);
    }, [processFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await processFiles(files);
        }
    }, [processFiles]);

    const handleRemoveImage = useCallback(async (index: number) => {
        setLocalData((prevData) => {
            const images = (prevData as ScreenshotBlockData).images || [];
            const imageToRemove = images[index];

            if (!imageToRemove) return prevData;

            // Удаляем файл с сервера
            (async () => {
                try {
                    // Извлекаем path из URL: /api/static/uploads/{path}
                    const urlPath = imageToRemove.url.replace(
                        '/api/static/uploads/',
                        ''
                    );

                    const res = await fetch(
                        `/api/uploads/by-path?path=${encodeURIComponent(urlPath)}`,
                        {
                            method: 'DELETE',
                        }
                    );

                    if (!res.ok) {
                        console.error('Failed to delete file from server');
                        // Не показываем ошибку пользователю, файл уже удален из UI
                    }
                } catch (error) {
                    console.error('Error deleting file:', error);
                    // Не показываем ошибку пользователю, файл уже удален из UI
                }
            })();

            // Удаляем изображение из локального состояния
            const updatedImages = images.filter((_, i) => i !== index);
            return {
                ...(prevData as ScreenshotBlockData),
                images: updatedImages,
            } as ScreenshotBlockData;
        });
    }, []);

    const handleUpdateImageCaption = useCallback((index: number, caption: string, inputRef?: HTMLInputElement) => {
        // Сохраняем позицию курсора перед обновлением
        let cursorPosition: number | null = null;
        if (inputRef) {
            cursorPosition = inputRef.selectionStart || 0;
        }

        setLocalData((prevData) => {
            const images = [...(prevData as ScreenshotBlockData).images];
            images[index] = { ...images[index], caption };
            return {
                ...(prevData as ScreenshotBlockData),
                images,
            } as ScreenshotBlockData;
        });

        // Восстанавливаем позицию курсора после обновления
        if (inputRef && cursorPosition !== null) {
            setTimeout(() => {
                inputRef.setSelectionRange(cursorPosition, cursorPosition);
            }, 0);
        }
    }, []);

    const handleUpdateImageAlt = useCallback((index: number, alt: string, inputRef?: HTMLInputElement) => {
        // Сохраняем позицию курсора перед обновлением
        let cursorPosition: number | null = null;
        if (inputRef) {
            cursorPosition = inputRef.selectionStart || 0;
        }

        setLocalData((prevData) => {
            const images = [...(prevData as ScreenshotBlockData).images];
            images[index] = { ...images[index], alt };
            return {
                ...(prevData as ScreenshotBlockData),
                images,
            } as ScreenshotBlockData;
        });

        // Восстанавливаем позицию курсора после обновления
        if (inputRef && cursorPosition !== null) {
            setTimeout(() => {
                inputRef.setSelectionRange(cursorPosition, cursorPosition);
            }, 0);
        }
    }, []);

    const handleUpdateImageFit = useCallback((index: number, fit: 'auto-width' | 'auto-height') => {
        setLocalData((prevData) => {
            const images = [...(prevData as ScreenshotBlockData).images];
            images[index] = { ...images[index], fit };
            return {
                ...(prevData as ScreenshotBlockData),
                images,
            } as ScreenshotBlockData;
        });
    }, []);

    const handleUpdateImageAlign = useCallback((index: number, align: 'left' | 'center' | 'right') => {
        setLocalData((prevData) => {
            const images = [...(prevData as ScreenshotBlockData).images];
            images[index] = { ...images[index], align };
            return {
                ...(prevData as ScreenshotBlockData),
                images,
            } as ScreenshotBlockData;
        });
    }, []);

    if (block.type === 'divider') {
        return (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="px-2.5 py-1 bg-gray-600 text-white text-xs font-medium rounded">
                        Разделитель
                    </span>
                </div>
                <p className="text-zinc-400 text-sm">
                    Разделительная линия между блоками
                </p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 mb-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-4">
                        <span
                            className={`px-2.5 py-1 text-xs font-medium rounded ${block.type === 'text'
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 text-white'
                                }`}
                        >
                            {block.type === 'text' ? 'Текст' : 'Фото'}
                        </span>
                        <p className="text-lg font-medium text-zinc-200">
                            {blockPreview}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 cursor-pointer"
                >
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                    ) : (
                        <ChevronDown className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 space-y-4">
                    {block.type === 'text' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Заголовок (опционально)
                                </label>
                                <FormattedTextEditor
                                    editorId={`${block.id}:text-title`}
                                    value={
                                        (localData as TextBlockData).title || ''
                                    }
                                    onChange={(value) =>
                                        setLocalData({
                                            ...(localData as TextBlockData),
                                            title: value,
                                        } as TextBlockData)
                                    }
                                    placeholder="Заголовок раздела..."
                                    minHeight="60px"
                                    defaultFontSize="40"
                                    mode="inline"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Описание (опционально)
                                </label>
                                <FormattedTextEditor
                                    editorId={`${block.id}:text-content`}
                                    value={
                                        (localData as TextBlockData).content ||
                                        ''
                                    }
                                    onChange={(value) =>
                                        setLocalData({
                                            ...(localData as TextBlockData),
                                            content: value,
                                        } as TextBlockData)
                                    }
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
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Заголовок (опционально)
                                </label>
                                <FormattedTextEditor
                                    editorId={`${block.id}:screenshot-title`}
                                    value={
                                        (localData as ScreenshotBlockData)
                                            .title || ''
                                    }
                                    onChange={(value) =>
                                        setLocalData({
                                            ...(localData as ScreenshotBlockData),
                                            title: value,
                                        } as ScreenshotBlockData)
                                    }
                                    placeholder="Заголовок блока..."
                                    minHeight="60px"
                                    defaultFontSize="40"
                                    mode="inline"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Описание (опционально)
                                </label>
                                <FormattedTextEditor
                                    editorId={`${block.id}:screenshot-description`}
                                    value={
                                        (localData as ScreenshotBlockData)
                                            .description || ''
                                    }
                                    onChange={(value) =>
                                        setLocalData({
                                            ...(localData as ScreenshotBlockData),
                                            description: value,
                                        } as ScreenshotBlockData)
                                    }
                                    placeholder="Описание..."
                                    minHeight="200px"
                                    defaultFontSize="20"
                                    mode="block"
                                />
                            </div>

                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Изображения
                                </label>
                                <div className="space-y-3">
                                    {(
                                        localData as ScreenshotBlockData
                                    ).images?.map((img, idx) => (
                                        <div
                                            key={img.uploadId || `img-${idx}-${img.url}`}
                                            className="border border-zinc-700 rounded p-3 bg-zinc-800"
                                        >
                                            <div className="flex gap-3">
                                                <img
                                                    src={img.url}
                                                    alt={img.alt}
                                                    className="w-24 h-24 object-cover rounded"
                                                />
                                                <div className="flex-1 space-y-2">
                                                    <input
                                                        type="text"
                                                        value={
                                                            img.caption || ''
                                                        }
                                                        onChange={(e) =>
                                                            handleUpdateImageCaption(
                                                                idx,
                                                                e.target.value,
                                                                e.currentTarget
                                                            )
                                                        }
                                                        placeholder="Подпись к изображению..."
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={img.alt || ''}
                                                        onChange={(e) =>
                                                            handleUpdateImageAlt(
                                                                idx,
                                                                e.target.value,
                                                                e.currentTarget
                                                            )
                                                        }
                                                        placeholder="Alt текст..."
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                                                    />
                                                    <div className="flex flex-wrap items-center gap-5">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Размер</span>
                                                            <select
                                                                aria-label="Размер изображения"
                                                                value={img.fit === 'auto-height' || img.fit === 'vertical' ? 'auto-height' : 'auto-width'}
                                                                onChange={(e) =>
                                                                    handleUpdateImageFit(
                                                                        idx,
                                                                        e.target.value as 'auto-width' | 'auto-height'
                                                                    )
                                                                }
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
                                                                        <button
                                                                            key={a}
                                                                            type="button"
                                                                            onClick={() => handleUpdateImageAlign(idx, a)}
                                                                            title={label}
                                                                            aria-label={label}
                                                                            className={`cursor-pointer rounded-md p-1.5 transition-colors hover:bg-zinc-700/80 ${active ? 'bg-blue-600/25 text-blue-400 ring-1 ring-blue-500/50' : 'text-zinc-400 hover:text-zinc-200'}`}
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
                                                    onClick={() =>
                                                        handleRemoveImage(idx)
                                                    }
                                                    className="self-start p-1 hover:bg-red-900 rounded text-red-400 cursor-pointer"
                                                    title="Удалить изображение"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`flex cursor-pointer items-center justify-center gap-2 rounded border-2 p-4 transition-all ${isDragOver
                                            ? 'border-blue-500 bg-blue-500/10 border-solid'
                                            : 'border-zinc-700 border-dashed hover:bg-zinc-800'
                                            }`}
                                    >
                                        <label className="flex w-full cursor-pointer items-center justify-center gap-2">
                                            <Upload className="w-5 h-5 text-zinc-400" />
                                            <span className="text-sm text-zinc-300">
                                                {uploading
                                                    ? 'Загрузка...'
                                                    : isDragOver
                                                        ? 'Отпустите для загрузки'
                                                        : 'Перетащите изображения или нажмите для выбора'}
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={handleImageUpload}
                                                disabled={uploading}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Расположение фото
                                </label>
                                <select
                                    aria-label="Расположение фото"
                                    value={
                                        (localData as ScreenshotBlockData)
                                            .layout || 'full-width'
                                    }
                                    onChange={(e) =>
                                        setLocalData({
                                            ...(localData as ScreenshotBlockData),
                                            layout: e.target
                                                .value as ScreenshotBlockData['layout'],
                                        } as ScreenshotBlockData)
                                    }
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="full-width">
                                        Друг под другом
                                    </option>
                                    <option value="two-column">
                                        Слева-справа (2 колонки)
                                    </option>
                                    <option value="sidebar">
                                        Текст слева, фото справа
                                    </option>
                                    <option value="sidebar-reverse">
                                        Фото слева, текст справа
                                    </option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default function EditReportPage() {
    const router = useRouter();
    const params = useParams();
    const reportId = params.id as string;
    const { canEdit, loading: roleLoading } = useUserRole();

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
    } = useReportDraftSync(reportId);

    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [ancestors, setAncestors] = useState<GroupAncestor[]>([]);

    useEffect(() => {
        if (!reportId) return;
        void fetch(`/api/reports/${reportId}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.ancestors) {
                    setAncestors(data.ancestors);
                }
            })
            .catch(() => setAncestors([]));
    }, [reportId, report?.version]);

    const headerBreadcrumbs = useMemo(() => {
        if (!report) {
            return [
                { label: 'Группы', href: '/' },
                { label: 'Редактор' },
            ];
        }
        return buildReportEditBreadcrumbs(
            ancestors,
            report.group,
            report.title || 'Отчёт',
            reportId
        );
    }, [ancestors, report, reportId]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Всегда сортируем блоки по позиции перед рендерингом
    const sortedBlocks = useMemo(() => {
        return [...blocks].sort((a, b) => a.position - b.position);
    }, [blocks]);

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
            case 'local':
                return '● Есть локальные изменения';
            case 'autosaving':
                return '↻ Автосохранение...';
            case 'saving':
                return '↻ Сохранение черновика...';
            case 'conflict':
                return '⚠ Конфликт';
            case 'error':
                return '⚠ Ошибка';
            default:
                if (hasUnpublishedChanges) {
                    return '● Есть неопубликованные изменения';
                }
                if (report?.publishedHash) {
                    return '✓ Опубликовано';
                }
                return '✓ Черновик сохранён';
        }
    }, [hasUnpublishedChanges, report?.publishedHash, syncStatus]);

    const canPublish = useMemo(() => {
        if (!report) return false;
        return !publishing && syncStatus !== 'saving' && syncStatus !== 'autosaving' && (
            hasLocalChanges ||
            hasUnpublishedChanges ||
            !report.publishedHash
        );
    }, [
        hasLocalChanges,
        hasUnpublishedChanges,
        publishing,
        report,
        syncStatus,
    ]);

    const handleSaveDraft = useCallback(async () => {
        const ok = await flush({ reason: 'manual' });
        if (ok) alert('Черновик сохранён');
    }, [flush]);

    const handlePublish = useCallback(async () => {
        const ok = await publish();
        if (ok) alert('Отчёт опубликован');
    }, [publish]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const currentSorted = [...blocks].sort((a, b) => a.position - b.position);
        const oldIndex = currentSorted.findIndex((b) => b.id === active.id);
        const newIndex = currentSorted.findIndex((b) => b.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        const reorderedBlocks = arrayMove(currentSorted, oldIndex, newIndex);
        replaceBlocksLocally(
            reorderedBlocks.map((block, index) => ({
                ...block,
                position: index,
            }))
        );
    }, [blocks, replaceBlocksLocally]);

    const handleDeleteBlock = useCallback((id: string) => {
        if (!confirm('Удалить блок?')) return;

        const nextBlocks = blocks
            .filter((block) => block.id !== id)
            .sort((a, b) => a.position - b.position)
            .map((block, index) => ({
                ...block,
                position: index,
            }));

        replaceBlocksLocally(nextBlocks);
        setSelectedBlockId((currentSelectedId) =>
            currentSelectedId === id ? nextBlocks[0]?.id || null : currentSelectedId
        );
    }, [blocks, replaceBlocksLocally]);

    const handleDuplicateBlock = useCallback((id: string) => {
        const blockToDup = blocks.find((b) => b.id === id);
        if (!blockToDup) return;

        const duplicatedBlock: ReportBlockFromDB = {
            ...blockToDup,
            id: crypto.randomUUID(),
            position: blocks.length,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            data: JSON.parse(JSON.stringify(blockToDup.data)) as ReportBlockFromDB['data'],
        };

        replaceBlocksLocally(
            [...blocks, duplicatedBlock].map((block, index) => ({
                ...block,
                position: index,
            }))
        );
        setSelectedBlockId(duplicatedBlock.id);
    }, [blocks, replaceBlocksLocally]);

    const handleAddBlock = useCallback((type: 'text' | 'screenshot' | 'divider') => {
        if (!reportId || !report) return;

        const newBlock: ReportBlockFromDB = {
            id: crypto.randomUUID(),
            reportId,
            type,
            position: blocks.length,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            data:
                type === 'text'
                    ? {
                          title: '',
                          content: '',
                      }
                    : type === 'divider'
                      ? {}
                      : {
                            title: '',
                            description: '',
                            images: [],
                            layout: 'full-width',
                        },
        };

        replaceBlocksLocally(
            [...blocks, newBlock].map((block, index) => ({
                ...block,
                position: index,
            }))
        );
        setSelectedBlockId(newBlock.id);
    }, [blocks, report, reportId, replaceBlocksLocally]);

    const handleSelectBlock = useCallback((id: string) => {
        setSelectedBlockId(id);
    }, []);

    useEffect(() => {
        if (!roleLoading && !canEdit) {
            router.push(`/reports/${reportId}`);
            return;
        }
        if (canEdit && reportId) {
            void loadReport().then((merged) => {
                if (merged && merged.blocks.length > 0) {
                    setSelectedBlockId(merged.blocks[0].id);
                }
            });
        }
    }, [reportId, canEdit, roleLoading, router, loadReport]);

    useEffect(() => {
        if (report && !report.date) {
            markMetadataDirty({ date: new Date().toISOString().split('T')[0] });
        }
    }, [report, markMetadataDirty]);

    // Scroll to selected block
    useEffect(() => {
        if (selectedBlockId) {
            const element = document.getElementById(`block-${selectedBlockId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [selectedBlockId]);

    if (roleLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950">
                <div className="text-zinc-400">Загрузка...</div>
            </div>
        );
    }

    if (!canEdit) {
        return null; // Редирект уже произошел
    }

    if (loading)
        return (
            <div className="p-8 bg-zinc-950 text-white min-h-screen">
                Загрузка...
            </div>
        );
    if (!report)
        return (
            <div className="p-8 bg-zinc-950 text-white min-h-screen">
                Отчет не найден
            </div>
        );

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col">
            <div className="flex flex-col border-b border-zinc-800 bg-zinc-900">
                <AppPageHeader
                    variant="editor"
                    onLogout={handleLogout}
                    breadcrumbs={headerBreadcrumbs}
                    title="Конструктор отчёта"
                    description={stripHtmlLabel(report.title || '') || undefined}
                    actions={
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm text-zinc-400 px-1 py-2">
                                {syncStatusLabel}
                            </span>
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={
                                    syncStatus === 'saving' ||
                                    syncStatus === 'autosaving'
                                }
                                className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 flex items-center gap-2 text-zinc-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                {syncStatus === 'saving'
                                    ? 'Сохранение...'
                                    : 'Сохранить черновик'}
                            </button>
                            <button
                                type="button"
                                onClick={handlePublish}
                                disabled={!canPublish}
                                className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 flex items-center gap-2 text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                {publishing
                                    ? 'Публикация...'
                                    : canPublish
                                      ? 'Опубликовать'
                                      : 'Уже опубликовано'}
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(`/reports/${reportId}`)
                                }
                                className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 flex items-center gap-2 text-zinc-200 cursor-pointer"
                            >
                                <Eye className="w-4 h-4" />
                                Просмотр
                            </button>
                        </div>
                    }
                />
            </div>

            <div className="flex-1 flex">
                {/* Левая колонка - Редактирование */}
                <div className="flex-1 overflow-y-auto p-6 h-[calc(100vh-120px)]">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Meta Section */}
                        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">
                                Метаданные отчёта
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                        Название отчёта *
                                    </label>
                                    <FormattedTextEditor
                                        editorId="report:title"
                                        value={report.title}
                                        onChange={(value) =>
                                            markMetadataDirty({ title: value })
                                        }
                                        placeholder="Отчёт по аудиту сайта"
                                        minHeight="60px"
                                        defaultFontSize="40"
                                        mode="inline"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                        Описание (опционально)
                                    </label>
                                    <FormattedTextEditor
                                        editorId="report:subtitle"
                                        value={report.subtitle || ''}
                                        onChange={(value) =>
                                            markMetadataDirty({ subtitle: value })
                                        }
                                        placeholder="Анализ производительности и SEO"
                                        mode="block"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                        Дата
                                    </label>
                                    <input
                                        type="date"
                                        aria-label="Дата отчета"
                                        value={
                                            report.date ||
                                            new Date()
                                                .toISOString()
                                                .split('T')[0]
                                        }
                                        onChange={(e) =>
                                            markMetadataDirty({
                                                date: e.target.value,
                                            })
                                        }
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
                                    />
                                </div>

                                {/* Настройки размера шрифта */}
                                <div className="mt-6 pt-6 border-t border-zinc-700">
                                    <h3 className="text-sm font-semibold text-zinc-300 mb-4">
                                        Размеры шрифта
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                                Заголовок
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={
                                                        report.titleFontSize ||
                                                        '40'
                                                    }
                                                    onChange={(e) => {
                                                        const input = e.currentTarget;
                                                        const cursorPosition = input.selectionStart || 0;
                                                        markMetadataDirty({
                                                            titleFontSize:
                                                                e.target.value || null,
                                                        });
                                                        setTimeout(() => {
                                                            input.setSelectionRange(cursorPosition, cursorPosition);
                                                        }, 0);
                                                    }}
                                                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    placeholder="40"
                                                    min="8"
                                                    max="200"
                                                />
                                                <span className="text-sm text-zinc-400">
                                                    px
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                                Описание
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={
                                                        report.descriptionFontSize ||
                                                        '20'
                                                    }
                                                    onChange={(e) => {
                                                        const input = e.currentTarget;
                                                        const cursorPosition = input.selectionStart || 0;
                                                        markMetadataDirty({
                                                            descriptionFontSize:
                                                                e.target.value || null,
                                                        });
                                                        setTimeout(() => {
                                                            input.setSelectionRange(cursorPosition, cursorPosition);
                                                        }, 0);
                                                    }}
                                                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    placeholder="20"
                                                    min="8"
                                                    max="200"
                                                />
                                                <span className="text-sm text-zinc-400">
                                                    px
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                                Текст под изображением
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={
                                                        report.captionFontSize ||
                                                        '16'
                                                    }
                                                    onChange={(e) => {
                                                        const input = e.currentTarget;
                                                        const cursorPosition = input.selectionStart || 0;
                                                        markMetadataDirty({
                                                            captionFontSize:
                                                                e.target.value || null,
                                                        });
                                                        setTimeout(() => {
                                                            input.setSelectionRange(cursorPosition, cursorPosition);
                                                        }, 0);
                                                    }}
                                                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    placeholder="16"
                                                    min="8"
                                                    max="200"
                                                />
                                                <span className="text-sm text-zinc-400">
                                                    px
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Все блоки */}
                        {sortedBlocks.length === 0 ? (
                            <div className="text-center py-16 text-zinc-500 bg-zinc-900 rounded-lg border border-zinc-800">
                                <p>Нет блоков</p>
                                <p className="text-sm text-zinc-600 mt-2">
                                    Добавьте первый блок через панель справа
                                </p>
                            </div>
                        ) : (
                            sortedBlocks.map((block) => (
                                <div
                                    key={block.id}
                                    id={`block-${block.id}`}
                                    className={`transition-all ${selectedBlockId === block.id
                                        ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-950'
                                        : ''
                                        }`}
                                >
                                    <BlockEditor
                                        block={block}
                                        onLocalChange={markBlockDirty}
                                        reportId={reportId}
                                        groupId={report?.groupId}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Правая колонка - Список блоков */}
                <div className="w-96 border-l border-zinc-800 bg-zinc-900 flex flex-col min-h-[calc(100vh-120px)]">
                    <div className="p-4 border-b border-zinc-800">
                        <h2 className="text-lg font-semibold text-white mb-3">
                            Блоки ({sortedBlocks.length})
                        </h2>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => handleAddBlock('text')}
                                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium cursor-pointer"
                            >
                                + Текст
                            </button>
                            <button
                                onClick={() => handleAddBlock('screenshot')}
                                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium cursor-pointer"
                            >
                                + Фото
                            </button>
                            <button
                                onClick={() => handleAddBlock('divider')}
                                className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs font-medium cursor-pointer"
                            >
                                + HR
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={sortedBlocks.map((b) => b.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {sortedBlocks.map((block) => (
                                    <SortableBlockCard
                                        key={block.id}
                                        block={block}
                                        isSelected={
                                            selectedBlockId === block.id
                                        }
                                        onSelect={handleSelectBlock}
                                        onDelete={handleDeleteBlock}
                                        onDuplicate={handleDuplicateBlock}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        {sortedBlocks.length === 0 && (
                            <div className="text-center py-12 text-zinc-500">
                                <p className="text-sm">Нет блоков</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
