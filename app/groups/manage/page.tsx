'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Edit,
    FolderOpen,
    Plus,
    Save,
    Trash2,
} from 'lucide-react';
import { useUserRole } from '@/hooks/use-user-role';
import { getIndentedGroupLabel, splitGroupPath } from '@/lib/group-utils';

interface ReportGroup {
    id: string;
    name: string;
    slug: string;
    path: string;
    description: string | null;
    order: number;
    parentId: string | null;
    _count: {
        reports: number;
        children: number;
    };
}

interface FlatGroup extends ReportGroup {
    depth: number;
}

const buildFlatGroups = (groups: ReportGroup[]) => {
    const childrenByParent = new Map<string | null, ReportGroup[]>();

    groups.forEach((group) => {
        const siblings = childrenByParent.get(group.parentId) || [];
        siblings.push(group);
        childrenByParent.set(group.parentId, siblings);
    });

    const sortGroups = (items: ReportGroup[]) =>
        [...items].sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            return a.name.localeCompare(b.name, 'ru');
        });

    const result: FlatGroup[] = [];

    const walk = (parentId: string | null, depth: number) => {
        const items = sortGroups(childrenByParent.get(parentId) || []);
        items.forEach((item) => {
            result.push({ ...item, depth });
            walk(item.id, depth + 1);
        });
    };

    walk(null, 0);
    return result;
};

export default function ManageGroupsPage() {
    const router = useRouter();
    const { isAdmin, loading: roleLoading } = useUserRole();
    const [groups, setGroups] = useState<ReportGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingDescription, setEditingDescription] = useState('');
    const [editingParentId, setEditingParentId] = useState<string>('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newParentId, setNewParentId] = useState('');

    useEffect(() => {
        if (!roleLoading && !isAdmin) {
            router.push('/');
            return;
        }
        loadGroups();
    }, [isAdmin, roleLoading, router]);

    const flatGroups = useMemo(() => buildFlatGroups(groups), [groups]);

    const loadGroups = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/groups?tree=1');
            if (response.ok) {
                const data = await response.json();
                setGroups(data.groups || []);
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const resetCreateForm = () => {
        setShowCreateForm(false);
        setNewName('');
        setNewDescription('');
        setNewParentId('');
    };

    const resetEditForm = () => {
        setEditingId(null);
        setEditingName('');
        setEditingDescription('');
        setEditingParentId('');
    };

    const handleCreate = async () => {
        if (!newName.trim()) {
            alert('Название группы обязательно');
            return;
        }

        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDescription.trim() || null,
                    parentId: newParentId || null,
                }),
            });

            if (response.ok) {
                await loadGroups();
                resetCreateForm();
            } else {
                const data = await response.json();
                alert(data.error || 'Ошибка создания группы');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Ошибка создания группы');
        }
    };

    const handleEdit = (group: ReportGroup) => {
        setEditingId(group.id);
        setEditingName(group.name);
        setEditingDescription(group.description || '');
        setEditingParentId(group.parentId || '');
    };

    const handleSave = async (id: string) => {
        if (!editingName.trim()) {
            alert('Название группы обязательно');
            return;
        }

        try {
            const response = await fetch(`/api/groups/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editingName.trim(),
                    description: editingDescription.trim() || null,
                    parentId: editingParentId || null,
                }),
            });

            if (response.ok) {
                await loadGroups();
                resetEditForm();
            } else {
                const data = await response.json();
                alert(data.error || 'Ошибка обновления группы');
            }
        } catch (error) {
            console.error('Error updating group:', error);
            alert('Ошибка обновления группы');
        }
    };

    const handleDelete = async (id: string) => {
        if (
            !confirm(
                'Удалить группу? Удаление доступно только для пустых групп без подгрупп и отчетов.'
            )
        ) {
            return;
        }

        try {
            const response = await fetch(`/api/groups/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await loadGroups();
            } else {
                const data = await response.json();
                alert(data.error || 'Ошибка удаления группы');
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('Ошибка удаления группы');
        }
    };

    if (roleLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)]">
                <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            <header className="sticky top-0 z-40 border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                            <h1 className="text-3xl font-bold text-[var(--color-grayscale-2)]">
                                Управление группами
                            </h1>
                        </div>
                        <button
                            onClick={() => setShowCreateForm((prev) => !prev)}
                            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            Создать группу
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {showCreateForm && (
                    <div className="mb-6 rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-6">
                        <h2 className="mb-4 text-lg font-semibold text-[var(--color-grayscale-2)]">
                            Новая группа
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-[var(--color-grayscale-4)]">
                                    Название *
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Например: SEO"
                                    className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-[var(--color-grayscale-2)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-[var(--color-grayscale-4)]">
                                    Родительская группа
                                </label>
                                <select
                                    value={newParentId}
                                    onChange={(e) =>
                                        setNewParentId(e.target.value)
                                    }
                                    className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-[var(--color-grayscale-2)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                >
                                    <option value="">Без родителя (корень)</option>
                                    {flatGroups.map((group) => (
                                        <option key={group.id} value={group.id}>
                                            {getIndentedGroupLabel(
                                                group.name,
                                                group.depth
                                            )}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-[var(--color-grayscale-4)]">
                                    Описание
                                </label>
                                <textarea
                                    value={newDescription}
                                    onChange={(e) =>
                                        setNewDescription(e.target.value)
                                    }
                                    rows={3}
                                    placeholder="Описание группы..."
                                    className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-[var(--color-grayscale-2)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={resetCreateForm}
                                    className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-2)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                                >
                                    <Save className="h-4 w-4" />
                                    Создать
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {flatGroups.length === 0 ? (
                    <div className="py-16 text-center">
                        <FolderOpen className="mx-auto h-12 w-12 text-[var(--color-grayscale-6)] mb-4" />
                        <p className="text-lg text-[var(--color-grayscale-6)] mb-4">
                            Нет групп
                        </p>
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                        >
                            <Plus className="h-5 w-5" />
                            Создать первую группу
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {flatGroups.map((group) => (
                            <div
                                key={group.id}
                                className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-6"
                                style={{
                                    marginLeft: `${group.depth * 24}px`,
                                }}
                            >
                                {editingId === group.id ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-1 block text-sm font-medium text-[var(--color-grayscale-4)]">
                                                Название *
                                            </label>
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) =>
                                                    setEditingName(
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-[var(--color-grayscale-2)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-medium text-[var(--color-grayscale-4)]">
                                                Родительская группа
                                            </label>
                                            <select
                                                value={editingParentId}
                                                onChange={(e) =>
                                                    setEditingParentId(
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-[var(--color-grayscale-2)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                            >
                                                <option value="">
                                                    Без родителя (корень)
                                                </option>
                                                {flatGroups
                                                    .filter(
                                                        (item) =>
                                                            item.id !== group.id &&
                                                            !item.path.startsWith(
                                                                `${group.path}/`
                                                            )
                                                    )
                                                    .map((item) => (
                                                        <option
                                                            key={item.id}
                                                            value={item.id}
                                                        >
                                                            {getIndentedGroupLabel(
                                                                item.name,
                                                                item.depth
                                                            )}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-medium text-[var(--color-grayscale-4)]">
                                                Описание
                                            </label>
                                            <textarea
                                                value={editingDescription}
                                                onChange={(e) =>
                                                    setEditingDescription(
                                                        e.target.value
                                                    )
                                                }
                                                rows={3}
                                                className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-[var(--color-grayscale-2)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-3">
                                            <button
                                                onClick={resetEditForm}
                                                className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-2)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                                            >
                                                Отмена
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleSave(group.id)
                                                }
                                                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                                            >
                                                <Save className="h-4 w-4" />
                                                Сохранить
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <FolderOpen className="h-4 w-4 text-[var(--color-primary)]" />
                                                <h3 className="text-lg font-semibold text-[var(--color-grayscale-2)]">
                                                    {group.name}
                                                </h3>
                                            </div>
                                            <p className="mb-2 text-xs text-[var(--color-grayscale-6)]">
                                                /{group.path}
                                            </p>
                                            {group.description && (
                                                <p className="mb-2 text-sm text-[var(--color-grayscale-6)]">
                                                    {group.description}
                                                </p>
                                            )}
                                            <p className="text-xs text-[var(--color-grayscale-6)]">
                                                {group._count.reports} отчетов •{' '}
                                                {group._count.children} подгрупп •
                                                глубина {splitGroupPath(group.path).length}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(group)}
                                                className="rounded-md p-2 text-[var(--color-grayscale-6)] transition-colors hover:bg-[var(--color-grayscale-14)] hover:text-[var(--color-grayscale-2)] cursor-pointer"
                                                title="Редактировать"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleDelete(group.id)
                                                }
                                                className="rounded-md p-2 text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                                                title="Удалить"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
