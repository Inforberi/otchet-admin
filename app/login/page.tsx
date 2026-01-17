'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Eye, EyeOff, Loader2, User } from 'lucide-react';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Ошибка при входе');
                return;
            }

            // Редирект на сохраненный путь или на главную
            const redirect = searchParams.get('redirect') || '/reports';
            router.push(redirect);
            router.refresh();
        } catch (err) {
            setError('Ошибка подключения к серверу');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#181818] px-4">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] p-8 shadow-2xl">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div className="mb-4 inline-flex items-center justify-center rounded-full bg-[var(--color-primary)]/10 p-3">
                            <Lock className="h-6 w-6 text-[var(--color-primary)]" />
                        </div>
                        <h1 className="mb-2 text-2xl font-bold text-[var(--color-grayscale-3)]">
                            Вход в систему
                        </h1>
                        <p className="text-sm text-[var(--color-grayscale-6)]">
                            Введите логин и пароль для доступа к админ-панели
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Username Input */}
                        <div className="space-y-2">
                            <label
                                htmlFor="username"
                                className="text-sm font-medium text-[var(--color-grayscale-5)]"
                            >
                                Логин
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-grayscale-6)] pointer-events-none" />
                                <Input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value)
                                    }
                                    placeholder="Введите логин"
                                    className="pl-10 bg-[var(--color-grayscale-14)] border-[var(--color-alpha-3)] text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-7)] focus-visible:border-[var(--color-primary)]"
                                    disabled={loading}
                                    autoFocus
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label
                                htmlFor="password"
                                className="text-sm font-medium text-[var(--color-grayscale-5)]"
                            >
                                Пароль
                            </label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="Введите пароль"
                                    className="pr-10 bg-[var(--color-grayscale-14)] border-[var(--color-alpha-3)] text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-7)] focus-visible:border-[var(--color-primary)]"
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-grayscale-6)] hover:text-[var(--color-grayscale-4)] transition-colors cursor-pointer"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={loading || !username || !password}
                            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white h-11 font-medium"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Вход...
                                </>
                            ) : (
                                <>
                                    <Lock className="h-4 w-4" />
                                    Войти
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <p className="text-xs text-[var(--color-grayscale-7)]">
                            Защищено системой авторизации
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#181818]">
                    <div className="text-[var(--color-grayscale-6)]">
                        Загрузка...
                    </div>
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
