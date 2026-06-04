import { chromium, type Browser } from 'playwright';

const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
] as const;

/** Запуск Chromium для PDF (PLAYWRIGHT_BROWSERS_PATH в Docker). */
export async function launchPdfBrowser(): Promise<Browser> {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();

    try {
        return await chromium.launch({
            headless: true,
            executablePath: executablePath || undefined,
            args: [...LAUNCH_ARGS],
        });
    } catch (firstError) {
        const message =
            firstError instanceof Error ? firstError.message : String(firstError);

        if (!message.includes("Executable doesn't exist") && !executablePath) {
            throw firstError;
        }

        const fallbackPath = chromium.executablePath();
        console.warn('[pdf] chromium.launch failed, retrying with', fallbackPath);

        return chromium.launch({
            headless: true,
            executablePath: fallbackPath,
            args: [...LAUNCH_ARGS],
        });
    }
}
