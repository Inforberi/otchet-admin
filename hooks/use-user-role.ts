import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type UserRole = 'super_admin' | 'editor' | null;

export type CurrentUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Exclude<UserRole, null>;
    mustChangePassword: boolean;
} | null;

export function useUserRole() {
    const router = useRouter();
    const pathname = usePathname();
    const [role, setRole] = useState<UserRole>(null);
    const [user, setUser] = useState<CurrentUser>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => {
                if (res.ok) return res.json();
                return null;
            })
            .then((data) => {
                setRole(data?.role || null);
                setUser(data?.user || null);
            })
            .catch(() => {
                setRole(null);
                setUser(null);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (
            !loading &&
            user?.mustChangePassword &&
            pathname !== '/change-password'
        ) {
            router.push('/change-password');
        }
    }, [loading, pathname, router, user]);

    const isAdmin = role !== null;
    const isSuperAdmin = role === 'super_admin';
    const isEditor = role === 'editor';

    return {
        role,
        user,
        loading,
        isAdmin,
        isSuperAdmin,
        isEditor,
        mustChangePassword: user?.mustChangePassword ?? false,
    };
}
