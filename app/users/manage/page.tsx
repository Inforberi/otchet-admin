'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronDown,
    ChevronRight,
    KeyRound,
    Save,
    Shield,
    Trash2,
    UserPlus,
} from 'lucide-react';
import { AppPageHeader } from '@/components/layout/app-page-header';
import { ROOT_GROUPS_CRUMB } from '@/lib/breadcrumbs';
import { GroupAccessChecklist } from '@/components/users/group-access-checklist';
import { useUserRole } from '@/hooks/use-user-role';
import {
    DEFAULT_EDITOR_ROLE_ID,
    SYSTEM_SUPER_ADMIN_ROLE_ID,
} from '@/lib/role-constants';

type AppRole = {
    id: string;
    name: string;
    canEditContent: boolean;
    canManageUsers: boolean;
    isSystem: boolean;
    restrictGroups: boolean;
    _count: { users: number; groupAccess: number };
};

type ManagedUser = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    appRoleId: string;
    isActive: boolean;
    mustChangePassword: boolean;
    appRole: {
        id: string;
        name: string;
        canEditContent: boolean;
        canManageUsers: boolean;
    };
};

type ReportGroupOption = { id: string; name: string; path: string };

export default function ManageUsersPage() {
    const router = useRouter();
    const { canManageUsers, loading: roleLoading } = useUserRole();
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<AppRole[]>([]);
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [groups, setGroups] = useState<ReportGroupOption[]>([]);
    const [newRoleName, setNewRoleName] = useState('');
    const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
    const [roleDrafts, setRoleDrafts] = useState<
        Record<
            string,
            {
                canEditContent: boolean;
                restrictGroups: boolean;
                groupIds: string[];
            }
        >
    >({});
    const [newUser, setNewUser] = useState({
        firstName: '',
        lastName: '',
        email: '',
        temporaryPassword: '',
        appRoleId: DEFAULT_EDITOR_ROLE_ID,
    });
    const [resetTargetId, setResetTargetId] = useState<string | null>(null);
    const [resetForm, setResetForm] = useState({
        temporaryPassword: '',
        recoveryPhrase: '',
    });

    const loadRoles = useCallback(async () => {
        const response = await fetch('/api/roles');
        if (response.ok) {
            const data = await response.json();
            setRoles(data.roles || []);
        }
    }, []);

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const loadGroups = useCallback(async () => {
        const response = await fetch('/api/groups?tree=1');
        if (response.ok) {
            const data = await response.json();
            setGroups(
                (data.groups || []).map((g: ReportGroupOption) => ({
                    id: g.id,
                    name: g.name,
                    path: g.path,
                }))
            );
        }
    }, []);

    useEffect(() => {
        if (!roleLoading && !canManageUsers) {
            router.push('/');
            return;
        }
        if (canManageUsers) {
            void loadRoles();
            void loadUsers();
            void loadGroups();
        }
    }, [canManageUsers, roleLoading, router, loadRoles, loadUsers, loadGroups]);

    const loadRoleGroups = async (roleId: string) => {
        const response = await fetch(`/api/roles/${roleId}/groups`);
        const groupIds = response.ok
            ? ((await response.json()).groupIds as string[])
            : [];
        const role = roles.find((r) => r.id === roleId);
        if (!role) return;
        setRoleDrafts((current) => ({
            ...current,
            [roleId]: {
                canEditContent: role.canEditContent,
                restrictGroups: role.restrictGroups,
                groupIds,
            },
        }));
    };

    const toggleRoleExpand = async (roleId: string) => {
        if (expandedRoleId === roleId) {
            setExpandedRoleId(null);
            return;
        }
        const role = roles.find((r) => r.id === roleId);
        if (role) {
            setRoleDrafts((current) => ({
                ...current,
                [roleId]: {
                    canEditContent: role.canEditContent,
                    restrictGroups: role.restrictGroups,
                    groupIds: current[roleId]?.groupIds ?? [],
                },
            }));
        }
        setExpandedRoleId(roleId);
        await loadRoleGroups(roleId);
    };

    const handleCreateRole = async () => {
        const response = await fetch('/api/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newRoleName,
                canEditContent: false,
                restrictGroups: true,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Ошибка создания роли');
            return;
        }
        setNewRoleName('');
        await loadRoles();
    };

    const handleSaveRole = async (roleId: string) => {
        const draft = roleDrafts[roleId];
        if (!draft) return;

        const patchRes = await fetch(`/api/roles/${roleId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                canEditContent: draft.canEditContent,
                restrictGroups: draft.restrictGroups,
            }),
        });
        if (!patchRes.ok) {
            const data = await patchRes.json();
            alert(data.error || 'Ошибка сохранения роли');
            return;
        }

        if (draft.restrictGroups) {
            const groupsRes = await fetch(`/api/roles/${roleId}/groups`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupIds: draft.groupIds }),
            });
            if (!groupsRes.ok) {
                const data = await groupsRes.json();
                alert(data.error || 'Ошибка сохранения групп');
                return;
            }
        }

        await loadRoles();
        setExpandedRoleId(null);
    };

    const handleDeleteRole = async (role: AppRole) => {
        if (role.isSystem) return;
        if (!confirm(`Удалить роль «${role.name}»?`)) return;

        const response = await fetch(`/api/roles/${role.id}`, {
            method: 'DELETE',
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Ошибка удаления');
            return;
        }
        if (expandedRoleId === role.id) setExpandedRoleId(null);
        await loadRoles();
    };

    const handleCreateUser = async () => {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser),
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Ошибка создания пользователя');
            return;
        }
        setNewUser({
            firstName: '',
            lastName: '',
            email: '',
            temporaryPassword: '',
            appRoleId: DEFAULT_EDITOR_ROLE_ID,
        });
        await loadUsers();
    };

    const handleUpdateUser = async (userId: string, patch: Partial<ManagedUser>) => {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Ошибка обновления');
            return;
        }
        setUsers((current) =>
            current.map((u) => (u.id === userId ? data.user : u))
        );
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

    const handleResetPassword = async () => {
        if (!resetTargetId) return;
        const response = await fetch(
            `/api/users/${resetTargetId}/reset-password`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resetForm),
            }
        );
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Ошибка сброса пароля');
            return;
        }
        setResetTargetId(null);
        setResetForm({ temporaryPassword: '', recoveryPhrase: '' });
        await loadUsers();
    };

    const assignableRoles = roles.filter((r) => !r.canManageUsers);

    if (roleLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)] text-[var(--color-grayscale-6)]">
                Загрузка...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            <AppPageHeader
                onLogout={handleLogout}
                breadcrumbs={[
                    ROOT_GROUPS_CRUMB,
                    { label: 'Пользователи и роли' },
                ]}
                title="Пользователи и роли"
                description="Создавайте роли и назначайте их пользователям"
            />

            <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-[var(--color-primary)]" />
                        <h2 className="text-lg font-semibold text-[var(--color-grayscale-2)]">
                            Роли
                        </h2>
                    </div>
                    <div className="mb-6 flex flex-wrap gap-2">
                        <input
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="Название роли (Копирайтер, SEO…)"
                            className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                        />
                        <button
                            onClick={handleCreateRole}
                            disabled={!newRoleName.trim()}
                            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 cursor-pointer"
                        >
                            Добавить роль
                        </button>
                    </div>

                    <div className="space-y-3">
                        {roles.map((role) => {
                            const draft = roleDrafts[role.id];
                            const isExpanded = expandedRoleId === role.id;
                            const isEditing = Boolean(draft);

                            return (
                                <div
                                    key={role.id}
                                    className="rounded-lg border border-zinc-800 bg-zinc-900"
                                >
                                    <div className="flex flex-wrap items-center gap-3 p-4">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void toggleRoleExpand(role.id)
                                            }
                                            className="text-zinc-400 cursor-pointer"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-zinc-100">
                                                {role.name}
                                                {role.isSystem && (
                                                    <span className="ml-2 text-xs text-zinc-500">
                                                        системная
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                {role.canEditContent
                                                    ? 'Просмотр и редактирование'
                                                    : 'Только просмотр'}
                                                {role.restrictGroups
                                                    ? ` · ${role._count.groupAccess} групп`
                                                    : ' · все группы'}
                                                {' · '}
                                                {role._count.users} польз.
                                            </p>
                                        </div>
                                        {!role.isSystem && (
                                            <button
                                                onClick={() =>
                                                    handleDeleteRole(role)
                                                }
                                                className="rounded border border-red-500/30 p-2 text-red-400 cursor-pointer"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-zinc-800 px-4 pb-4 pt-3 space-y-4">
                                            {isEditing && !role.isSystem && (
                                                <>
                                                    <div className="space-y-2">
                                                        <p className="text-sm font-medium text-zinc-300">
                                                            Режим доступа
                                                        </p>
                                                        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={
                                                                    !draft.canEditContent
                                                                }
                                                                onChange={() =>
                                                                    setRoleDrafts(
                                                                        (c) => ({
                                                                            ...c,
                                                                            [role.id]:
                                                                                {
                                                                                    ...draft,
                                                                                    canEditContent:
                                                                                        false,
                                                                                },
                                                                        })
                                                                    )
                                                                }
                                                            />
                                                            Только просмотр
                                                            (published)
                                                        </label>
                                                        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={
                                                                    draft.canEditContent
                                                                }
                                                                onChange={() =>
                                                                    setRoleDrafts(
                                                                        (c) => ({
                                                                            ...c,
                                                                            [role.id]:
                                                                                {
                                                                                    ...draft,
                                                                                    canEditContent:
                                                                                        true,
                                                                                },
                                                                        })
                                                                    )
                                                                }
                                                            />
                                                            Просмотр и
                                                            редактирование
                                                        </label>
                                                    </div>
                                                    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                draft.restrictGroups
                                                            }
                                                            onChange={(e) =>
                                                                setRoleDrafts(
                                                                    (c) => ({
                                                                        ...c,
                                                                        [role.id]:
                                                                            {
                                                                                ...draft,
                                                                                restrictGroups:
                                                                                    e
                                                                                        .target
                                                                                        .checked,
                                                                            },
                                                                    })
                                                                )
                                                            }
                                                        />
                                                        Ограничить
                                                        выбранными группами
                                                    </label>
                                                    {draft.restrictGroups && (
                                                        <GroupAccessChecklist
                                                            groups={groups}
                                                            selectedGroupIds={
                                                                draft.groupIds
                                                            }
                                                            onChange={(
                                                                groupIds
                                                            ) =>
                                                                setRoleDrafts(
                                                                    (c) => ({
                                                                        ...c,
                                                                        [role.id]:
                                                                            {
                                                                                ...draft,
                                                                                groupIds,
                                                                            },
                                                                    })
                                                                )
                                                            }
                                                        />
                                                    )}
                                                    <button
                                                        onClick={() =>
                                                            handleSaveRole(
                                                                role.id
                                                            )
                                                        }
                                                        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm text-white cursor-pointer"
                                                    >
                                                        Сохранить роль
                                                    </button>
                                                </>
                                            )}
                                            {role.isSystem && (
                                                <div className="space-y-2 text-sm text-zinc-400">
                                                    <p className="font-medium text-zinc-300">
                                                        Системная роль — полный
                                                        доступ
                                                    </p>
                                                    <ul className="list-inside list-disc space-y-1 text-zinc-500">
                                                        <li>
                                                            Просмотр и
                                                            редактирование всех
                                                            отчётов
                                                        </li>
                                                        <li>
                                                            Все группы без
                                                            ограничений
                                                        </li>
                                                        {role.id ===
                                                            SYSTEM_SUPER_ADMIN_ROLE_ID && (
                                                            <li>
                                                                Управление
                                                                пользователями и
                                                                ролями
                                                            </li>
                                                        )}
                                                    </ul>
                                                    <p className="text-zinc-600">
                                                        Настройки системной роли
                                                        нельзя изменить.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {resetTargetId && (
                    <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6">
                        <h2 className="mb-4 text-lg font-semibold text-amber-200">
                            Сброс пароля
                        </h2>
                        <div className="grid max-w-xl gap-3">
                            <input
                                type="password"
                                value={resetForm.temporaryPassword}
                                onChange={(e) =>
                                    setResetForm((c) => ({
                                        ...c,
                                        temporaryPassword: e.target.value,
                                    }))
                                }
                                placeholder="Новый временный пароль"
                                className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                            />
                            <input
                                type="password"
                                value={resetForm.recoveryPhrase}
                                onChange={(e) =>
                                    setResetForm((c) => ({
                                        ...c,
                                        recoveryPhrase: e.target.value,
                                    }))
                                }
                                placeholder="Ключевая фраза (RECOVERY_PHRASE)"
                                className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                            />
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={handleResetPassword}
                                className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white cursor-pointer"
                            >
                                Сбросить
                            </button>
                            <button
                                onClick={() => {
                                    setResetTargetId(null);
                                    setResetForm({
                                        temporaryPassword: '',
                                        recoveryPhrase: '',
                                    });
                                }}
                                className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 cursor-pointer"
                            >
                                Отмена
                            </button>
                        </div>
                    </section>
                )}

                <section className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-[var(--color-primary)]" />
                        <h2 className="text-lg font-semibold text-[var(--color-grayscale-2)]">
                            Создать пользователя
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <input
                            value={newUser.firstName}
                            onChange={(e) =>
                                setNewUser((c) => ({
                                    ...c,
                                    firstName: e.target.value,
                                }))
                            }
                            placeholder="Имя"
                            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                        />
                        <input
                            value={newUser.lastName}
                            onChange={(e) =>
                                setNewUser((c) => ({
                                    ...c,
                                    lastName: e.target.value,
                                }))
                            }
                            placeholder="Фамилия"
                            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                        />
                        <input
                            value={newUser.email}
                            onChange={(e) =>
                                setNewUser((c) => ({
                                    ...c,
                                    email: e.target.value,
                                }))
                            }
                            placeholder="Email"
                            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                        />
                        <select
                            value={newUser.appRoleId}
                            onChange={(e) =>
                                setNewUser((c) => ({
                                    ...c,
                                    appRoleId: e.target.value,
                                }))
                            }
                            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                        >
                            {assignableRoles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.name}
                                </option>
                            ))}
                        </select>
                        <input
                            value={newUser.temporaryPassword}
                            onChange={(e) =>
                                setNewUser((c) => ({
                                    ...c,
                                    temporaryPassword: e.target.value,
                                }))
                            }
                            placeholder="Временный пароль"
                            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                        />
                    </div>
                    <button
                        onClick={handleCreateUser}
                        className="mt-4 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white cursor-pointer"
                    >
                        Создать пользователя
                    </button>
                </section>

                <section className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-6">
                    <h2 className="mb-4 text-lg font-semibold text-[var(--color-grayscale-2)]">
                        Пользователи
                    </h2>
                    <div className="space-y-4">
                        {users.map((user) => {
                            const isSuper = user.appRole.canManageUsers;
                            return (
                                <div
                                    key={user.id}
                                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                                >
                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1.2fr_1fr_auto_auto] lg:items-center">
                                        <input
                                            value={user.firstName}
                                            disabled={isSuper}
                                            onChange={(e) =>
                                                setUsers((c) =>
                                                    c.map((u) =>
                                                        u.id === user.id
                                                            ? {
                                                                  ...u,
                                                                  firstName:
                                                                      e.target
                                                                          .value,
                                                              }
                                                            : u
                                                    )
                                                )
                                            }
                                            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-200 disabled:opacity-60"
                                        />
                                        <input
                                            value={user.lastName}
                                            disabled={isSuper}
                                            onChange={(e) =>
                                                setUsers((c) =>
                                                    c.map((u) =>
                                                        u.id === user.id
                                                            ? {
                                                                  ...u,
                                                                  lastName:
                                                                      e.target
                                                                          .value,
                                                              }
                                                            : u
                                                    )
                                                )
                                            }
                                            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-200 disabled:opacity-60"
                                        />
                                        <input
                                            value={user.email}
                                            disabled={isSuper}
                                            onChange={(e) =>
                                                setUsers((c) =>
                                                    c.map((u) =>
                                                        u.id === user.id
                                                            ? {
                                                                  ...u,
                                                                  email: e
                                                                      .target
                                                                      .value,
                                                              }
                                                            : u
                                                    )
                                                )
                                            }
                                            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-200 disabled:opacity-60"
                                        />
                                        {isSuper ? (
                                            <span className="text-sm text-zinc-400">
                                                {user.appRole.name}
                                            </span>
                                        ) : (
                                            <select
                                                value={user.appRoleId}
                                                onChange={(e) =>
                                                    setUsers((c) =>
                                                        c.map((u) =>
                                                            u.id === user.id
                                                                ? {
                                                                      ...u,
                                                                      appRoleId:
                                                                          e
                                                                              .target
                                                                              .value,
                                                                  }
                                                                : u
                                                        )
                                                    )
                                                }
                                                className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                                            >
                                                {assignableRoles.map((role) => (
                                                    <option
                                                        key={role.id}
                                                        value={role.id}
                                                    >
                                                        {role.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <button
                                            onClick={() =>
                                                handleUpdateUser(user.id, {
                                                    firstName: user.firstName,
                                                    lastName: user.lastName,
                                                    email: user.email,
                                                    isActive: !user.isActive,
                                                    appRoleId: user.appRoleId,
                                                })
                                            }
                                            disabled={isSuper}
                                            className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50 cursor-pointer"
                                        >
                                            {user.isActive
                                                ? 'Отключить'
                                                : 'Включить'}
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() =>
                                                    handleUpdateUser(user.id, {
                                                        firstName:
                                                            user.firstName,
                                                        lastName: user.lastName,
                                                        email: user.email,
                                                        isActive: user.isActive,
                                                        appRoleId:
                                                            user.appRoleId,
                                                    })
                                                }
                                                disabled={isSuper}
                                                className="rounded border border-zinc-700 px-3 py-2 cursor-pointer disabled:opacity-50"
                                            >
                                                <Save className="h-4 w-4 text-zinc-200" />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setResetTargetId(user.id)
                                                }
                                                className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 cursor-pointer"
                                            >
                                                <KeyRound className="h-4 w-4 text-amber-300" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-xs text-zinc-500">
                                        {user.mustChangePassword
                                            ? 'Требуется смена пароля'
                                            : 'Пароль подтверждён'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>
        </div>
    );
}
