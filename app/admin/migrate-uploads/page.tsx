'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MigrateUploadsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        results?: {
            processed: number;
            moved: number;
            skipped: number;
            errors: string[];
        };
        error?: string;
        details?: string;
    } | null>(null);

    const handleMigrate = async () => {
        if (!confirm('Запустить миграцию файлов? Это переместит все файлы в новую структуру папок.')) {
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/admin/migrate-uploads', {
                method: 'POST',
            });

            const data = await response.json();
            setResult(data);
        } catch (error) {
            setResult({
                success: false,
                error: 'Ошибка при выполнении миграции',
                details: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white shadow rounded-lg p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Миграция файлов в новую структуру
                    </h1>

                    <p className="text-gray-600 mb-6">
                        Этот инструмент переместит все файлы из папки uploads в новую структуру:
                        <code className="block mt-2 p-2 bg-gray-100 rounded">
                            uploads/&#123;groupFolder&#125;/&#123;reportFolder&#125;/&#123;filename&#125;
                        </code>
                    </p>

                    <button
                        onClick={handleMigrate}
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Миграция...' : 'Запустить миграцию'}
                    </button>

                    {result && (
                        <div className={`mt-6 p-4 rounded-md ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
                            <h2 className={`font-semibold mb-2 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                                {result.success ? 'Миграция завершена' : 'Ошибка миграции'}
                            </h2>

                            {result.success && result.results && (
                                <div className="text-sm text-gray-700 space-y-1">
                                    <p>Обработано: {result.results.processed}</p>
                                    <p className="text-green-700">Перемещено: {result.results.moved}</p>
                                    <p className="text-yellow-700">Пропущено: {result.results.skipped}</p>
                                    {result.results.errors.length > 0 && (
                                        <div className="mt-3">
                                            <p className="font-semibold text-red-700">Ошибки ({result.results.errors.length}):</p>
                                            <ul className="list-disc list-inside mt-1 space-y-1">
                                                {result.results.errors.slice(0, 10).map((error, idx) => (
                                                    <li key={idx} className="text-red-600 text-xs">
                                                        {error}
                                                    </li>
                                                ))}
                                                {result.results.errors.length > 10 && (
                                                    <li className="text-gray-500 text-xs">
                                                        ... и еще {result.results.errors.length - 10} ошибок
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!result.success && (
                                <div className="text-sm text-red-700">
                                    <p>{result.error}</p>
                                    {result.details && (
                                        <p className="mt-2 text-xs">{result.details}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
