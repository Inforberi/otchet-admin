import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'admin_session';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const decodeBase64Url = (value: string): string => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    return atob(base64 + padding);
};

const verifySessionToken = async (token: string | undefined): Promise<boolean> => {
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [header, payload, signature] = parts;

    try {
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(JWT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const expectedSignatureBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(`${header}.${payload}`)
        );

        const expectedSignature = btoa(
            String.fromCharCode(...new Uint8Array(expectedSignatureBuffer))
        )
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');

        if (expectedSignature !== signature) {
            return false;
        }

        const parsedPayload = JSON.parse(
            decodeBase64Url(payload)
        ) as { exp?: number };

        return Boolean(
            parsedPayload.exp &&
                parsedPayload.exp > Math.floor(Date.now() / 1000)
        );
    } catch {
        return false;
    }
};

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const publicPaths = [
        '/login',
        '/setup',
        '/api/auth/login',
        '/api/auth/me',
        '/api/setup',
    ];

    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));
    if (isPublicPath) {
        return NextResponse.next();
    }

    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isAuthenticated = await verifySessionToken(sessionToken);

    if (!isAuthenticated) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
