import {
    closestCorners,
    pointerWithin,
    type CollisionDetection,
} from '@dnd-kit/core';

/** Меньше прыжков между вложенными карточками группы и детьми */
export const sidebarCollisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
        return pointerCollisions;
    }
    return closestCorners(args);
};
