'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { useUserRole } from '@/hooks/use-user-role';

interface ReportGroup {
    id: string;
    name: string;
    path: string;
}

function NewReportPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAdmin, loading: roleLoading } = useUserRole();
    const groupPath = searchParams.get('groupPath')?.trim() || '';
    const groupTarget = groupPath ? `/${groupPath}` : '/';

    const [loading, setLoading] = useState(false);
    const [group, setGroup] = useState<ReportGroup | null>(null);
    const [groupLoading, setGroupLoading] = useState(true);
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        client: '',
        date: new Date().toISOString().split('T')[0],
    });

    const canSubmit = useMemo(() => {
        return Boolean(group?.id && formData.title.trim());
    }, [formData.title, group?.id]);

    useEffect(() => {
        if (!roleLoading && !isAdmin) {
            router.push(groupTarget);
        }
    }, [groupTarget, isAdmin, roleLoading, router]);

    useEffect(() => {
        if (!groupPath) {
            setGroup(null);
            setGroupLoading(false);
            return;
        }

        const loadGroup = async () => {
            try {
                setGroupLoading(true);
                const response = await fetch(`/api/groups/by-path/${groupPath}`);
                if (!response.ok) {
                    setGroup(null);
                    return;
                }

                const data = await response.json();
                setGroup(data.group ?? null);
            } catch (error) {
                console.error('Error loading group:', error);
                setGroup(null);
            } finally {
                setGroupLoading(false);
            }
        };

        loadGroup();
    }, [groupPath]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin || !group?.id) return;

        setLoading(true);

        try {
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    groupId: group.id,
                }),
            });

            if (response.ok) {
                const { report } = await response.json();
                router.push(`/reports/${report.id}/edit`);
                return;
            }

            const data = await response.json();
            alert(data.error || 'Ошибка создания отчета');
        } catch (error) {
            console.error('Error creating report:', error);
            alert('Ошибка создания отчета');
        } finally {
            setLoading(false);
        }
    };

    if (roleLoading || !isAdmin || groupLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#181818]">
                <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-grayscale-16)]">
            <header className="sticky top-0 z-40 border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]/95 backdrop-blur">
                <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(groupTarget)}
                            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-2 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--color-grayscale-2)]">
                                Новый отчет
                            </h1>
                            <p className="text-sm text-[var(--color-grayscale-6)]">
                                {group
                                    ? `Группа: ${group.name}`
                                    : 'Сначала откройте нужную группу'}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
                {!group ? (
                    <div className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-6">
                        <p className="mb-4 text-[var(--color-grayscale-5)]">
                            Для создания отчета нужно открыть конкретную группу.
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push('/')}
                            className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                        >
                            Перейти к группам
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-6">
                            <h2 className="mb-4 text-lg font-semibold text-[var(--color-grayscale-3)]">
                                Метаданные отчета
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                                        Название отчета <span className="text-red-500">*</span>
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
                                disabled={loading || !canSubmit}
                                className="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <Save className="h-5 w-5" />
                                {loading
                                    ? 'Создание...'
                                    : 'Создать и перейти к редактору'}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push(groupTarget)}
                                className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-3 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                            >
                                Отмена
                            </button>
                        </div>
                    </form>
                )}
            </main>
        </div>
    );
}

export default function NewReportPage() {
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
            <NewReportPageContent />
        </Suspense>
    );
}
