import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const MIME_BY_EXT: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
};

function getUploadDir(): string {
    if (path.isAbsolute(UPLOAD_DIR)) {
        return UPLOAD_DIR;
    }
    return path.join(process.cwd(), UPLOAD_DIR);
}

function encodeUploadPath(pathAfterPrefix: string): string {
    return pathAfterPrefix
        .split('/')
        .map((segment) => {
            try {
                return encodeURIComponent(decodeURIComponent(segment));
            } catch {
                return encodeURIComponent(segment);
            }
        })
        .join('/');
}

function resolveRelativeUploadPath(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('/api/static/uploads/')) {
        return trimmed.substring('/api/static/uploads/'.length);
    }
    if (trimmed.startsWith('/uploads/')) {
        return trimmed.substring('/uploads/'.length);
    }
    if (trimmed.startsWith('/')) {
        return null;
    }
    return trimmed;
}

async function readUploadAsDataUri(relativePath: string): Promise<string | null> {
    const decoded = relativePath
        .split('/')
        .map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        })
        .join('/');

    const filePath = path.join(getUploadDir(), decoded);
    if (!existsSync(filePath)) {
        console.warn('[pdf] upload not found:', filePath);
        return null;
    }

    const ext = path.extname(decoded).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    const buffer = await readFile(filePath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
}

/** URL для PDF: локальные upload — data URI, внешние http(s) — как есть, иначе baseUrl. */
export async function resolvePdfImageSrc(
    url: string,
    baseUrl: string
): Promise<string> {
    if (!url?.trim()) return '';

    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    const relative = resolveRelativeUploadPath(url);
    if (relative) {
        const dataUri = await readUploadAsDataUri(relative);
        if (dataUri) return dataUri;
        return `${baseUrl}/api/static/uploads/${encodeUploadPath(relative)}`;
    }

    if (url.startsWith('/')) {
        const pathWithoutSlash = url.substring(1);
        const encodedPath = pathWithoutSlash
            .split('/')
            .map((segment) => {
                try {
                    return encodeURIComponent(decodeURIComponent(segment));
                } catch {
                    return encodeURIComponent(segment);
                }
            })
            .join('/');
        return `${baseUrl}/${encodedPath}`;
    }

    return `${baseUrl}/api/static/uploads/${encodeUploadPath(url)}`;
}
