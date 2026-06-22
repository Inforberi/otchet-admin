'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { AppPageHeader } from '@/components/layout/app-page-header';
import { useUserRole } from '@/hooks/use-user-role';
import { CreateGroupDialog } from '@/components/groups/create-group-dialog';
import { EditGroupDialog } from '@/components/groups/edit-group-dialog';
import { GroupFolderCard } from '@/components/groups/group-folder-card';

interface ReportGroup {
    id: string;
    name: string;
    slug: string;
    path: string;
    description: string | null;
    order: number;
    parentId: string | null;
    createdByUserId?: string | null;
    isHidden?: boolean;
    version: number;
    _count: {
        reports: number;
        children: number;
    };
}

const SHOW_HIDDEN_STORAGE_KEY = 'show-hidden-groups';

export default function HomePage() {
    const router = useRouter();
    const { user, canEdit, isSuperAdmin, loading: roleLoading } = useUserRole();
    const [groups, setGroups] = useState<ReportGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHidden, setShowHidden] = useState(false);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ReportGroup | null>(null);

    const loadGroups = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (showHidden) params.set('showHidden', '1');
            const query = params.toString();
            const response = await fetch(
                query ? `/api/groups?${query}` : '/api/groups'
            );
            if (response.ok) {
                const data = await response.json();
                setGroups(data.groups || []);
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        } finally {
            setLoading(false);
        }
    }, [showHidden]);

    useEffect(() => {
        try {
            setShowHidden(
                localStorage.getItem(SHOW_HIDDEN_STORAGE_KEY) === '1'
            );
        } catch {
            setShowHidden(false);
        }
    }, []);

    useEffect(() => {
        void loadGroups();
    }, [loadGroups]);

    const handleShowHiddenChange = useCallback((checked: boolean) => {
        setShowHidden(checked);
        try {
            localStorage.setItem(SHOW_HIDDEN_STORAGE_KEY, checked ? '1' : '0');
        } catch {
            // ignore
        }
    }, []);

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
                    <div className="flex items-center gap-4">
                        {isSuperAdmin && (
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-grayscale-5)]">
                                <input
                                    type="checkbox"
                                    checked={showHidden}
                                    onChange={(e) =>
                                        handleShowHiddenChange(e.target.checked)
                                    }
                                    className="rounded border-[var(--color-alpha-3)]"
                                />
                                Показывать скрытые
                            </label>
                        )}
                        {canEdit ? (
                            <button
                                type="button"
                                onClick={() => setIsCreateGroupOpen(true)}
                                className="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                Создать папку
                            </button>
                        ) : null}
                    </div>
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
                        {groups.map((group) => (
                            <GroupFolderCard
                                key={group.id}
                                name={group.name}
                                description={group.description}
                                reportsCount={group._count.reports}
                                childrenCount={group._count.children}
                                canEdit={canEdit}
                                showDeleteHint
                                onOpen={() => handleSelectGroup(group)}
                                onEdit={(event) => handleOpenEdit(group, event)}
                            />
                        ))}
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
                        currentUserId={user?.id}
                        showHiddenGroups={showHidden}
                        onUpdated={handleGroupUpdated}
                        onDeleted={loadGroups}
                    />
                </>
            )}
        </div>
    );
}
