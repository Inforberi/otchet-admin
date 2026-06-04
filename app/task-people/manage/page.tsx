'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { AppPageHeader } from '@/components/layout/app-page-header';
import { ROOT_GROUPS_CRUMB } from '@/lib/breadcrumbs';
import { useUserRole } from '@/hooks/use-user-role';
type TaskPersonRow = {
    id: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    createdAt: string;
};

export default function ManageTaskPeoplePage() {
    const router = useRouter();
    const { canEdit, loading: roleLoading } = useUserRole();
    const [people, setPeople] = useState<TaskPersonRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');

    const loadPeople = useCallback(async (q: string) => {
        setLoading(true);
        try {
            const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}&includeInactive=true` : '?includeInactive=true';
            const res = await fetch(`/api/task-people${query}`);
            if (!res.ok) {
                setPeople([]);
                return;
            }
            const data = (await res.json()) as { people: TaskPersonRow[] };
            setPeople(data.people ?? []);
        } catch {
            setPeople([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!roleLoading && !canEdit) {
            router.push('/');
            return;
        }
        if (canEdit) void loadPeople(search);
    }, [canEdit, roleLoading, router, loadPeople, search]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormError('');
        try {
            const res = await fetch('/api/task-people', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: newFirstName,
                    lastName: newLastName,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setFormError(data.error || 'Ошибка создания');
                return;
            }
            setNewFirstName('');
            setNewLastName('');
            await loadPeople(search);
        } catch {
            setFormError('Ошибка создания');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (row: TaskPersonRow) => {
        setEditId(row.id);
        setEditFirstName(row.firstName);
        setEditLastName(row.lastName);
    };

    const saveEdit = async () => {
        if (!editId) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/task-people/${editId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: editFirstName,
                    lastName: editLastName,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                setFormError(data.error || 'Ошибка сохранения');
                return;
            }
            setEditId(null);
            await loadPeople(search);
        } catch {
            setFormError('Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    const deactivate = async (id: string) => {
        if (!confirm('Деактивировать исполнителя? Он не будет отображаться при выборе.')) return;
        await fetch(`/api/task-people/${id}`, { method: 'DELETE' });
        await loadPeople(search);
    };

    const reactivate = async (row: TaskPersonRow) => {
        await fetch(`/api/task-people/${row.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: true }),
        });
        await loadPeople(search);
    };

    if (roleLoading || loading) {
        return (
            <div className="flex min-h-screen flex-col bg-[#181818]">
                <AppPageHeader
                    onLogout={handleLogout}
                    breadcrumbs={[ROOT_GROUPS_CRUMB, { label: 'Исполнители' }]}
                />
                <div className="flex flex-1 items-center justify-center text-zinc-500">
                    Загрузка…
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#181818]">
            <AppPageHeader
                onLogout={handleLogout}
                breadcrumbs={[ROOT_GROUPS_CRUMB, { label: 'Исполнители' }]}
                title="Справочник исполнителей"
                description="Ручные исполнители без учётной записи. Используются при назначении задач в отчётах."
            />

            <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
                <form
                    onSubmit={handleCreate}
                    className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
                >
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                        <UserPlus className="h-4 w-4 text-purple-400" />
                        Добавить исполнителя
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <input
                            type="text"
                            placeholder="Имя *"
                            value={newFirstName}
                            onChange={(e) => setNewFirstName(e.target.value)}
                            required
                            className="rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                        />
                        <input
                            type="text"
                            placeholder="Фамилия *"
                            value={newLastName}
                            onChange={(e) => setNewLastName(e.target.value)}
                            required
                            className="rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                        />
                    </div>
                    {formError && !editId && (
                        <p className="mt-2 text-sm text-red-400">{formError}</p>
                    )}
                    <button
                        type="submit"
                        disabled={saving}
                        className="mt-3 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? 'Сохранение…' : 'Добавить'}
                    </button>
                </form>

                <div className="mb-4">
                    <input
                        type="search"
                        placeholder="Поиск по имени или фамилии…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                    />
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-800">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/90 text-left text-xs uppercase tracking-wider text-zinc-500">
                                <th className="px-4 py-3">Имя</th>
                                <th className="px-4 py-3">Фамилия</th>
                                <th className="px-4 py-3">Статус</th>
                                <th className="px-4 py-3 text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {people.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-4 py-8 text-center text-zinc-500"
                                    >
                                        Нет записей
                                    </td>
                                </tr>
                            )}
                            {people.map((row) => (
                                <tr
                                    key={row.id}
                                    className={`border-b border-zinc-800/80 ${
                                        row.isActive ? '' : 'opacity-50'
                                    }`}
                                >
                                    <td className="px-4 py-3 text-zinc-200">
                                        {editId === row.id ? (
                                            <input
                                                value={editFirstName}
                                                onChange={(e) =>
                                                    setEditFirstName(e.target.value)
                                                }
                                                aria-label="Имя"
                                                className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1"
                                            />
                                        ) : (
                                            row.firstName
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-zinc-200">
                                        {editId === row.id ? (
                                            <input
                                                value={editLastName}
                                                onChange={(e) =>
                                                    setEditLastName(e.target.value)
                                                }
                                                aria-label="Фамилия"
                                                className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1"
                                            />
                                        ) : (
                                            row.lastName
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-zinc-400">
                                        {row.isActive ? 'Активен' : 'Неактивен'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            {editId === row.id ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => void saveEdit()}
                                                        disabled={saving}
                                                        className="rounded px-2 py-1 text-xs text-green-400 hover:bg-zinc-800 cursor-pointer"
                                                    >
                                                        Сохранить
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditId(null)}
                                                        className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 cursor-pointer"
                                                    >
                                                        Отмена
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(row)}
                                                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
                                                        title="Редактировать"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    {row.isActive ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => void deactivate(row.id)}
                                                            className="rounded p-1.5 text-zinc-400 hover:bg-red-950 hover:text-red-400 cursor-pointer"
                                                            title="Деактивировать"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => void reactivate(row)}
                                                            className="rounded px-2 py-1 text-xs text-purple-400 hover:bg-zinc-800 cursor-pointer"
                                                        >
                                                            Восстановить
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                    Зарегистрированные пользователи системы назначаются отдельно — в задаче из
                    списка «Зарегистрированные пользователи».
                </p>
            </main>
        </div>
    );
}
