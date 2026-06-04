import type { BlockDragIntent } from '@/lib/block-tree';

/** Только border/bg — без outline/ring, чтобы не дёргал layout при drag */
export const BLOCK_DRAG_INTENT_CARD_CLASS: Record<BlockDragIntent, string> = {
    none: '',
    enterGroup: 'border-amber-500/55 bg-amber-500/10',
    exitGroup: 'border-sky-500/55 bg-sky-500/10',
    moveBetweenGroups: 'border-amber-400/50 bg-amber-500/8',
    reorderInGroup: 'border-violet-500/45 bg-violet-500/8',
    reorderTop: 'border-zinc-500/45 bg-zinc-500/8',
    moveGroup: 'border-amber-500/50 bg-amber-500/8',
};

export const BLOCK_DRAG_INTENT_LABEL_CLASS: Record<
    Exclude<BlockDragIntent, 'none'>,
    string
> = {
    enterGroup: 'text-amber-300',
    exitGroup: 'text-sky-300',
    moveBetweenGroups: 'text-amber-200',
    reorderInGroup: 'text-violet-300',
    reorderTop: 'text-zinc-400',
    moveGroup: 'text-amber-300',
};

export const BLOCK_DRAG_INTENT_BANNER_CLASS: Record<
    Exclude<BlockDragIntent, 'none'>,
    string
> = {
    enterGroup: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
    exitGroup: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
    moveBetweenGroups: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
    reorderInGroup: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
    reorderTop: 'border-zinc-600 bg-zinc-800/80 text-zinc-300',
    moveGroup: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
};
