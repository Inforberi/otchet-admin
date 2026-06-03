import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Система управления отчетами',
    description:
        'Создание и управление профессиональными отчетами с текстовыми блоками, изображениями и форматированием',
    generator: 'Next.js',
    icons: {
        icon: [
            {
                url: '/icons/report.svg',
                type: 'image/svg+xml',
            },
        ],
        apple: '/apple-icon.png',
    },
};

const enableVercelAnalytics =
    process.env.VERCEL === '1' ||
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true';

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ru">
            <body className={`font-sans antialiased`}>
                {children}
                {enableVercelAnalytics ? <Analytics /> : null}
            </body>
        </html>
    );
}
