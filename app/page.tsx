'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Plus, Settings, LogOut } from 'lucide-react';
import { useUserRole } from '@/hooks/use-user-role';
import { CreateGroupDialog } from '@/components/groups/create-group-dialog';

interface ReportGroup {
    id: string;
    name: string;
    slug: string;
    path: string;
    description: string | null;
    order: number;
    _count: {
        reports: number;
        children: number;
    };
}

export default function HomePage() {
    const router = useRouter();
    const { isAdmin, isSuperAdmin, loading: roleLoading } = useUserRole();
    const [groups, setGroups] = useState<ReportGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/groups');
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

    const handleSelectGroup = (group: ReportGroup) => {
        router.push(`/${group.path}`);
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    if (roleLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)]">
                <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-[var(--color-grayscale-2)]">
                            Группы отчетов
                        </h1>
                        <div className="flex items-center gap-3">
                            {isAdmin && (
                                <>
                                    <button
                                        onClick={() =>
                                            setIsCreateGroupOpen(true)
                                        }
                                        className="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Создать папку
                                    </button>
                                    <button
                                        onClick={() => router.push('/groups/manage')}
                                        className="flex items-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                                    >
                                        <Settings className="h-4 w-4" />
                                        Управление
                                    </button>
                                    {isSuperAdmin && (
                                        <button
                                            onClick={() => router.push('/users/manage')}
                                            className="flex items-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                                        >
                                            <Settings className="h-4 w-4" />
                                            Пользователи
                                        </button>
                                    )}
                                </>
                            )}
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 cursor-pointer"
                            >
                                <LogOut className="h-4 w-4" />
                                Выйти
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {groups.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-lg text-[var(--color-grayscale-6)] mb-4">
                            Нет доступных групп
                        </p>
                        {isAdmin && (
                            <button
                                onClick={() => setIsCreateGroupOpen(true)}
                                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                            >
                                <Plus className="h-5 w-5" />
                                Создать папку
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {groups.map((group) => (
                            <button
                                key={group.id}
                                onClick={() => handleSelectGroup(group)}
                                className="group relative flex flex-col rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-6 text-left transition-all hover:border-[var(--color-primary)] hover:shadow-lg cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="rounded-lg bg-[var(--color-primary)]/10 p-3">
                                        <FolderOpen className="h-6 w-6 text-[var(--color-primary)]" />
                                    </div>
                                    <span className="text-sm font-medium text-[var(--color-grayscale-6)]">
                                        {group._count.reports} отчетов
                                        {group._count.children > 0
                                            ? ` • ${group._count.children} групп`
                                            : ''}
                                    </span>
                                </div>
                                <h3 className="text-xl font-semibold text-[var(--color-grayscale-2)] mb-2">
                                    {group.name}
                                </h3>
                                {group.description && (
                                    <p className="text-sm text-[var(--color-grayscale-6)] line-clamp-2">
                                        {group.description}
                                    </p>
                                )}
                                <div className="mt-4 flex items-center text-sm font-medium text-[var(--color-primary)] opacity-0 transition-opacity group-hover:opacity-100">
                                    Открыть группу
                                    <svg
                                        className="ml-2 h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </main>

            {isAdmin && (
                <CreateGroupDialog
                    open={isCreateGroupOpen}
                    onOpenChange={setIsCreateGroupOpen}
                    onCreated={loadGroups}
                />
            )}
        </div>
    );
}
