import {
    closestCenter,
    pointerWithin,
    type Collision,
    type CollisionDetection,
    type DroppableContainer,
} from '@dnd-kit/core';
import { makeGroupExitDropId, parseGroupExitDropId } from '@/lib/block-tree';

type SortableData = {
    parentId?: string | null;
    type?: string;
};

const getContainerData = (
    id: string,
    containers: DroppableContainer[],
): SortableData | undefined => {
    const container = containers.find((dc) => dc.id === id);
    return container?.data.current as SortableData | undefined;
};

const isTopLevelSortable = (
    id: string,
    containers: DroppableContainer[],
): boolean => {
    if (parseGroupExitDropId(id)) return false;
    const data = getContainerData(id, containers);
    if (!data || data.type === 'group-exit') return false;
    return data.parentId == null;
};

const preferExitZones = (collisions: Collision[]): Collision[] => {
    const exitCollisions = collisions.filter((c) =>
        parseGroupExitDropId(String(c.id)),
    );
    return exitCollisions.length > 0 ? exitCollisions : collisions;
};

const filterTopLevelCollisions = (
    collisions: Collision[],
    containers: DroppableContainer[],
): Collision[] => {
    const filtered = collisions.filter((c) =>
        isTopLevelSortable(String(c.id), containers),
    );
    return filtered.length > 0 ? filtered : collisions;
};

/** Стабильный collision для сайдбара: pointer → closestCenter, фильтр по типу drag */
export const sidebarCollisionDetection: CollisionDetection = (args) => {
    const activeData = args.active.data.current as SortableData | undefined;

    let collisions = pointerWithin(args);
    if (collisions.length === 0) {
        collisions = closestCenter(args);
    }

    if (activeData?.type === 'section') {
        return filterTopLevelCollisions(collisions, args.droppableContainers);
    }

    if (activeData?.parentId) {
        const exitId = makeGroupExitDropId(activeData.parentId);
        const exitHit = collisions.filter((c) => String(c.id) === exitId);
        if (exitHit.length > 0) return exitHit;
        return preferExitZones(collisions);
    }

    return preferExitZones(collisions);
};
