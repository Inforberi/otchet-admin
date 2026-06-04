import type { ReportBlockFromDB } from '@/lib/db-types';

export const sortBlocksByPosition = (
    blocks: ReportBlockFromDB[]
): ReportBlockFromDB[] => [...blocks].sort((a, b) => a.position - b.position);

export const reindexBlockPositions = (
    blocks: ReportBlockFromDB[]
): ReportBlockFromDB[] =>
    blocks.map((block, index) => ({
        ...block,
        position: index,
    }));

export const insertBlockAt = (
    blocks: ReportBlockFromDB[],
    newBlock: ReportBlockFromDB,
    afterId?: string | null
): ReportBlockFromDB[] => {
    const sorted = sortBlocksByPosition(blocks);
    if (!afterId) {
        return reindexBlockPositions([...sorted, newBlock]);
    }
    const index = sorted.findIndex((b) => b.id === afterId);
    if (index === -1) {
        return reindexBlockPositions([...sorted, newBlock]);
    }
    const next = [...sorted];
    next.splice(index + 1, 0, newBlock);
    return reindexBlockPositions(next);
};
