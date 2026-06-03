'use client';

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
    Home,
    ChevronDown,
    ChevronUp,
    Copy,
    Upload,
    X,
    Save,
    Bold,
    Italic,
    Palette,
    AlignCenter,
    AlignLeft,
    AlignRight,
    LogOut,
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

    const blockTitle = useMemo(() => {
        if (block.type === 'text') {
            const data = block.data as TextBlockData;
            if (data.title) return data.title.substring(0, 30);
            if (data.content) return data.content.substring(0, 30);
            return 'Текстовый блок';
        } else if (block.type === 'screenshot') {
            const data = block.data as ScreenshotBlockData;
            if (data.title) return data.title.substring(0, 30);
            return `Фото (${data.images?.length || 0})`;
        } else {
            return 'Разделитель';
        }
    }, [block.type, block.data]);

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
                    <span
                        className={`px-2.5 py-1 text-xs font-medium rounded ${block.type === 'text'
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 text-white'
                            }`}
                    >
                        {block.type === 'text' ? 'Текст' : 'Фото'}
                    </span>
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
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Описание (опционально)
                                </label>
                                <FormattedTextEditor
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
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Описание (опционально)
                                </label>
                                <FormattedTextEditor
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

// Компонент для форматированного текстового редактора
const FormattedTextEditor = memo(function FormattedTextEditor({
    value,
    onChange,
    placeholder,
    minHeight = '200px',
    defaultFontSize = '20',
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minHeight?: string;
    defaultFontSize?: string;
}) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [customColor, setCustomColor] = useState('#ffffff');
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isCentered, setIsCentered] = useState(false);
    const [currentColor, setCurrentColor] = useState('#ffffff');
    const [hasCustomColor, setHasCustomColor] = useState(false);
    const savedSelectionRef = useRef<Range | null>(null);
    const isEditingRef = useRef(false);
    const onChangeDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // Цвета сайта
    const siteColors = useMemo(() => [
        { name: 'Primary', value: '#3b82f6' },
        { name: 'Grayscale-2', value: '#f5f5f5' },
        { name: 'Grayscale-3', value: '#e8e8e8' },
        { name: 'Grayscale-4', value: '#d4d4d4' },
        { name: 'Grayscale-5', value: '#a3a3a3' },
        { name: 'Grayscale-6', value: '#737373' },
        { name: 'Белый', value: '#ffffff' },
    ], []);

    // Получаем последние выбранные цвета из localStorage
    const getRecentColors = (): string[] => {
        if (typeof window === 'undefined') return [];
        try {
            const stored = localStorage.getItem('formattedTextEditor_recentColors');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    };

    // Сохраняем цвет в последние
    const saveRecentColor = (color: string) => {
        if (typeof window === 'undefined') return;
        try {
            const recent = getRecentColors();
            // Удаляем если уже есть
            const filtered = recent.filter((c) => c !== color);
            // Добавляем в начало
            const updated = [color, ...filtered].slice(0, 8); // Максимум 8 последних
            localStorage.setItem('formattedTextEditor_recentColors', JSON.stringify(updated));
        } catch {
            // Игнорируем ошибки
        }
    };

    const [recentColors, setRecentColors] = useState<string[]>(getRecentColors());

    // Функция для конвертации текста с переносами строк в HTML
    const convertTextToHtml = (text: string): string => {
        if (!text || text.trim() === '') return '';
        // Если текст уже содержит HTML теги, возвращаем как есть
        if (text.includes('<') && text.includes('>')) {
            return text;
        }
        // Иначе конвертируем переносы строк в <br>
        const lines = text.split('\n');
        if (lines.length === 1) {
            return lines[0] || '';
        }
        return lines
            .map((line, index) => {
                if (index === lines.length - 1 && line === '') {
                    // Последняя пустая строка - не добавляем br
                    return '';
                }
                return line || '<br>';
            })
            .join('<br>');
    };

    // Эффект для очистки стилей при монтировании и изменениях
    useEffect(() => {
        if (editorRef.current) {
            const cleanupStyles = () => {
                if (!editorRef.current) return;

                // Убираем отступы у самого редактора
                editorRef.current.style.margin = '0';
                editorRef.current.style.textIndent = '0';
                editorRef.current.style.fontSize = ''; // Убираем fontSize у самого редактора

                // Убираем отступы у всех дочерних элементов, но сохраняем fontSize в style (для HTML)
                const allElements = editorRef.current.querySelectorAll('*');
                allElements.forEach((el) => {
                    const htmlEl = el as HTMLElement;
                    const fontSize = htmlEl.style.fontSize; // Сохраняем размер шрифта
                    htmlEl.style.margin = '0';
                    htmlEl.style.marginLeft = '0';
                    htmlEl.style.marginRight = '0';
                    htmlEl.style.marginTop = '0';
                    htmlEl.style.marginBottom = '0';
                    htmlEl.style.paddingLeft = '0';
                    htmlEl.style.paddingRight = '0';
                    htmlEl.style.textIndent = '0';
                    // fontSize сохраняем в style для HTML, но визуально он будет переопределен через CSS
                    if (fontSize) {
                        htmlEl.style.fontSize = fontSize; // Сохраняем в HTML
                    }
                });
            };

            cleanupStyles();

            // Наблюдаем за изменениями DOM
            const observer = new MutationObserver(() => {
                cleanupStyles();
            });
            observer.observe(editorRef.current, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style']
            });

            return () => {
                observer.disconnect();
            };
        }
    }, []);

    useEffect(() => {
        if (editorRef.current && !isEditingRef.current) {
            const htmlValue = convertTextToHtml(value || '');
            // Не обновляем если редактор в фокусе и содержимое не изменилось
            const isFocused = document.activeElement === editorRef.current;
            if (isFocused && editorRef.current.innerHTML === htmlValue) {
                return;
            }

            // Сохраняем позицию курсора перед обновлением
            const selection = window.getSelection();
            let savedRange: Range | null = null;
            let savedOffset = 0;

            if (selection && selection.rangeCount > 0 && editorRef.current.contains(selection.anchorNode)) {
                const range = selection.getRangeAt(0);
                savedRange = range.cloneRange();
                // Сохраняем смещение от начала контейнера
                try {
                    const preRange = range.cloneRange();
                    preRange.selectNodeContents(editorRef.current);
                    preRange.setEnd(range.startContainer, range.startOffset);
                    savedOffset = preRange.toString().length;
                } catch {
                    // Если не удалось вычислить смещение, используем range
                }
            }

            // Обновляем содержимое
            editorRef.current.innerHTML = htmlValue;

            // Убираем лишние отступы после обновления, но сохраняем fontSize в HTML
            const allElements = editorRef.current.querySelectorAll('*');
            allElements.forEach((el) => {
                const htmlEl = el as HTMLElement;
                const fontSize = htmlEl.style.fontSize; // Сохраняем размер шрифта
                htmlEl.style.margin = '0';
                htmlEl.style.marginLeft = '0';
                htmlEl.style.marginRight = '0';
                htmlEl.style.marginTop = '0';
                htmlEl.style.marginBottom = '0';
                htmlEl.style.paddingLeft = '0';
                htmlEl.style.paddingRight = '0';
                htmlEl.style.textIndent = '0';
                // fontSize сохраняем в style для HTML, визуально переопределяется через CSS
                if (fontSize) {
                    htmlEl.style.fontSize = fontSize; // Сохраняем в HTML
                }
            });
            editorRef.current.style.margin = '0';
            editorRef.current.style.textIndent = '0';
            editorRef.current.style.fontSize = ''; // Убираем fontSize у самого редактора

            // Восстанавливаем позицию курсора после обновления
            if (editorRef.current) {
                try {
                    const newSelection = window.getSelection();
                    if (newSelection) {
                        // Пытаемся восстановить по сохраненному range
                        if (savedRange && editorRef.current.contains(savedRange.startContainer)) {
                            newSelection.removeAllRanges();
                            newSelection.addRange(savedRange);
                        } else if (savedOffset > 0) {
                            // Пытаемся восстановить по смещению
                            const textContent = editorRef.current.textContent || '';
                            const targetOffset = Math.min(savedOffset, textContent.length);
                            const range = document.createRange();
                            const walker = document.createTreeWalker(
                                editorRef.current,
                                NodeFilter.SHOW_TEXT,
                                null
                            );

                            let currentOffset = 0;
                            let targetNode: Node | null = null;
                            let targetNodeOffset = 0;

                            while (walker.nextNode()) {
                                const node = walker.currentNode;
                                const nodeLength = node.textContent?.length || 0;
                                if (currentOffset + nodeLength >= targetOffset) {
                                    targetNode = node;
                                    targetNodeOffset = targetOffset - currentOffset;
                                    break;
                                }
                                currentOffset += nodeLength;
                            }

                            if (targetNode) {
                                range.setStart(targetNode, targetNodeOffset);
                                range.collapse(true);
                                newSelection.removeAllRanges();
                                newSelection.addRange(range);
                            } else {
                                // Fallback: ставим курсор в конец
                                const range = document.createRange();
                                range.selectNodeContents(editorRef.current);
                                range.collapse(false);
                                newSelection.removeAllRanges();
                                newSelection.addRange(range);
                            }
                        } else if (isFocused) {
                            // Если был в фокусе, ставим курсор в конец
                            const range = document.createRange();
                            range.selectNodeContents(editorRef.current);
                            range.collapse(false);
                            newSelection.removeAllRanges();
                            newSelection.addRange(range);
                        }
                    }
                } catch (e) {
                    // Если не удалось восстановить, ставим курсор в конец только если был в фокусе
                    if (isFocused) {
                        const newSelection = window.getSelection();
                        if (newSelection && editorRef.current) {
                            const range = document.createRange();
                            range.selectNodeContents(editorRef.current);
                            range.collapse(false);
                            newSelection.removeAllRanges();
                            newSelection.addRange(range);
                        }
                    }
                }
            }
        }
    }, [value]);

    // Функция для проверки активных стилей выделенного текста
    const checkActiveStyles = () => {
        if (!editorRef.current) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            setIsBold(false);
            setIsItalic(false);
            setIsCentered(false);
            setCurrentColor('#ffffff');
            setHasCustomColor(false);
            return;
        }

        const range = selection.getRangeAt(0);
        if (!editorRef.current.contains(range.commonAncestorContainer)) {
            setIsBold(false);
            setIsItalic(false);
            setIsCentered(false);
            setCurrentColor('#ffffff');
            setHasCustomColor(false);
            return;
        }

        // Проверяем bold
        const isBoldActive = document.queryCommandState('bold');
        setIsBold(isBoldActive);

        // Проверяем italic
        const isItalicActive = document.queryCommandState('italic');
        setIsItalic(isItalicActive);

        // Проверяем выравнивание по центру
        const isCenteredActive = document.queryCommandState('justifyCenter');
        setIsCentered(isCenteredActive);

        // Проверяем цвет через computed style выделенного элемента
        try {
            let colorFound = false;
            if (range && !range.collapsed) {
                const container = range.commonAncestorContainer;
                const element =
                    container.nodeType === Node.TEXT_NODE
                        ? container.parentElement
                        : (container as Element);

                if (element) {
                    const computedStyle = window.getComputedStyle(element);
                    const color = computedStyle.color;

                    if (
                        color &&
                        color !== 'rgb(0, 0, 0)' &&
                        color !== 'rgb(255, 255, 255)' &&
                        color !== 'rgb(228, 228, 231)' // дефолтный цвет текста в редакторе (zinc-200)
                    ) {
                        // Конвертируем rgb в hex
                        let hexColor = color;
                        if (color.startsWith('rgb')) {
                            const rgb = color.match(/\d+/g);
                            if (rgb && rgb.length >= 3) {
                                hexColor =
                                    '#' +
                                    rgb
                                        .slice(0, 3)
                                        .map((x) => {
                                            const hex =
                                                parseInt(x).toString(16);
                                            return hex.length === 1
                                                ? '0' + hex
                                                : hex;
                                        })
                                        .join('');
                            }
                        }
                        setCurrentColor(hexColor);
                        setCustomColor(hexColor);
                        setHasCustomColor(true);
                        colorFound = true;
                    } else {
                        setHasCustomColor(false);
                    }
                }
            }

            // Fallback на queryCommandValue если не нашли через computed style
            if (!colorFound) {
                const color = document.queryCommandValue('foreColor');
                if (
                    color &&
                    color !== 'rgb(0, 0, 0)' &&
                    color !== '#000000' &&
                    color !== 'rgb(255, 255, 255)' &&
                    color !== '#ffffff'
                ) {
                    let hexColor = color;
                    if (color.startsWith('rgb')) {
                        const rgb = color.match(/\d+/g);
                        if (rgb && rgb.length >= 3) {
                            hexColor =
                                '#' +
                                rgb
                                    .slice(0, 3)
                                    .map((x) => {
                                        const hex = parseInt(x).toString(16);
                                        return hex.length === 1
                                            ? '0' + hex
                                            : hex;
                                    })
                                    .join('');
                        }
                    }
                    // Проверяем что это не дефолтный цвет редактора
                    if (hexColor !== '#e4e4e7') {
                        setCurrentColor(hexColor);
                        setCustomColor(hexColor);
                        setHasCustomColor(true);
                    } else {
                        setHasCustomColor(false);
                    }
                } else {
                    setCurrentColor('#ffffff');
                    setHasCustomColor(false);
                }
            }
        } catch {
            setCurrentColor('#ffffff');
            setHasCustomColor(false);
        }
    };

    // Отслеживание изменений выделения
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const handleSelectionChange = () => {
            checkActiveStyles();
        };

        const handleMouseUp = () => {
            setTimeout(checkActiveStyles, 10);
        };

        const handleKeyUp = () => {
            setTimeout(checkActiveStyles, 10);
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        editor.addEventListener('mouseup', handleMouseUp);
        editor.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener(
                'selectionchange',
                handleSelectionChange
            );
            editor.removeEventListener('mouseup', handleMouseUp);
            editor.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Инициализация последних цветов при монтировании
    useEffect(() => {
        setRecentColors(getRecentColors());
    }, []);

    // Cleanup debounce таймера при размонтировании
    useEffect(() => {
        return () => {
            if (onChangeDebounceRef.current) {
                clearTimeout(onChangeDebounceRef.current);
            }
        };
    }, []);

    // Сохранение выделения при открытии color picker
    const handleColorPickerToggle = () => {
        if (!showColorPicker) {
            // Сохраняем выделение перед открытием
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && editorRef.current) {
                const range = selection.getRangeAt(0);
                if (editorRef.current.contains(range.commonAncestorContainer)) {
                    savedSelectionRef.current = range.cloneRange();
                }
            }
        }
        setShowColorPicker(!showColorPicker);
    };

    // Закрытие color picker при клике вне его
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                colorPickerRef.current &&
                !colorPickerRef.current.contains(event.target as Node)
            ) {
                setShowColorPicker(false);
            }
        };

        if (showColorPicker) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showColorPicker]);

    const handleInput = () => {
        if (editorRef.current) {
            isEditingRef.current = true;

            // Убираем лишние отступы при каждом изменении, но сохраняем fontSize в HTML
            const allElements = editorRef.current.querySelectorAll('*');
            allElements.forEach((el) => {
                const htmlEl = el as HTMLElement;
                const fontSize = htmlEl.style.fontSize; // Сохраняем размер шрифта
                htmlEl.style.margin = '0';
                htmlEl.style.marginLeft = '0';
                htmlEl.style.marginRight = '0';
                htmlEl.style.marginTop = '0';
                htmlEl.style.marginBottom = '0';
                htmlEl.style.paddingLeft = '0';
                htmlEl.style.paddingRight = '0';
                htmlEl.style.textIndent = '0';
                // fontSize сохраняем в style для HTML, визуально переопределяется через CSS
                if (fontSize) {
                    htmlEl.style.fontSize = fontSize; // Сохраняем в HTML
                }
            });
            editorRef.current.style.margin = '0';
            editorRef.current.style.textIndent = '0';
            editorRef.current.style.fontSize = ''; // Убираем fontSize у самого редактора

            const html = editorRef.current.innerHTML.trim();
            // Если содержимое пустое или только пробелы/br, сохраняем пустую строку
            const finalValue = (!html ||
                html === '<br>' ||
                html === '<div><br></div>' ||
                html === '<br><br>' ||
                html.replace(/<br\s*\/?>/gi, '').trim() === '') ? '' : html;

            // Используем debounce для onChange, чтобы не вызывать его слишком часто
            if (onChangeDebounceRef.current) {
                clearTimeout(onChangeDebounceRef.current);
            }

            onChangeDebounceRef.current = setTimeout(() => {
                onChange(finalValue);
                // Сбрасываем флаг редактирования после небольшой задержки
                setTimeout(() => {
                    isEditingRef.current = false;
                }, 50);
            }, 100);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();

        // Получаем только текст из буфера обмена, без форматирования
        const text = e.clipboardData.getData('text/plain');

        if (!editorRef.current || !text) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        // Удаляем выделенный текст, если есть
        range.deleteContents();

        // Разбиваем текст на строки и вставляем с сохранением переносов
        const lines = text.split('\n');

        lines.forEach((line, index) => {
            if (line.trim() || line === '') {
                // Вставляем текстовый узел для каждой строки (включая пустые)
                const textNode = document.createTextNode(line);
                range.insertNode(textNode);
                // Перемещаем курсор после вставленного текста
                range.setStartAfter(textNode);
            }

            // Добавляем <br> для переноса строки (кроме последней строки)
            if (index < lines.length - 1) {
                const br = document.createElement('br');
                range.insertNode(br);
                range.setStartAfter(br);
            }
        });

        // Перемещаем курсор в конец вставленного текста
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);

        // Обновляем состояние
        handleInput();
    };

    const formatText = (command: string, value?: string) => {
        if (!editorRef.current) return;

        // Используем сохраненное выделение или текущее
        let savedRange: Range | null = savedSelectionRef.current;
        const selection = window.getSelection();

        // Если есть сохраненное выделение, используем его, иначе текущее
        if (!savedRange && selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (editorRef.current.contains(range.commonAncestorContainer)) {
                savedRange = range.cloneRange();
                savedSelectionRef.current = savedRange;
            }
        }

        if (savedRange && editorRef.current.contains(savedRange.startContainer)) {
            // Фокусируемся на редакторе
            editorRef.current.focus();

            // Восстанавливаем выделение перед применением команды
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(savedRange);
            }

            // Применяем форматирование
            document.execCommand(command, false, value);

            // Восстанавливаем выделение после применения
            setTimeout(() => {
                const newSelection = window.getSelection();
                if (newSelection && savedRange && editorRef.current) {
                    try {
                        // Пытаемся восстановить выделение
                        if (editorRef.current.contains(savedRange.startContainer)) {
                            newSelection.removeAllRanges();
                            newSelection.addRange(savedRange);
                        } else {
                            // Если не удалось, просто фокусируемся
                            editorRef.current.focus();
                        }
                    } catch (e) {
                        // Если не удалось, просто фокусируемся
                        editorRef.current.focus();
                    }
                }
                checkActiveStyles();
            }, 0);

            handleInput();
        }
    };

    const handleColorChange = (color: string) => {
        formatText('foreColor', color);
        setCurrentColor(color);
        setCustomColor(color);
        setHasCustomColor(true);

        // Сохраняем цвет в последние
        saveRecentColor(color);
        setRecentColors(getRecentColors());

        setShowColorPicker(false);
    };

    const handleCustomColorChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const color = e.target.value;
        setCustomColor(color);
        if (/^#[0-9A-F]{6}$/i.test(color)) {
            formatText('foreColor', color);
            setCurrentColor(color);
            setHasCustomColor(true);

            // Сохраняем цвет в последние
            saveRecentColor(color);
            setRecentColors(getRecentColors());
        }
    };

    const applyFontSize = (size: string) => {
        if (!editorRef.current) return;

        const selection = window.getSelection();
        if (!selection) return;

        if (selection.rangeCount === 0 || selection.isCollapsed) {
            // Если нет выделения или курсор без выделения, применяем ко всему содержимому
            editorRef.current.focus();

            // Выделяем весь текст
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            selection.removeAllRanges();
            selection.addRange(range);

            // Применяем размер через execCommand
            document.execCommand('fontSize', false, '7');

            // Находим все созданные font элементы и заменяем их на span с нужным размером
            const fontElements = editorRef.current.querySelectorAll('font[size="7"]');
            fontElements.forEach((fontEl) => {
                const span = document.createElement('span');
                span.style.fontSize = `${size}px`; // Сохраняем в HTML
                span.style.display = 'inline';

                // Переносим все дочерние элементы
                while (fontEl.firstChild) {
                    span.appendChild(fontEl.firstChild);
                }

                // Заменяем font на span
                fontEl.parentNode?.replaceChild(span, fontEl);
            });

            // Убираем выделение
            selection.removeAllRanges();
            handleInput();
            return;
        }

        const range = selection.getRangeAt(0);
        if (!editorRef.current.contains(range.commonAncestorContainer)) return;

        // Сохраняем выделение
        const savedRange = range.cloneRange();

        // Применяем размер через execCommand
        editorRef.current.focus();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(savedRange);

            document.execCommand('fontSize', false, '7');

            // Находим все созданные font элементы в выделенной области и заменяем их
            const fontElements = editorRef.current.querySelectorAll('font[size="7"]');
            fontElements.forEach((fontEl) => {
                const span = document.createElement('span');
                span.style.fontSize = `${size}px`; // Сохраняем в HTML
                span.style.display = 'inline';

                while (fontEl.firstChild) {
                    span.appendChild(fontEl.firstChild);
                }

                fontEl.parentNode?.replaceChild(span, fontEl);
            });

            // Восстанавливаем выделение
            try {
                selection.removeAllRanges();
                selection.addRange(savedRange);
            } catch (e) {
                // Игнорируем ошибки восстановления
            }
        }

        handleInput();
    };

    return (
        <div className="space-y-2">
            {/* Панель инструментов */}
            <div className="flex items-center gap-2 p-2 bg-zinc-800 border border-zinc-700 rounded-t">
                <button
                    type="button"
                    onClick={() => formatText('bold')}
                    className={`p-1.5 rounded transition-colors cursor-pointer ${isBold
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'hover:bg-zinc-700 text-zinc-300'
                        }`}
                    title="Жирный (Ctrl+B)"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => formatText('italic')}
                    className={`p-1.5 rounded transition-colors cursor-pointer ${isItalic
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'hover:bg-zinc-700 text-zinc-300'
                        }`}
                    title="Курсив (Ctrl+I)"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => formatText('justifyCenter')}
                    className={`p-1.5 rounded transition-colors cursor-pointer ${isCentered
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'hover:bg-zinc-700 text-zinc-300'
                        }`}
                    title="Выровнять по центру"
                >
                    <AlignCenter className="w-4 h-4" />
                </button>
                <div className="relative" ref={colorPickerRef}>
                    <button
                        type="button"
                        onClick={handleColorPickerToggle}
                        className={`p-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer ${showColorPicker
                            ? 'bg-zinc-700'
                            : 'hover:bg-zinc-700 text-zinc-300'
                            }`}
                        title="Цвет текста"
                    >
                        <Palette className="w-4 h-4" />
                        {hasCustomColor && (
                            <div
                                className="w-3 h-3 rounded border border-zinc-500"
                                style={{ backgroundColor: currentColor }}
                            />
                        )}
                    </button>
                    {showColorPicker && (
                        <div className="absolute left-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-3 shadow-lg z-50 min-w-[200px]">
                            {/* Последние выбранные цвета */}
                            {recentColors.length > 0 && (
                                <div className="mb-3">
                                    <label className="block text-xs text-zinc-400 mb-1">
                                        Последние
                                    </label>
                                    <div className="grid grid-cols-4 gap-1">
                                        {recentColors.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() =>
                                                    handleColorChange(color)
                                                }
                                                className="w-6 h-6 rounded border border-zinc-600 hover:scale-110 transition-transform cursor-pointer"
                                                style={{
                                                    backgroundColor: color,
                                                }}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Цвета сайта */}
                            <div className={recentColors.length > 0 ? "mb-3" : "mb-2"}>
                                <label className="block text-xs text-zinc-400 mb-1">
                                    {recentColors.length > 0 ? "Цвета сайта" : "Быстрые цвета"}
                                </label>
                                <div className="grid grid-cols-4 gap-1">
                                    {siteColors.map((color) => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            onClick={() =>
                                                handleColorChange(color.value)
                                            }
                                            className="w-6 h-6 rounded border border-zinc-600 hover:scale-110 transition-transform cursor-pointer"
                                            style={{
                                                backgroundColor: color.value,
                                            }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="pt-2 border-t border-zinc-700">
                                <label className="block text-xs text-zinc-400 mb-1">
                                    Выбрать цвет
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={customColor}
                                        onChange={handleCustomColorChange}
                                        aria-label="Выбрать цвет"
                                        className="w-10 h-8 rounded border border-zinc-600 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={customColor}
                                        placeholder="#000000"
                                        onChange={(e) => {
                                            const input = e.currentTarget;
                                            const cursorPosition = input.selectionStart || 0;
                                            const color = e.target.value;
                                            setCustomColor(color);
                                            if (/^#[0-9A-F]{6}$/i.test(color)) {
                                                formatText('foreColor', color);
                                                setCurrentColor(color);
                                                setHasCustomColor(true);
                                            }
                                            setTimeout(() => {
                                                input.setSelectionRange(cursorPosition, cursorPosition);
                                            }, 0);
                                        }}
                                        className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* Размер шрифта */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-700">
                    <span className="text-xs text-zinc-400 whitespace-nowrap">Размер:</span>
                    <input
                        type="number"
                        min="8"
                        max="200"
                        placeholder={defaultFontSize}
                        className="w-14 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.currentTarget;
                                const size = input.value;
                                if (size && parseInt(size) >= 8 && parseInt(size) <= 200) {
                                    applyFontSize(size);
                                    input.blur();
                                }
                            }
                        }}
                        onBlur={(e) => {
                            const size = e.target.value;
                            if (size && parseInt(size) >= 8 && parseInt(size) <= 200) {
                                applyFontSize(size);
                            }
                        }}
                    />
                    <span className="text-xs text-zinc-400">px</span>
                </div>
            </div>
            {/* Редактор */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onPaste={handlePaste}
                onFocus={(e) => {
                    // Убираем placeholder при фокусе
                    const el = e.currentTarget;
                    if (el.textContent?.trim() === '' && el.innerHTML === '<br>') {
                        el.innerHTML = '';
                    }
                }}
                onBlur={(e) => {
                    // Добавляем <br> если редактор пустой, чтобы placeholder работал
                    const el = e.currentTarget;
                    if (!el.textContent?.trim()) {
                        el.innerHTML = '<br>';
                    }
                }}
                className="w-full bg-zinc-800 border border-zinc-700 border-t-0 rounded-b px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none relative"
                style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    minHeight,
                    color: 'rgb(228, 228, 231)', // zinc-200 - убеждаемся что текст виден
                    margin: 0,
                    textIndent: 0,
                    textAlign: 'left',
                    fontSize: 'inherit' // Используем стандартный размер шрифта в редакторе
                }}
                data-placeholder={placeholder}
                suppressContentEditableWarning
            />
        </div>
    );
});

export default function EditReportPage() {
    const router = useRouter();
    const params = useParams();
    const reportId = params.id as string;
    const { isAdmin, loading: roleLoading } = useUserRole();

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
    const groupTarget = report?.group?.path ? `/${report.group.path}` : '/reports';

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
        if (!roleLoading && !isAdmin) {
            router.push(`/reports/${reportId}`);
            return;
        }
        if (isAdmin && reportId) {
            void loadReport().then((merged) => {
                if (merged && merged.blocks.length > 0) {
                    setSelectedBlockId(merged.blocks[0].id);
                }
            });
        }
    }, [reportId, isAdmin, roleLoading, router, loadReport]);

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

    if (!isAdmin) {
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
            <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push(groupTarget)}
                        className="p-2 hover:bg-zinc-800 rounded text-zinc-400 cursor-pointer"
                        title="К списку отчетов"
                    >
                        <Home className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-white">
                            Конструктор отчёта
                        </h1>
                        <p className="text-sm text-zinc-400">{report.title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400 px-3 py-2">
                        {syncStatusLabel}
                    </span>
                    <button
                        onClick={handleLogout}
                        className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-500/20 hover:border-red-500/30 flex items-center gap-2 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                        title="Выйти из системы"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleSaveDraft}
                        disabled={syncStatus === 'saving' || syncStatus === 'autosaving'}
                        className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 flex items-center gap-2 text-zinc-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {syncStatus === 'saving' ? 'Сохранение...' : 'Сохранить черновик'}
                    </button>
                    <button
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
                        onClick={() => router.push(`/reports/${reportId}`)}
                        className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 flex items-center gap-2 text-zinc-200 cursor-pointer"
                    >
                        <Eye className="w-4 h-4" />
                        Открыть отчёт
                    </button>
                </div>
            </header>

            <div className="flex-1 flex">
                {/* Левая колонка - Редактирование */}
                <div className="flex-1 overflow-y-auto p-6 h-[calc(100vh-73px)]">
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
                                        value={report.title}
                                        onChange={(value) =>
                                            markMetadataDirty({ title: value })
                                        }
                                        placeholder="Отчёт по аудиту сайта"
                                        minHeight="60px"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                        Описание (опционально)
                                    </label>
                                    <FormattedTextEditor
                                        value={report.subtitle || ''}
                                        onChange={(value) =>
                                            markMetadataDirty({ subtitle: value })
                                        }
                                        placeholder="Анализ производительности и SEO"
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
                <div className="w-96 border-l border-zinc-800 bg-zinc-900 flex flex-col h-[calc(100vh-73px)] sticky top-[73px]">
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
