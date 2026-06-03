'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, Loader2 } from 'lucide-react';

const inputClassName =
    'bg-[var(--color-grayscale-14)] border-[var(--color-alpha-3)] text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-7)] focus-visible:border-[var(--color-primary)]';

export default function SetupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [needsSetup, setNeedsSetup] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        setupCode: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
    });

    useEffect(() => {
        fetch('/api/setup/status')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                const nextNeedsSetup = Boolean(data?.needsSetup);
                setNeedsSetup(nextNeedsSetup);
                if (!nextNeedsSetup) {
                    router.push('/login');
                }
            })
            .finally(() => setChecking(false));
    }, [router]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/setup/bootstrap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'Ошибка первичной настройки');
                return;
            }

            router.push('/reports');
            router.refresh();
        } catch {
            setError('Ошибка подключения к серверу');
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#181818] text-zinc-400">
                Загрузка...
            </div>
        );
    }

    if (!needsSetup) return null;

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#181818] px-4">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex items-center justify-center rounded-full bg-[var(--color-primary)]/10 p-3">
                        <KeyRound className="h-6 w-6 text-[var(--color-primary)]" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-[var(--color-grayscale-3)]">
                        Первичная настройка
                    </h1>
                    <p className="text-sm text-[var(--color-grayscale-6)]">
                        Создайте первого super-admin
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        placeholder="Код настройки"
                        value={form.setupCode}
                        onChange={(e) =>
                            setForm((current) => ({
                                ...current,
                                setupCode: e.target.value,
                            }))
                        }
                        className={inputClassName}
                        disabled={loading}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            placeholder="Имя"
                            value={form.firstName}
                            onChange={(e) =>
                                setForm((current) => ({
                                    ...current,
                                    firstName: e.target.value,
                                }))
                            }
                            className={inputClassName}
                            disabled={loading}
                        />
                        <Input
                            placeholder="Фамилия"
                            value={form.lastName}
                            onChange={(e) =>
                                setForm((current) => ({
                                    ...current,
                                    lastName: e.target.value,
                                }))
                            }
                            className={inputClassName}
                            disabled={loading}
                        />
                    </div>
                    <Input
                        type="email"
                        placeholder="Email"
                        value={form.email}
                        onChange={(e) =>
                            setForm((current) => ({
                                ...current,
                                email: e.target.value,
                            }))
                        }
                        className={inputClassName}
                        disabled={loading}
                    />
                    <Input
                        type="password"
                        placeholder="Пароль"
                        value={form.password}
                        onChange={(e) =>
                            setForm((current) => ({
                                ...current,
                                password: e.target.value,
                            }))
                        }
                        className={inputClassName}
                        disabled={loading}
                    />

                    {error && (
                        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={
                            loading ||
                            !form.setupCode ||
                            !form.firstName ||
                            !form.lastName ||
                            !form.email ||
                            !form.password
                        }
                        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white h-11 font-medium"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Настройка...
                            </>
                        ) : (
                            'Создать super-admin'
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
