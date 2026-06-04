import type { ReportBlockFromDB, SectionBlockData } from '@/lib/db-types';
import {
    reindexBlockPositions,
    sortBlocksByPosition,
} from '@/lib/report-block-order';

const arrayMove = <T>(items: T[], from: number, to: number): T[] => {
    const next = [...items];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    return next;
};

export type EditorTreeNode =
    | { kind: 'section'; section: ReportBlockFromDB; children: ReportBlockFromDB[] }
    | { kind: 'block'; block: ReportBlockFromDB };

export const getTopLevelNodeId = (node: EditorTreeNode): string =>
    node.kind === 'section' ? node.section.id : node.block.id;

export const validateTree = (blocks: ReportBlockFromDB[]): ReportBlockFromDB[] => {
    const byId = new Map(blocks.map((b) => [b.id, b]));
    return blocks.map((block) => {
        if (block.type === 'section' && block.parentId) {
            return { ...block, parentId: null };
        }
        if (block.parentId) {
            const parent = byId.get(block.parentId);
            if (!parent || parent.type !== 'section') {
                return { ...block, parentId: null };
            }
        }
        return block;
    });
};

export const buildEditorTree = (blocks: ReportBlockFromDB[]): EditorTreeNode[] => {
    const sorted = sortBlocksByPosition(validateTree(blocks));
    const nodes: EditorTreeNode[] = [];
    let i = 0;

    while (i < sorted.length) {
        const block = sorted[i];
        if (block.type === 'section') {
            const children: ReportBlockFromDB[] = [];
            let j = i + 1;
            while (j < sorted.length && sorted[j].parentId === block.id) {
                children.push(sorted[j]);
                j += 1;
            }
            nodes.push({ kind: 'section', section: block, children });
            i = j;
            continue;
        }
        if (!block.parentId) {
            nodes.push({ kind: 'block', block });
            i += 1;
            continue;
        }
        nodes.push({ kind: 'block', block: { ...block, parentId: null } });
        i += 1;
    }

    return nodes;
};

export const flattenTree = (nodes: EditorTreeNode[]): ReportBlockFromDB[] => {
    const out: ReportBlockFromDB[] = [];
    for (const node of nodes) {
        if (node.kind === 'section') {
            out.push({ ...node.section, parentId: null });
            for (const child of node.children) {
                out.push({ ...child, parentId: node.section.id });
            }
        } else {
            out.push({ ...node.block, parentId: null });
        }
    }
    return reindexBlockPositions(out);
};

export const getTargetSectionId = (
    blocks: ReportBlockFromDB[],
    selectedBlockId: string | null
): string | null => {
    if (!selectedBlockId) return null;
    const selected = blocks.find((b) => b.id === selectedBlockId);
    if (!selected) return null;
    if (selected.type === 'section') return selected.id;
    return selected.parentId ?? null;
};

export const insertBlockInGroup = (
    blocks: ReportBlockFromDB[],
    newBlock: ReportBlockFromDB,
    parentSectionId: string,
    afterId?: string | null
): ReportBlockFromDB[] => {
    const sorted = sortBlocksByPosition(blocks);
    const sectionIndex = sorted.findIndex((b) => b.id === parentSectionId);
    if (sectionIndex === -1) return reindexBlockPositions([...sorted, newBlock]);

    let insertIndex = sectionIndex + 1;
    for (let i = sectionIndex + 1; i < sorted.length; i += 1) {
        if (sorted[i].parentId === parentSectionId) {
            insertIndex = i + 1;
        } else if (!sorted[i].parentId || sorted[i].type === 'section') {
            break;
        }
    }

    if (afterId) {
        const afterIndex = sorted.findIndex((b) => b.id === afterId);
        if (afterIndex !== -1 && sorted[afterIndex]?.parentId === parentSectionId) {
            insertIndex = afterIndex + 1;
        }
    }

    const next = [...sorted];
    next.splice(insertIndex, 0, { ...newBlock, parentId: parentSectionId });
    return reindexBlockPositions(next);
};

export const getBlocksToDeleteWithGroup = (
    blocks: ReportBlockFromDB[],
    id: string
): string[] => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return [];
    if (block.type !== 'section') return [id];
    return [
        id,
        ...blocks.filter((b) => b.parentId === id).map((b) => b.id),
    ];
};

export const moveTopLevelNode = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    overId: string
): ReportBlockFromDB[] => {
    const tree = buildEditorTree(blocks);
    const topIds = tree.map(getTopLevelNodeId);
    const oldIndex = topIds.indexOf(activeId);
    const newIndex = topIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return blocks;
    }
    return flattenTree(arrayMove(tree, oldIndex, newIndex));
};

export const moveChildInGroup = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    overId: string
): ReportBlockFromDB[] => {
    const active = blocks.find((b) => b.id === activeId);
    if (!active?.parentId) return blocks;

    const tree = buildEditorTree(blocks);
    const sectionIndex = tree.findIndex(
        (n) => n.kind === 'section' && n.section.id === active.parentId
    );
    if (sectionIndex === -1) return blocks;

    const node = tree[sectionIndex];
    if (node.kind !== 'section') return blocks;

    const childIds = node.children.map((c) => c.id);
    const oldIndex = childIds.indexOf(activeId);
    const newIndex = childIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return blocks;
    }

    const nextTree = [...tree];
    nextTree[sectionIndex] = {
        kind: 'section',
        section: node.section,
        children: arrayMove(node.children, oldIndex, newIndex),
    };
    return flattenTree(nextTree);
};

export const isSectionCollapsed = (section: ReportBlockFromDB): boolean =>
    Boolean((section.data as SectionBlockData).collapsed);

export const setSectionCollapsed = (
    section: ReportBlockFromDB,
    collapsed: boolean
): ReportBlockFromDB => ({
    ...section,
    data: {
        ...(section.data as SectionBlockData),
        collapsed,
    },
});

export const getSectionChildCount = (
    blocks: ReportBlockFromDB[],
    sectionId: string
): number => blocks.filter((b) => b.parentId === sectionId).length;

const removeBlockFromSorted = (
    sorted: ReportBlockFromDB[],
    blockId: string
): { sorted: ReportBlockFromDB[]; block: ReportBlockFromDB | null } => {
    const index = sorted.findIndex((b) => b.id === blockId);
    if (index === -1) {
        return { sorted, block: null };
    }
    const block = sorted[index];
    return {
        sorted: [...sorted.slice(0, index), ...sorted.slice(index + 1)],
        block,
    };
};

/** Целевая секция при drop на section или на её ребёнка */
const resolveTargetSectionId = (over: ReportBlockFromDB): string | null => {
    if (over.type === 'section') return over.id;
    return over.parentId ?? null;
};

/** Вставить блок в группу (перед insertBeforeChildId или в конец группы) */
export const moveBlockIntoSection = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    sectionId: string,
    insertBeforeChildId?: string | null
): ReportBlockFromDB[] => {
    const { sorted, block } = removeBlockFromSorted(
        sortBlocksByPosition(validateTree(blocks)),
        activeId
    );
    if (!block || block.type === 'section') return blocks;

    const reparented: ReportBlockFromDB = { ...block, parentId: sectionId };
    const sectionIndex = sorted.findIndex((b) => b.id === sectionId);
    if (sectionIndex === -1) return blocks;

    let insertIndex = sectionIndex + 1;
    for (let i = sectionIndex + 1; i < sorted.length; i += 1) {
        if (sorted[i].parentId === sectionId) {
            insertIndex = i + 1;
        } else if (!sorted[i].parentId || sorted[i].type === 'section') {
            break;
        }
    }

    if (insertBeforeChildId) {
        const beforeIndex = sorted.findIndex((b) => b.id === insertBeforeChildId);
        if (beforeIndex !== -1 && sorted[beforeIndex]?.parentId === sectionId) {
            insertIndex = beforeIndex;
        }
    }

    const next = [...sorted];
    next.splice(insertIndex, 0, reparented);
    return reindexBlockPositions(next);
};

/** Вынести блок из группы сразу после секции (top-level, под группой) */
export const moveBlockAfterSection = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    sectionId: string
): ReportBlockFromDB[] => {
    const { sorted, block } = removeBlockFromSorted(
        sortBlocksByPosition(validateTree(blocks)),
        activeId
    );
    if (!block || block.type === 'section') return blocks;

    const reparented: ReportBlockFromDB = { ...block, parentId: null };
    const tree = buildEditorTree(sorted);
    const sectionIndex = tree.findIndex(
        (n) => n.kind === 'section' && n.section.id === sectionId
    );
    if (sectionIndex === -1) {
        return reindexBlockPositions([...sorted, reparented]);
    }

    const nextTree = [...tree];
    nextTree.splice(sectionIndex + 1, 0, { kind: 'block', block: reparented });
    return flattenTree(nextTree);
};

/** Плоский порядок id для одного SortableContext в сайдбаре */
export const buildFlatSidebarSortableIds = (
    tree: EditorTreeNode[]
): string[] => {
    const ids: string[] = [];
    for (const node of tree) {
        if (node.kind === 'section') {
            ids.push(node.section.id);
            if (!isSectionCollapsed(node.section)) {
                for (const child of node.children) {
                    ids.push(child.id);
                }
            }
        } else {
            ids.push(node.block.id);
        }
    }
    return ids;
};

/** Вынести блок из группы на верхний уровень (на позицию over) */
export const moveBlockToTopLevel = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    overId: string
): ReportBlockFromDB[] => {
    const { sorted, block } = removeBlockFromSorted(
        sortBlocksByPosition(validateTree(blocks)),
        activeId
    );
    if (!block || block.type === 'section') return blocks;

    const reparented: ReportBlockFromDB = { ...block, parentId: null };
    const tree = buildEditorTree(sorted);
    const topIds = tree.map(getTopLevelNodeId);
    const newIndex = topIds.indexOf(overId);
    if (newIndex === -1) {
        return reindexBlockPositions([...sorted, reparented]);
    }

    const nextTree = [...tree];
    nextTree.splice(newIndex, 0, { kind: 'block', block: reparented });
    return flattenTree(nextTree);
};

/** Единая точка для DnD в сайдбаре */
export const applyBlockDrag = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    overId: string
): ReportBlockFromDB[] => {
    if (activeId === overId) return blocks;

    const sorted = sortBlocksByPosition(validateTree(blocks));
    const active = sorted.find((b) => b.id === activeId);
    const over = sorted.find((b) => b.id === overId);
    if (!active || !over) return blocks;

    if (active.type === 'section') {
        if (over.parentId) return blocks;
        return moveTopLevelNode(blocks, activeId, overId);
    }

    const targetSectionId = resolveTargetSectionId(over);

    if (!active.parentId) {
        if (targetSectionId) {
            if (active.id === targetSectionId) return blocks;
            const insertBefore =
                over.type !== 'section' && over.parentId === targetSectionId
                    ? over.id
                    : null;
            return moveBlockIntoSection(
                blocks,
                activeId,
                targetSectionId,
                insertBefore
            );
        }
        if (over.type !== 'section' && !over.parentId) {
            return moveTopLevelNode(blocks, activeId, overId);
        }
        return blocks;
    }

    if (active.parentId) {
        if (over.type === 'section') {
            if (over.id === active.parentId) {
                return moveBlockAfterSection(blocks, activeId, active.parentId);
            }
            return moveBlockToTopLevel(blocks, activeId, over.id);
        }
        if (over.parentId === active.parentId) {
            return moveChildInGroup(blocks, activeId, overId);
        }
        if (over.parentId && over.parentId !== active.parentId) {
            return moveBlockIntoSection(blocks, activeId, over.parentId, over.id);
        }
        if (!over.parentId) {
            return moveBlockToTopLevel(blocks, activeId, overId);
        }
        return blocks;
    }

    return blocks;
};

export type BlockDragIntent =
    | 'none'
    | 'enterGroup'
    | 'exitGroup'
    | 'reorderInGroup'
    | 'moveBetweenGroups'
    | 'reorderTop'
    | 'moveGroup';

export const BLOCK_DRAG_INTENT_LABELS: Record<
    Exclude<BlockDragIntent, 'none'>,
    string
> = {
    enterGroup: 'В группу',
    exitGroup: 'Вынести из группы',
    reorderInGroup: 'Внутри группы',
    moveBetweenGroups: 'В другую группу',
    reorderTop: 'Переставить',
    moveGroup: 'Переместить группу',
};

/** Предпросмотр действия при drop (для подсветки в сайдбаре) */
export const getBlockDragIntent = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    overId: string | null
): BlockDragIntent => {
    if (!overId || activeId === overId) return 'none';

    const sorted = sortBlocksByPosition(validateTree(blocks));
    const active = sorted.find((b) => b.id === activeId);
    const over = sorted.find((b) => b.id === overId);
    if (!active || !over) return 'none';

    if (active.type === 'section') {
        if (over.parentId) return 'none';
        return 'moveGroup';
    }

    const targetSectionId = resolveTargetSectionId(over);

    if (!active.parentId) {
        if (targetSectionId && active.id !== targetSectionId) {
            return 'enterGroup';
        }
        if (over.type !== 'section' && !over.parentId) {
            return 'reorderTop';
        }
        return 'none';
    }

    if (active.parentId) {
        if (over.type === 'section') {
            return 'exitGroup';
        }
        if (over.parentId === active.parentId) {
            return 'reorderInGroup';
        }
        if (over.parentId && over.parentId !== active.parentId) {
            return 'moveBetweenGroups';
        }
        if (!over.parentId) {
            return 'exitGroup';
        }
        return 'none';
    }

    return 'none';
};
