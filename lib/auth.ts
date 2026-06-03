import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

const SESSION_COOKIE_NAME = 'admin_session';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export type UserRole = 'super_admin' | 'editor';

export type AuthenticatedUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    mustChangePassword: boolean;
    isActive: boolean;
};

type SessionPayload = {
    sub: string;
    role: UserRole;
    iat: number;
    exp: number;
};

const encodeBase64Url = (value: string | Buffer): string =>
    Buffer.from(value).toString('base64url');

const decodeBase64Url = (value: string): string =>
    Buffer.from(value, 'base64url').toString('utf-8');

const signJwt = (payload: SessionPayload): string => {
    const header = {
        alg: 'HS256',
        typ: 'JWT',
    };

    const encodedHeader = encodeBase64Url(JSON.stringify(header));
    const encodedPayload = encodeBase64Url(JSON.stringify(payload));
    const signature = createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const verifyJwt = (token: string): SessionPayload | null => {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest();

    const actualSignature = Buffer.from(signature, 'base64url');
    if (
        expectedSignature.length !== actualSignature.length ||
        !timingSafeEqual(expectedSignature, actualSignature)
    ) {
        return null;
    }

    try {
        const payload = JSON.parse(
            decodeBase64Url(encodedPayload)
        ) as SessionPayload;

        if (!payload.sub || !payload.role || !payload.exp || !payload.iat) {
            return null;
        }

        if (payload.exp <= Math.floor(Date.now() / 1000)) {
            return null;
        }

        if (payload.role !== 'super_admin' && payload.role !== 'editor') {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
};

export const normalizeEmail = (email: string): string =>
    email.trim().toLowerCase();

export const hashPassword = (password: string): string => {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
};

export const verifyPassword = (
    password: string,
    storedHash: string
): boolean => {
    const [scheme, salt, hash] = storedHash.split(':');
    if (scheme !== 'scrypt' || !salt || !hash) return false;

    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');

    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
};

export const createSession = (userId: string, role: UserRole): string => {
    const now = Math.floor(Date.now() / 1000);
    return signJwt({
        sub: userId,
        role,
        iat: now,
        exp: now + SESSION_MAX_AGE_SECONDS,
    });
};

export const getSessionPayload = (
    sessionToken: string | undefined
): SessionPayload | null => {
    if (!sessionToken) return null;
    return verifyJwt(sessionToken);
};

export const getSessionRole = (
    sessionToken: string | undefined
): UserRole | null => getSessionPayload(sessionToken)?.role ?? null;

export const isValidSession = (sessionToken: string | undefined): boolean =>
    getSessionPayload(sessionToken) !== null;

export const requireAdmin = (role: UserRole | null): boolean => role !== null;

export const getSession = async (): Promise<string | null> => {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME);
    return session?.value || null;
};

export const setSession = async (sessionToken: string): Promise<void> => {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: '/',
    });
};

export const deleteSession = async (): Promise<void> => {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
};

export const getRequestRole = async (
    request: NextRequest
): Promise<UserRole | null> => {
    const currentUser = await getCurrentUserFromRequest(request);
    return currentUser?.role ?? null;
};

export const getCurrentUserFromRequest = async (
    request: NextRequest
): Promise<AuthenticatedUser | null> => {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = getSessionPayload(sessionToken);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            mustChangePassword: true,
            isActive: true,
        },
    });

    if (!user || !user.isActive) {
        return null;
    }

    if (user.role !== payload.role) {
        return null;
    }

    return user as AuthenticatedUser;
};

export const getCurrentUserFromSession = async (): Promise<AuthenticatedUser | null> => {
    const sessionToken = await getSession();
    const payload = getSessionPayload(sessionToken ?? undefined);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            mustChangePassword: true,
            isActive: true,
        },
    });

    if (!user || !user.isActive || user.role !== payload.role) {
        return null;
    }

    return user as AuthenticatedUser;
};
