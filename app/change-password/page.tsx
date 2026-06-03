'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserRole } from '@/hooks/use-user-role';

const inputClassName =
    'bg-[var(--color-grayscale-14)] border-[var(--color-alpha-3)] text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-7)] focus-visible:border-[var(--color-primary)]';

export default function ChangePasswordPage() {
    const router = useRouter();
    const { user, loading, mustChangePassword } = useUserRole();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [loading, router, user]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'Ошибка смены пароля');
                return;
            }

            router.push('/reports');
            router.refresh();
        } catch {
            setError('Ошибка подключения к серверу');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#181818] text-zinc-400">
                Загрузка...
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#181818] px-4">
            <div className="w-full max-w-md rounded-2xl border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-8 shadow-2xl">
                <h1 className="mb-2 text-2xl font-bold text-[var(--color-grayscale-3)]">
                    Смена пароля
                </h1>
                <p className="mb-6 text-sm text-[var(--color-grayscale-6)]">
                    {mustChangePassword
                        ? 'Нужно сменить временный пароль перед продолжением работы.'
                        : 'Обновите пароль для своей учетной записи.'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!mustChangePassword && (
                        <Input
                            type="password"
                            placeholder="Текущий пароль"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className={inputClassName}
                            disabled={submitting}
                        />
                    )}
                    <Input
                        type="password"
                        placeholder="Новый пароль"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputClassName}
                        disabled={submitting}
                    />

                    {error && (
                        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={submitting || !newPassword}
                        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white h-11 font-medium"
                    >
                        Сохранить пароль
                    </Button>
                </form>
            </div>
        </div>
    );
}
