import type { BlockDragIntent } from '@/lib/block-tree';

export const BLOCK_DRAG_INTENT_CARD_CLASS: Record<BlockDragIntent, string> = {
    none: '',
    enterGroup:
        'ring-2 ring-amber-500/80 border-amber-500/60 bg-amber-500/15 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]',
    exitGroup:
        'ring-2 ring-sky-500/80 border-sky-500/60 bg-sky-500/15 shadow-[0_0_0_1px_rgba(14,165,233,0.2)]',
    moveBetweenGroups:
        'ring-2 ring-amber-400/70 border-amber-400/50 bg-amber-500/10',
    reorderInGroup:
        'ring-2 ring-violet-500/50 border-violet-500/40 bg-violet-500/10',
    reorderTop: 'ring-2 ring-zinc-400/50 border-zinc-500/40 bg-zinc-500/10',
    moveGroup:
        'ring-2 ring-amber-500/60 border-amber-500/40 bg-amber-500/10',
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
