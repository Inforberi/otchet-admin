'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type {
    ReportFromDB,
    ReportBlockFromDB,
    TextBlockData,
    ScreenshotBlockData,
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
    Clock,
} from 'lucide-react';
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
function SortableBlockCard({
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

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const getBlockTitle = () => {
        const data = block.data as any;
        if (block.type === 'text') {
            if (data.title) return data.title.substring(0, 30);
            if (data.content) return data.content.substring(0, 30);
            return 'Текстовый блок';
        } else if (block.type === 'screenshot') {
            if (data.title) return data.title.substring(0, 30);
            return `Фото (${data.images?.length || 0})`;
        } else {
            return 'Разделитель';
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onSelect(block.id)}
            className={`rounded border mb-2 p-3 hover:border-zinc-600 transition-colors cursor-pointer ${
                isSelected
                    ? 'bg-zinc-700 border-blue-500'
                    : 'bg-zinc-800 border-zinc-700'
            }`}
        >
            <div className="flex items-center gap-2">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 hover:bg-zinc-700 rounded flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="w-4 h-4 text-zinc-400" />
                </button>

                <div className="flex-1 min-w-0">
                    <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded mb-1 ${
                            block.type === 'text'
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
                        {getBlockTitle()}
                    </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate(block.id);
                        }}
                        className="p-1 hover:bg-zinc-700 rounded text-zinc-400"
                        title="Дублировать"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(block.id);
                        }}
                        className="p-1 hover:bg-red-900 rounded text-red-400"
                        title="Удалить"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Полноценный редактор блока (инлайн)
function BlockEditor({
    block,
    onUpdate,
}: {
    block: ReportBlockFromDB;
    onUpdate: (id: string, data: any) => void;
}) {
    const [localData, setLocalData] = useState(block.data);
    const [uploading, setUploading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        setLocalData(block.data);
    }, [block.id]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            if (JSON.stringify(localData) !== JSON.stringify(block.data)) {
                onUpdate(block.id, localData);
            }
        }, 500);
        return () => clearTimeout(debounce);
    }, [localData]);

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const newImages: ImageData[] = [];

            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append('file', file);

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
                    });
                }
            }

            const currentImages =
                (localData as ScreenshotBlockData).images || [];
            setLocalData({
                ...localData,
                images: [...currentImages, ...newImages],
            });
        } catch (error) {
            console.error('Upload error:', error);
            alert('Ошибка загрузки изображения');
        } finally {
            setUploading(false);
        }
    }

    function handleRemoveImage(index: number) {
        const images = (localData as ScreenshotBlockData).images.filter(
            (_, i) => i !== index
        );
        setLocalData({ ...localData, images });
    }

    function handleUpdateImageCaption(index: number, caption: string) {
        const images = [...(localData as ScreenshotBlockData).images];
        images[index] = { ...images[index], caption };
        setLocalData({ ...localData, images });
    }

    function handleUpdateImageAlt(index: number, alt: string) {
        const images = [...(localData as ScreenshotBlockData).images];
        images[index] = { ...images[index], alt };
        setLocalData({ ...localData, images });
    }

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
                        className={`px-2.5 py-1 text-xs font-medium rounded ${
                            block.type === 'text'
                                ? 'bg-green-600 text-white'
                                : 'bg-blue-600 text-white'
                        }`}
                    >
                        {block.type === 'text' ? 'Текст' : 'Фото'}
                    </span>
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400"
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
                                <input
                                    type="text"
                                    value={
                                        (localData as TextBlockData).title || ''
                                    }
                                    onChange={(e) =>
                                        setLocalData({
                                            ...localData,
                                            title: e.target.value,
                                        })
                                    }
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Заголовок раздела..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Содержимое (опционально)
                                </label>
                                <textarea
                                    value={(localData as TextBlockData).content}
                                    onChange={(e) =>
                                        setLocalData({
                                            ...localData,
                                            content: e.target.value,
                                        })
                                    }
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 min-h-[200px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Основной текст..."
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Заголовок (опционально)
                                </label>
                                <input
                                    type="text"
                                    value={
                                        (localData as ScreenshotBlockData)
                                            .title || ''
                                    }
                                    onChange={(e) =>
                                        setLocalData({
                                            ...localData,
                                            title: e.target.value,
                                        })
                                    }
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Заголовок блока..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Описание (опционально)
                                </label>
                                <textarea
                                    value={
                                        (localData as ScreenshotBlockData)
                                            .description || ''
                                    }
                                    onChange={(e) =>
                                        setLocalData({
                                            ...localData,
                                            description: e.target.value,
                                        })
                                    }
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[200px]"
                                    placeholder="Описание..."
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
                                            key={idx}
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
                                                                e.target.value
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
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Alt текст..."
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        handleRemoveImage(idx)
                                                    }
                                                    className="self-start p-1 hover:bg-red-900 rounded text-red-400"
                                                    title="Удалить изображение"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <label className="flex items-center justify-center gap-2 border-2 border-dashed border-zinc-700 rounded p-4 cursor-pointer hover:bg-zinc-800 transition-colors">
                                        <Upload className="w-5 h-5 text-zinc-400" />
                                        <span className="text-sm text-zinc-300">
                                            {uploading
                                                ? 'Загрузка...'
                                                : 'Загрузить изображения'}
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

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Расположение фото
                                </label>
                                <select
                                    value={
                                        (localData as ScreenshotBlockData)
                                            .layout || 'full-width'
                                    }
                                    onChange={(e) =>
                                        setLocalData({
                                            ...localData,
                                            layout: e.target.value,
                                        })
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

    const [report, setReport] = useState<ReportFromDB | null>(null);
    const [blocks, setBlocks] = useState<ReportBlockFromDB[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [timeUntilSave, setTimeUntilSave] = useState(120); // 2 минуты в секундах

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

    useEffect(() => {
        fetchReport();
    }, [reportId]);

    // Установить текущую дату, если она не задана
    useEffect(() => {
        if (report && !(report as any).date) {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            setReport({ ...report, date: today } as any);
        }
    }, [report]);

    // Scroll to selected block
    useEffect(() => {
        if (selectedBlockId) {
            const element = document.getElementById(`block-${selectedBlockId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [selectedBlockId]);

    // Таймер обратного отсчета
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeUntilSave((prev) => {
                if (prev <= 1) {
                    return 120; // Сброс таймера
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Автосохранение каждые 2 минуты
    useEffect(() => {
        const autoSave = setInterval(() => {
            if (report) {
                handleSaveMetadata(true);
            }
        }, 120000); // 120000ms = 2 минуты

        return () => clearInterval(autoSave);
    }, [report]);

    async function handleSaveMetadata(isAutoSave = false) {
        if (!report) return;
        setSaving(true);
        try {
            await fetch(`/api/reports/${reportId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: report.title,
                    description: report.description,
                    date: (report as any).date,
                }),
            });
            if (!isAutoSave) {
                alert('Метаданные сохранены!');
            }
            setTimeUntilSave(120); // Сброс таймера после сохранения
        } catch (error) {
            console.error(error);
            if (!isAutoSave) {
                alert('Ошибка сохранения');
            }
        } finally {
            setSaving(false);
        }
    }

    function formatTime(seconds: number) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    async function fetchReport() {
        try {
            const [reportRes, blocksRes] = await Promise.all([
                fetch(`/api/reports/${reportId}`),
                fetch(`/api/reports/${reportId}/blocks`),
            ]);
            if (!reportRes.ok || !blocksRes.ok)
                throw new Error('Failed to fetch');
            const { report: reportData } = await reportRes.json();
            const { blocks: blocksData } = await blocksRes.json();
            setReport(reportData);
            setBlocks(
                blocksData.sort(
                    (a: ReportBlockFromDB, b: ReportBlockFromDB) =>
                        a.position - b.position
                )
            );
            if (blocksData.length > 0) {
                setSelectedBlockId(blocksData[0].id);
            }
        } catch (error) {
            console.error(error);
            alert('Ошибка загрузки отчета');
        } finally {
            setLoading(false);
        }
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        // Сохраняем текущий порядок для возможного отката
        const previousBlocks = [...blocks];

        const currentSorted = [...sortedBlocks];
        const oldIndex = currentSorted.findIndex((b) => b.id === active.id);
        const newIndex = currentSorted.findIndex((b) => b.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        const reorderedBlocks = arrayMove(currentSorted, oldIndex, newIndex);
        const newBlocks = reorderedBlocks.map((b, i) => ({
            ...b,
            position: i,
        }));

        setBlocks(newBlocks);

        try {
            const res = await fetch(`/api/reports/${reportId}/blocks/reorder`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blockIds: newBlocks.map((b) => b.id) }),
            });
            if (!res.ok) {
                throw new Error('Failed to save order');
            }
        } catch (error) {
            console.error(error);
            // В случае ошибки возвращаем старый порядок
            setBlocks(previousBlocks);
            alert('Ошибка сохранения порядка блоков');
        }
    }

    async function handleUpdateBlock(id: string, data: any) {
        try {
            const res = await fetch(`/api/reports/${reportId}/blocks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            });
            if (!res.ok) throw new Error('Failed to update');
            const { block: saved } = await res.json();
            setBlocks((prev) =>
                prev.map((b) => (b.id === saved.id ? saved : b))
            );
        } catch (error) {
            console.error(error);
        }
    }

    async function handleDeleteBlock(id: string) {
        if (!confirm('Удалить блок?')) return;
        try {
            const res = await fetch(`/api/reports/${reportId}/blocks/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete');
            setBlocks((prev) => prev.filter((b) => b.id !== id));
            if (selectedBlockId === id && sortedBlocks.length > 1) {
                setSelectedBlockId(
                    sortedBlocks.find((b) => b.id !== id)?.id || null
                );
            }
        } catch (error) {
            console.error(error);
            alert('Ошибка удаления блока');
        }
    }

    async function handleDuplicateBlock(id: string) {
        const blockToDup = blocks.find((b) => b.id === id);
        if (!blockToDup) return;

        try {
            const res = await fetch(`/api/reports/${reportId}/blocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: blockToDup.type,
                    position: sortedBlocks.length,
                    data: blockToDup.data,
                }),
            });
            if (!res.ok) throw new Error('Failed to duplicate');
            const { block: newBlock } = await res.json();
            setBlocks((prev) => [...prev, newBlock]);
            setSelectedBlockId(newBlock.id);
        } catch (error) {
            console.error(error);
            alert('Ошибка дублирования блока');
        }
    }

    async function handleAddBlock(type: 'text' | 'screenshot' | 'divider') {
        if (!reportId) return;
        try {
            const res = await fetch(`/api/reports/${reportId}/blocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    position: sortedBlocks.length,
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
                }),
            });
            if (!res.ok) throw new Error('Failed to create block');
            const { block: newBlock } = await res.json();
            setBlocks((prev) => [...prev, newBlock]);
            setSelectedBlockId(newBlock.id);
        } catch (error) {
            console.error(error);
            alert('Ошибка создания блока');
        }
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
                        onClick={() => router.push('/reports')}
                        className="p-2 hover:bg-zinc-800 rounded text-zinc-400"
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
                    <div className="flex items-center gap-2 text-zinc-400 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>Автосохранение: {formatTime(timeUntilSave)}</span>
                    </div>
                    <button
                        onClick={() => handleSaveMetadata(false)}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-2 text-white disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                        onClick={() => router.push(`/reports/${reportId}`)}
                        className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 flex items-center gap-2 text-zinc-200"
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
                                    <input
                                        type="text"
                                        value={report.title}
                                        onChange={(e) =>
                                            setReport({
                                                ...report,
                                                title: e.target.value,
                                            })
                                        }
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Отчёт по аудиту сайта"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                        Описание (опционально)
                                    </label>
                                    <textarea
                                        value={report.description || ''}
                                        onChange={(e) =>
                                            setReport({
                                                ...report,
                                                description: e.target.value,
                                            })
                                        }
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[200px]"
                                        placeholder="Анализ производительности и SEO"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                                        Дата
                                    </label>
                                    <input
                                        type="date"
                                        value={
                                            (report as any).date ||
                                            new Date()
                                                .toISOString()
                                                .split('T')[0]
                                        }
                                        onChange={(e) =>
                                            setReport({
                                                ...report,
                                                date: e.target.value,
                                            } as any)
                                        }
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
                                    />
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
                                    className={`transition-all ${
                                        selectedBlockId === block.id
                                            ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-950'
                                            : ''
                                    }`}
                                >
                                    <BlockEditor
                                        block={block}
                                        onUpdate={handleUpdateBlock}
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
                                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                            >
                                + Текст
                            </button>
                            <button
                                onClick={() => handleAddBlock('screenshot')}
                                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
                            >
                                + Фото
                            </button>
                            <button
                                onClick={() => handleAddBlock('divider')}
                                className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs font-medium"
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
                                        onSelect={setSelectedBlockId}
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
