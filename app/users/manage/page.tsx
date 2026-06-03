'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Save, Shield, UserPlus } from 'lucide-react';
import { useUserRole } from '@/hooks/use-user-role';

type ManagedUser = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'super_admin' | 'editor';
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    createdAt: string;
};

export default function ManageUsersPage() {
    const router = useRouter();
    const { isSuperAdmin, loading: roleLoading } = useUserRole();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [newUser, setNewUser] = useState({
        firstName: '',
        lastName: '',
        email: '',
        temporaryPassword: '',
    });

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!roleLoading && !isSuperAdmin) {
            router.push('/');
            return;
        }

        if (isSuperAdmin) {
            void loadUsers();
        }
    }, [isSuperAdmin, roleLoading, router]);

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
        });
        await loadUsers();
    };

    const handleUpdateUser = async (
        userId: string,
        patch: Partial<ManagedUser>
    ) => {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Ошибка обновления пользователя');
            return;
        }

        setUsers((current) =>
            current.map((user) => (user.id === userId ? data.user : user))
        );
    };

    const handleResetPassword = async (userId: string) => {
        const temporaryPassword = prompt('Введите новый временный пароль');
        if (!temporaryPassword) return;

        const response = await fetch(`/api/users/${userId}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temporaryPassword }),
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Ошибка сброса пароля');
            return;
        }

        await loadUsers();
    };

    if (roleLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)] text-[var(--color-grayscale-6)]">
                Загрузка...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            <header className="border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-4)] cursor-pointer"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--color-grayscale-2)]">
                                Пользователи
                            </h1>
                            <p className="text-sm text-[var(--color-grayscale-6)]">
                                Управление editor-аккаунтами
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-[var(--color-primary)]" />
                        <h2 className="text-lg font-semibold text-[var(--color-grayscale-2)]">
                            Создать editor
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <input
                            value={newUser.firstName}
                            onChange={(e) =>
                                setNewUser((current) => ({
                                    ...current,
                                    firstName: e.target.value,
                                }))
                            }
                            placeholder="Имя"
                            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                        />
                        <input
                            value={newUser.lastName}
                            onChange={(e) =>
                                setNewUser((current) => ({
                                    ...current,
                                    lastName: e.target.value,
                                }))
                            }
                            placeholder="Фамилия"
                            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                        />
                        <input
                            value={newUser.email}
                            onChange={(e) =>
                                setNewUser((current) => ({
                                    ...current,
                                    email: e.target.value,
                                }))
                            }
                            placeholder="Email"
                            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                        />
                        <input
                            value={newUser.temporaryPassword}
                            onChange={(e) =>
                                setNewUser((current) => ({
                                    ...current,
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
                    <div className="mb-4 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-[var(--color-primary)]" />
                        <h2 className="text-lg font-semibold text-[var(--color-grayscale-2)]">
                            Список пользователей
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {users.map((user) => (
                            <div
                                key={user.id}
                                className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                            >
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto_auto_auto] lg:items-center">
                                    <input
                                        value={user.firstName}
                                        disabled={user.role === 'super_admin'}
                                        onChange={(e) =>
                                            setUsers((current) =>
                                                current.map((item) =>
                                                    item.id === user.id
                                                        ? {
                                                              ...item,
                                                              firstName:
                                                                  e.target.value,
                                                          }
                                                        : item
                                                )
                                            )
                                        }
                                        className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-200 disabled:opacity-60"
                                    />
                                    <input
                                        value={user.lastName}
                                        disabled={user.role === 'super_admin'}
                                        onChange={(e) =>
                                            setUsers((current) =>
                                                current.map((item) =>
                                                    item.id === user.id
                                                        ? {
                                                              ...item,
                                                              lastName:
                                                                  e.target.value,
                                                          }
                                                        : item
                                                )
                                            )
                                        }
                                        className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-200 disabled:opacity-60"
                                    />
                                    <input
                                        value={user.email}
                                        disabled={user.role === 'super_admin'}
                                        onChange={(e) =>
                                            setUsers((current) =>
                                                current.map((item) =>
                                                    item.id === user.id
                                                        ? {
                                                              ...item,
                                                              email: e.target.value,
                                                          }
                                                        : item
                                                )
                                            )
                                        }
                                        className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-200 disabled:opacity-60"
                                    />
                                    <span className="text-sm text-zinc-400">
                                        {user.role === 'super_admin'
                                            ? 'super_admin'
                                            : 'editor'}
                                    </span>
                                    <button
                                        onClick={() =>
                                            handleUpdateUser(user.id, {
                                                firstName: user.firstName,
                                                lastName: user.lastName,
                                                email: user.email,
                                                isActive: !user.isActive
                                                    ? true
                                                    : user.role === 'super_admin'
                                                      ? true
                                                      : false,
                                            })
                                        }
                                        disabled={user.role === 'super_admin'}
                                        className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50 cursor-pointer"
                                    >
                                        {user.isActive ? 'Отключить' : 'Включить'}
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() =>
                                                handleUpdateUser(user.id, {
                                                    firstName: user.firstName,
                                                    lastName: user.lastName,
                                                    email: user.email,
                                                    isActive: user.isActive,
                                                })
                                            }
                                            disabled={user.role === 'super_admin'}
                                            className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50 cursor-pointer"
                                        >
                                            <Save className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleResetPassword(user.id)}
                                            disabled={user.role === 'super_admin'}
                                            className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 disabled:opacity-50 cursor-pointer"
                                        >
                                            <KeyRound className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-zinc-500">
                                    {user.mustChangePassword
                                        ? 'Требуется смена пароля'
                                        : 'Пароль подтвержден'}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
