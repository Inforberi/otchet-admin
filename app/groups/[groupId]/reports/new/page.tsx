'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { useUserRole } from '@/hooks/use-user-role';

export default function NewReportPage() {
    const router = useRouter();
    const params = useParams();
    const groupId = params.groupId as string;
    const { isAdmin, loading: roleLoading } = useUserRole();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        client: '',
        date: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        if (!roleLoading && !isAdmin) {
            router.push(`/groups/${groupId}`);
        }
    }, [isAdmin, roleLoading, router, groupId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) return;

        setLoading(true);

        try {
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    groupId,
                }),
            });

            if (response.ok) {
                const { report } = await response.json();
                router.push(`/groups/${groupId}/reports/${report.id}/edit`);
            } else {
                const data = await response.json();
                alert(data.error || 'Ошибка создания отчета');
            }
        } catch (error) {
            console.error('Error creating report:', error);
            alert('Ошибка создания отчета');
        } finally {
            setLoading(false);
        }
    };

    if (roleLoading || !isAdmin) {
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
                <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/groups/${groupId}`)}
                            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--color-grayscale-2)]">
                                Новый отчет
                            </h1>
                            <p className="text-sm text-[var(--color-grayscale-6)]">
                                Заполните основную информацию
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-6">
                        <h2 className="mb-4 text-lg font-semibold text-[var(--color-grayscale-3)]">
                            Метаданные отчета
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                                    Название отчета{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            title: e.target.value,
                                        })
                                    }
                                    placeholder="Анализ производительности веб-сайта"
                                    required
                                    className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                                    Подзаголовок
                                </label>
                                <input
                                    type="text"
                                    value={formData.subtitle}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            subtitle: e.target.value,
                                        })
                                    }
                                    placeholder="Результаты аудита и рекомендации"
                                    className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                                        Клиент
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.client}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                client: e.target.value,
                                            })
                                        }
                                        placeholder="ООО «Компания»"
                                        className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                                        Дата
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                date: e.target.value,
                                            })
                                        }
                                        className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={loading || !formData.title}
                            className="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            <Save className="h-5 w-5" />
                            {loading
                                ? 'Создание...'
                                : 'Создать и перейти к редактору'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push(`/groups/${groupId}`)}
                            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-3 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                        >
                            Отмена
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
