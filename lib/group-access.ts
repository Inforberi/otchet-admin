import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth';
import { canEditContent, canManageUsers } from '@/lib/auth';

export type GroupAccessOptions = {
    showHidden?: boolean;
};

type GroupRow = {
    id: string;
    path: string;
    isHidden: boolean;
    createdByUserId: string | null;
};

export const getGroupAccessOptionsFromRequest = (
    request: NextRequest
): GroupAccessOptions => ({
    showHidden: request.nextUrl.searchParams.get('showHidden') === '1',
});

const expandGroupIdsByPath = (
    groupIds: string[],
    allGroups: Pick<GroupRow, 'id' | 'path'>[]
): string[] => {
    const allowedRoots = new Set(groupIds);
    return allGroups
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
};

const findHiddenRoot = (
    group: Pick<GroupRow, 'id' | 'path'>,
    hiddenRoots: GroupRow[]
): GroupRow | null => {
    const self = hiddenRoots.find((root) => root.id === group.id);
    if (self) return self;

    return (
        hiddenRoots.find((root) => group.path.startsWith(`${root.path}/`)) ??
        null
    );
};

const isGroupVisibleByHiddenRules = (
    group: GroupRow,
    hiddenRoots: GroupRow[],
    user: AuthenticatedUser,
    options?: GroupAccessOptions
): boolean => {
    const hiddenRoot = findHiddenRoot(group, hiddenRoots);
    if (!hiddenRoot) return true;

    if (hiddenRoot.createdByUserId === user.id) return true;
    if (canManageUsers(user) && options?.showHidden) return true;

    return false;
};

export const getAccessibleGroupIds = async (
    user: AuthenticatedUser
): Promise<string[] | null> => {
    if (canEditContent(user) && !user.restrictGroups) {
        return null;
    }

    const rows = await prisma.appRoleGroup.findMany({
        where: { roleId: user.appRoleId },
        select: { groupId: true },
    });

    return rows.map((row) => row.groupId);
};

export const getAccessibleGroupFilter = async (
    user: AuthenticatedUser | null,
    options?: GroupAccessOptions
): Promise<{ id: { in: string[] } } | undefined> => {
    if (!user) return undefined;

    const allGroups = await prisma.reportGroup.findMany({
        select: {
            id: true,
            path: true,
            isHidden: true,
            createdByUserId: true,
        },
    });

    const hiddenRoots = allGroups.filter((group) => group.isHidden);
    const visibleByHidden = allGroups
        .filter((group) =>
            isGroupVisibleByHiddenRules(group, hiddenRoots, user, options)
        )
        .map((group) => group.id);

    const groupIds = await getAccessibleGroupIds(user);
    let roleAllowedIds: string[];

    if (groupIds === null) {
        roleAllowedIds = allGroups.map((group) => group.id);
    } else if (groupIds.length === 0) {
        return { id: { in: [] } };
    } else {
        roleAllowedIds = expandGroupIdsByPath(groupIds, allGroups);
    }

    const visibleSet = new Set(visibleByHidden);
    const accessibleIds = roleAllowedIds.filter((id) => visibleSet.has(id));

    if (accessibleIds.length === 0) {
        return { id: { in: [] } };
    }

    return { id: { in: accessibleIds } };
};

export const canAccessGroupId = async (
    user: AuthenticatedUser | null,
    groupId: string,
    options?: GroupAccessOptions
): Promise<boolean> => {
    if (!user) return false;

    const filter = await getAccessibleGroupFilter(user, options);
    if (!filter) return true;
    return filter.id.in.includes(groupId);
};
