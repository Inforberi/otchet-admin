'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Plus, Settings } from 'lucide-react';
import { AppPageHeader } from '@/components/layout/app-page-header';
import { useUserRole } from '@/hooks/use-user-role';
import { CreateGroupDialog } from '@/components/groups/create-group-dialog';
import { EditGroupDialog } from '@/components/groups/edit-group-dialog';

interface ReportGroup {
    id: string;
    name: string;
    slug: string;
    path: string;
    description: string | null;
    order: number;
    parentId: string | null;
    version: number;
    _count: {
        reports: number;
        children: number;
    };
}

export default function HomePage() {
    const router = useRouter();
    const { canEdit, loading: roleLoading } = useUserRole();
    const [groups, setGroups] = useState<ReportGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ReportGroup | null>(null);

    const loadGroups = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        void loadGroups();
    }, [loadGroups]);

    const handleSelectGroup = useCallback(
        (group: ReportGroup) => {
            router.push(`/${group.path}`);
        },
        [router]
    );

    const handleOpenEdit = useCallback(
        (group: ReportGroup, event: React.MouseEvent) => {
            event.stopPropagation();
            setEditingGroup(group);
            setIsEditGroupOpen(true);
        },
        []
    );

    const handleGroupUpdated = useCallback(
        async (updated: { path: string }) => {
            if (editingGroup && updated.path !== editingGroup.path) {
                router.push(`/${updated.path}`);
                return;
            }
            await loadGroups();
        },
        [editingGroup, loadGroups, router]
    );

    const handleLogout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }, [router]);

    if (roleLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)]">
                <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            <AppPageHeader
                onLogout={handleLogout}
                breadcrumbs={[{ label: 'Группы' }]}
                title="Группы отчетов"
                actions={
                    canEdit ? (
                        <button
                            type="button"
                            onClick={() => setIsCreateGroupOpen(true)}
                            className="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            Создать папку
                        </button>
                    ) : undefined
                }
            />

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {groups.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-lg text-[var(--color-grayscale-6)] mb-4">
                            Нет доступных групп
                        </p>
                        {canEdit && (
                            <button
                                type="button"
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
                        {groups.map((group) => {
                            const isNonEmpty =
                                group._count.reports > 0 ||
                                group._count.children > 0;

                            return (
                                <div
                                    key={group.id}
                                    className="group/card relative flex flex-col rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] transition-all hover:border-[var(--color-primary)] hover:shadow-lg"
                                >
                                    {canEdit && (
                                        <button
                                            type="button"
                                            onClick={(event) =>
                                                handleOpenEdit(group, event)
                                            }
                                            className="absolute right-3 top-3 z-10 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-5)] opacity-0 transition-opacity hover:bg-[var(--color-grayscale-13)] hover:text-[var(--color-grayscale-3)] group-hover/card:opacity-100 cursor-pointer"
                                            title="Настройки папки"
                                            aria-label="Настройки папки"
                                        >
                                            <Settings className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectGroup(group)}
                                        className="flex w-full flex-col p-6 text-left cursor-pointer"
                                    >
                                        <div className="mb-4 flex items-start justify-between pr-8">
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
                                        <h3 className="mb-2 text-xl font-semibold text-[var(--color-grayscale-2)]">
                                            {group.name}
                                        </h3>
                                        {group.description && (
                                            <p className="line-clamp-2 text-sm text-[var(--color-grayscale-6)]">
                                                {group.description}
                                            </p>
                                        )}
                                        {isNonEmpty && canEdit && (
                                            <p className="mt-2 text-xs text-[var(--color-grayscale-7)]">
                                                Для удаления сначала очистите
                                                папку
                                            </p>
                                        )}
                                        <div className="mt-4 flex items-center text-sm font-medium text-[var(--color-primary)] opacity-0 transition-opacity group-hover/card:opacity-100">
                                            Открыть группу
                                            <svg
                                                className="ml-2 h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                aria-hidden
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
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {canEdit && (
                <>
                    <CreateGroupDialog
                        open={isCreateGroupOpen}
                        onOpenChange={setIsCreateGroupOpen}
                        onCreated={loadGroups}
                    />
                    <EditGroupDialog
                        open={isEditGroupOpen}
                        onOpenChange={(open) => {
                            setIsEditGroupOpen(open);
                            if (!open) setEditingGroup(null);
                        }}
                        group={editingGroup}
                        onUpdated={handleGroupUpdated}
                        onDeleted={loadGroups}
                    />
                </>
            )}
        </div>
    );
}
