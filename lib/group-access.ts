import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth';
import { canEditContent } from '@/lib/auth';

export const getAccessibleGroupIds = async (
    user: AuthenticatedUser
): Promise<string[] | null> => {
    if (canEditContent(user) && !user.restrictGroups) {
        return null;
    }

    if (canEditContent(user) && user.restrictGroups) {
        const rows = await prisma.appRoleGroup.findMany({
            where: { roleId: user.appRoleId },
            select: { groupId: true },
        });
        return rows.map((row) => row.groupId);
    }

    const rows = await prisma.appRoleGroup.findMany({
        where: { roleId: user.appRoleId },
        select: { groupId: true },
    });

    return rows.map((row) => row.groupId);
};

export const getAccessibleGroupFilter = async (
    user: AuthenticatedUser | null
): Promise<{ id: { in: string[] } } | undefined> => {
    if (!user) return undefined;

    const groupIds = await getAccessibleGroupIds(user);
    if (groupIds === null) {
        return undefined;
    }

    if (groupIds.length === 0) {
        return { id: { in: [] } };
    }

    const allGroups = await prisma.reportGroup.findMany({
        select: { id: true, path: true },
    });

    const allowedRoots = new Set(groupIds);
    const accessibleIds = allGroups
        .filter((group) =>
            [...allowedRoots].some((rootId) => {
                const root = allGroups.find((g) => g.id === rootId);
                if (!root) return false;
                return (
                    group.id === rootId ||
                    group.path.startsWith(`${root.path}/`)
                );
            })
        )
        .map((group) => group.id);

    return { id: { in: accessibleIds } };
};

export const canAccessGroupId = async (
    user: AuthenticatedUser | null,
    groupId: string
): Promise<boolean> => {
    if (!user) return false;

    const filter = await getAccessibleGroupFilter(user);
    if (!filter) return true;
    return filter.id.in.includes(groupId);
};
