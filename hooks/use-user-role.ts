import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type CurrentUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    appRoleId: string;
    roleName: string;
    canEditContent: boolean;
    canManageUsers: boolean;
    mustChangePassword: boolean;
} | null;

export function useUserRole() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<CurrentUser>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                setUser(data?.user || null);
            })
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
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

    const isAuthenticated = Boolean(user);
    const canEdit = user?.canEditContent ?? false;
    const canManageUsers = user?.canManageUsers ?? false;
    const isSuperAdmin = canManageUsers;
    const isViewer = isAuthenticated && !canEdit;

    return {
        user,
        loading,
        isAuthenticated,
        roleName: user?.roleName ?? null,
        canEdit,
        canManageUsers,
        isSuperAdmin,
        isViewer,
        isAdmin: canEdit,
        mustChangePassword: user?.mustChangePassword ?? false,
    };
}
