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
    | {
          kind: 'section';
          section: ReportBlockFromDB;
          children: ReportBlockFromDB[];
      }
    | { kind: 'block'; block: ReportBlockFromDB };

export const getTopLevelNodeId = (node: EditorTreeNode): string =>
    node.kind === 'section' ? node.section.id : node.block.id;

const sectionData = (section: ReportBlockFromDB): SectionBlockData =>
    section.data as SectionBlockData;

export const validateTree = (
    blocks: ReportBlockFromDB[],
): ReportBlockFromDB[] => {
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

const collectChildrenBySection = (
    sorted: ReportBlockFromDB[],
): Map<string, ReportBlockFromDB[]> => {
    const childrenBySection = new Map<string, ReportBlockFromDB[]>();
    for (const block of sorted) {
        if (!block.parentId || block.type === 'section') continue;
        const children = childrenBySection.get(block.parentId) ?? [];
        children.push(block);
        childrenBySection.set(block.parentId, children);
    }
    for (const [sectionId, children] of childrenBySection) {
        childrenBySection.set(
            sectionId,
            [...children].sort((a, b) => a.position - b.position),
        );
    }
    return childrenBySection;
};

/** Дерево редактора: parentId — источник истины для children группы */
export const buildEditorTree = (
    blocks: ReportBlockFromDB[],
): EditorTreeNode[] => {
    const sorted = sortBlocksByPosition(validateTree(blocks));
    const childrenBySection = collectChildrenBySection(sorted);
    const childIds = new Set(
        sorted
            .filter((b) => b.parentId && b.type !== 'section')
            .map((b) => b.id),
    );

    const topLevel = sorted
        .filter((b) => !childIds.has(b.id))
        .sort((a, b) => a.position - b.position);

    const nodes: EditorTreeNode[] = [];
    for (const block of topLevel) {
        if (block.type === 'section') {
            nodes.push({
                kind: 'section',
                section: { ...block, parentId: null },
                children: childrenBySection.get(block.id) ?? [],
            });
        } else {
            nodes.push({ kind: 'block', block: { ...block, parentId: null } });
        }
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

/** Восстанавливает contiguous flat-order по parentId */
export const normalizeBlockOrder = (
    blocks: ReportBlockFromDB[],
): ReportBlockFromDB[] => flattenTree(buildEditorTree(blocks));

/** Top-level id, после которого вставлять новую группу / блок */
export const resolveTopLevelAnchorId = (
    blocks: ReportBlockFromDB[],
    afterId?: string | null,
): string | null => {
    if (!afterId) return null;
    const block = blocks.find((b) => b.id === afterId);
    if (!block) return null;
    if (block.type === 'section') return block.id;
    if (block.parentId) return block.parentId;
    return block.id;
};

export const insertSectionAt = (
    blocks: ReportBlockFromDB[],
    newSection: ReportBlockFromDB,
    afterId?: string | null,
): ReportBlockFromDB[] => {
    const tree = buildEditorTree(blocks);
    const sectionNode: EditorTreeNode = {
        kind: 'section',
        section: { ...newSection, type: 'section', parentId: null },
        children: [],
    };

    if (!afterId) {
        return flattenTree([...tree, sectionNode]);
    }

    const anchorId = resolveTopLevelAnchorId(blocks, afterId);
    if (!anchorId) {
        return flattenTree([...tree, sectionNode]);
    }

    const topIndex = tree.findIndex((n) => getTopLevelNodeId(n) === anchorId);
    if (topIndex === -1) {
        return flattenTree([...tree, sectionNode]);
    }

    const nextTree = [...tree];
    nextTree.splice(topIndex + 1, 0, sectionNode);
    return flattenTree(nextTree);
};

export const insertBlockAfterAnchor = (
    blocks: ReportBlockFromDB[],
    newBlock: ReportBlockFromDB,
    afterId?: string | null,
): ReportBlockFromDB[] => {
    if (newBlock.type === 'section') {
        return insertSectionAt(blocks, newBlock, afterId);
    }

    if (!afterId) {
        return normalizeBlockOrder([
            ...blocks,
            { ...newBlock, parentId: null },
        ]);
    }

    const after = blocks.find((b) => b.id === afterId);
    if (!after) {
        return normalizeBlockOrder([...blocks, newBlock]);
    }

    if (after.parentId) {
        return insertBlockInGroup(
            blocks,
            { ...newBlock, parentId: after.parentId },
            after.parentId,
            afterId,
        );
    }

    const tree = buildEditorTree(blocks);
    const anchorId = resolveTopLevelAnchorId(blocks, afterId);
    if (!anchorId) {
        return normalizeBlockOrder([
            ...blocks,
            { ...newBlock, parentId: null },
        ]);
    }

    const topIndex = tree.findIndex((n) => getTopLevelNodeId(n) === anchorId);
    if (topIndex === -1) {
        return normalizeBlockOrder([
            ...blocks,
            { ...newBlock, parentId: null },
        ]);
    }

    const nextTree = [...tree];
    nextTree.splice(topIndex + 1, 0, {
        kind: 'block',
        block: { ...newBlock, parentId: null },
    });
    return flattenTree(nextTree);
};

export const getTargetSectionId = (
    blocks: ReportBlockFromDB[],
    selectedBlockId: string | null,
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
    afterId?: string | null,
): ReportBlockFromDB[] => {
    const tree = buildEditorTree(blocks);
    const sectionIndex = tree.findIndex(
        (n) => n.kind === 'section' && n.section.id === parentSectionId,
    );
    if (sectionIndex === -1) {
        return normalizeBlockOrder([...blocks, newBlock]);
    }

    const node = tree[sectionIndex];
    if (node.kind !== 'section') {
        return normalizeBlockOrder([...blocks, newBlock]);
    }

    let insertAt = node.children.length;
    if (afterId) {
        const afterIndex = node.children.findIndex((c) => c.id === afterId);
        if (afterIndex !== -1) insertAt = afterIndex + 1;
    }

    const nextChildren = [...node.children];
    nextChildren.splice(insertAt, 0, {
        ...newBlock,
        parentId: parentSectionId,
    });

    const nextTree = [...tree];
    nextTree[sectionIndex] = {
        kind: 'section',
        section: node.section,
        children: nextChildren,
    };
    return flattenTree(nextTree);
};

export const getBlocksToDeleteWithGroup = (
    blocks: ReportBlockFromDB[],
    id: string,
): string[] => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return [];
    if (block.type !== 'section') return [id];
    return [id, ...blocks.filter((b) => b.parentId === id).map((b) => b.id)];
};

export const moveTopLevelNode = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    overId: string,
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
    overId: string,
): ReportBlockFromDB[] => {
    const active = blocks.find((b) => b.id === activeId);
    if (!active?.parentId) return blocks;

    const tree = buildEditorTree(blocks);
    const sectionIndex = tree.findIndex(
        (n) => n.kind === 'section' && n.section.id === active.parentId,
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

export const isSectionSidebarCollapsed = (
    section: ReportBlockFromDB,
): boolean => {
    const data = sectionData(section);
    return Boolean(data.sidebarCollapsed ?? data.collapsed);
};

export const isSectionEditorCollapsed = (
    section: ReportBlockFromDB,
): boolean => {
    const data = sectionData(section);
    return Boolean(data.editorCollapsed ?? data.collapsed);
};

/** @deprecated — sidebar + editor вместе; для обратной совместимости */
export const isSectionCollapsed = (section: ReportBlockFromDB): boolean =>
    isSectionSidebarCollapsed(section) && isSectionEditorCollapsed(section);

export const setSectionSidebarCollapsed = (
    section: ReportBlockFromDB,
    collapsed: boolean,
): ReportBlockFromDB => ({
    ...section,
    data: {
        ...sectionData(section),
        sidebarCollapsed: collapsed,
    },
});

export const setSectionEditorCollapsed = (
    section: ReportBlockFromDB,
    collapsed: boolean,
): ReportBlockFromDB => ({
    ...section,
    data: {
        ...sectionData(section),
        editorCollapsed: collapsed,
    },
});

/** @deprecated */
export const setSectionCollapsed = (
    section: ReportBlockFromDB,
    collapsed: boolean,
): ReportBlockFromDB => ({
    ...section,
    data: {
        ...sectionData(section),
        collapsed,
        sidebarCollapsed: collapsed,
        editorCollapsed: collapsed,
    },
});

export const getSectionChildCount = (
    blocks: ReportBlockFromDB[],
    sectionId: string,
): number => blocks.filter((b) => b.parentId === sectionId).length;

const removeBlockFromSorted = (
    sorted: ReportBlockFromDB[],
    blockId: string,
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

const getParentSectionNodeIndex = (
    tree: EditorTreeNode[],
    sectionId: string,
): number =>
    tree.findIndex((n) => n.kind === 'section' && n.section.id === sectionId);

const GROUP_EXIT_DROP_PREFIX = 'group-exit:';

export const makeGroupExitDropId = (sectionId: string): string =>
    `${GROUP_EXIT_DROP_PREFIX}${sectionId}`;

export const parseGroupExitDropId = (overId: string): string | null =>
    overId.startsWith(GROUP_EXIT_DROP_PREFIX)
        ? overId.slice(GROUP_EXIT_DROP_PREFIX.length)
        : null;

const getSectionChildren = (
    tree: EditorTreeNode[],
    sectionId: string,
): ReportBlockFromDB[] => {
    const node = tree[getParentSectionNodeIndex(tree, sectionId)];
    return node?.kind === 'section' ? node.children : [];
};

export const isLastChildInGroup = (
    blocks: ReportBlockFromDB[],
    sectionId: string,
    blockId: string,
): boolean => {
    const children = getSectionChildren(buildEditorTree(blocks), sectionId);
    const last = children[children.length - 1];
    return last?.id === blockId;
};

/** Последний child тянут вниз на свой же слот → выход из группы */
const shouldExitViaLastSiblingDrop = (
    tree: EditorTreeNode[],
    active: ReportBlockFromDB,
    over: ReportBlockFromDB,
): boolean => {
    if (!active.parentId || over.parentId !== active.parentId) return false;
    const children = getSectionChildren(tree, active.parentId);
    const lastChild = children[children.length - 1];
    if (!lastChild) return false;
    return active.id === lastChild.id && over.id === lastChild.id;
};

/** over — первый top-level узел сразу после группы sectionId */
const isImmediateTopLevelAfterGroup = (
    tree: EditorTreeNode[],
    sectionId: string,
    overId: string,
): boolean => {
    const sectionIndex = getParentSectionNodeIndex(tree, sectionId);
    if (sectionIndex === -1) return false;
    const nextNode = tree[sectionIndex + 1];
    if (!nextNode) return false;
    return getTopLevelNodeId(nextNode) === overId;
};

/** Вставить блок в группу (перед insertBeforeChildId или в конец группы) */
export const moveBlockIntoSection = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    sectionId: string,
    insertBeforeChildId?: string | null,
): ReportBlockFromDB[] => {
    const { sorted, block } = removeBlockFromSorted(
        sortBlocksByPosition(validateTree(blocks)),
        activeId,
    );
    if (!block || block.type === 'section') return blocks;

    const reparented: ReportBlockFromDB = { ...block, parentId: sectionId };
    const tree = buildEditorTree(sorted);
    const sectionIndex = getParentSectionNodeIndex(tree, sectionId);
    if (sectionIndex === -1) return blocks;

    const node = tree[sectionIndex];
    if (node.kind !== 'section') return blocks;

    let insertAt = node.children.length;
    if (insertBeforeChildId) {
        const beforeIndex = node.children.findIndex(
            (c) => c.id === insertBeforeChildId,
        );
        if (beforeIndex !== -1) insertAt = beforeIndex;
    }

    const nextChildren = [...node.children];
    nextChildren.splice(insertAt, 0, reparented);

    const nextTree = [...tree];
    nextTree[sectionIndex] = {
        kind: 'section',
        section: node.section,
        children: nextChildren,
    };
    return flattenTree(nextTree);
};

/** Вынести блок из группы сразу после секции (top-level, под группой) */
export const moveBlockAfterSection = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    sectionId: string,
): ReportBlockFromDB[] => {
    const { sorted, block } = removeBlockFromSorted(
        sortBlocksByPosition(validateTree(blocks)),
        activeId,
    );
    if (!block || block.type === 'section') return blocks;

    const reparented: ReportBlockFromDB = { ...block, parentId: null };
    const tree = buildEditorTree(sorted);
    const sectionIndex = getParentSectionNodeIndex(tree, sectionId);
    if (sectionIndex === -1) {
        return reindexBlockPositions([...sorted, reparented]);
    }

    const nextTree = [...tree];
    nextTree.splice(sectionIndex + 1, 0, { kind: 'block', block: reparented });
    return flattenTree(nextTree);
};

/** Плоский порядок id для одного SortableContext в сайдбаре */
export const buildFlatSidebarSortableIds = (
    tree: EditorTreeNode[],
): string[] => {
    const ids: string[] = [];
    for (const node of tree) {
        if (node.kind === 'section') {
            ids.push(node.section.id);
            if (!isSectionSidebarCollapsed(node.section)) {
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

/** Top-level id для root SortableContext (без children) */
export const buildTopLevelSortableIds = (tree: EditorTreeNode[]): string[] =>
    tree.map(getTopLevelNodeId);

/** Id следующего top-level узла после группы */
export const getNextTopLevelId = (
    tree: EditorTreeNode[],
    sectionId: string,
): string | null => {
    const sectionIndex = getParentSectionNodeIndex(tree, sectionId);
    if (sectionIndex === -1) return null;
    const nextNode = tree[sectionIndex + 1];
    return nextNode ? getTopLevelNodeId(nextNode) : null;
};

/** Нормализует overId перед applyBlockDrag (section over child → top-level anchor) */
export const resolveSidebarDragOver = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    overId: string,
): string => {
    if (parseGroupExitDropId(overId)) return overId;

    const sorted = sortBlocksByPosition(validateTree(blocks));
    const active = sorted.find((b) => b.id === activeId);
    const over = sorted.find((b) => b.id === overId);
    if (!active || !over) return overId;

    if (active.type === 'section' && over.parentId) {
        if (over.parentId === active.id) {
            const nextId = getNextTopLevelId(
                buildEditorTree(sorted),
                active.id
            );
            return nextId ?? overId;
        }
        return over.parentId;
    }

    return overId;
};

/** Вынести блок из группы на верхний уровень (на позицию over) */
export const moveBlockToTopLevel = (
    blocks: ReportBlockFromDB[],
    activeId: string,
    overId: string,
): ReportBlockFromDB[] => {
    const { sorted, block } = removeBlockFromSorted(
        sortBlocksByPosition(validateTree(blocks)),
        activeId,
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
    overId: string,
): ReportBlockFromDB[] => {
    const exitSectionId = parseGroupExitDropId(overId);
    if (exitSectionId) {
        const sorted = sortBlocksByPosition(validateTree(blocks));
        const active = sorted.find((b) => b.id === activeId);
        if (!active || active.type === 'section') return blocks;
        if (active.parentId === exitSectionId) {
            return moveBlockAfterSection(blocks, activeId, exitSectionId);
        }
        return blocks;
    }

    if (activeId === overId) return blocks;

    const sorted = sortBlocksByPosition(validateTree(blocks));
    const active = sorted.find((b) => b.id === activeId);
    const over = sorted.find((b) => b.id === overId);
    if (!active || !over) return blocks;

    const tree = buildEditorTree(sorted);

    if (active.type === 'section') {
        if (over.parentId) {
            const anchorId =
                over.parentId === active.id
                    ? getNextTopLevelId(tree, active.id)
                    : over.parentId;
            if (!anchorId || anchorId === active.id) return blocks;
            return moveTopLevelNode(blocks, activeId, anchorId);
        }
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
                insertBefore,
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
            if (shouldExitViaLastSiblingDrop(tree, active, over)) {
                return moveBlockAfterSection(blocks, activeId, active.parentId);
            }
            return moveChildInGroup(blocks, activeId, overId);
        }
        if (over.parentId && over.parentId !== active.parentId) {
            return moveBlockIntoSection(
                blocks,
                activeId,
                over.parentId,
                over.id,
            );
        }
        if (!over.parentId) {
            if (isImmediateTopLevelAfterGroup(tree, active.parentId, over.id)) {
                return moveBlockAfterSection(blocks, activeId, active.parentId);
            }
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
    overId: string | null,
): BlockDragIntent => {
    if (!overId) return 'none';

    const exitSectionId = parseGroupExitDropId(overId);
    if (exitSectionId) {
        const sorted = sortBlocksByPosition(validateTree(blocks));
        const active = sorted.find((b) => b.id === activeId);
        if (active?.parentId === exitSectionId) return 'exitGroup';
        return 'none';
    }

    if (activeId === overId) return 'none';

    const sorted = sortBlocksByPosition(validateTree(blocks));
    const active = sorted.find((b) => b.id === activeId);
    const over = sorted.find((b) => b.id === overId);
    if (!active || !over) return 'none';

    const tree = buildEditorTree(sorted);

    if (active.type === 'section') {
        if (over.parentId) {
            if (
                over.parentId === active.id &&
                getNextTopLevelId(tree, active.id)
            ) {
                return 'moveGroup';
            }
            if (over.parentId !== active.id) return 'moveGroup';
            return 'none';
        }
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
            if (shouldExitViaLastSiblingDrop(tree, active, over)) {
                return 'exitGroup';
            }
            return 'reorderInGroup';
        }
        if (over.parentId && over.parentId !== active.parentId) {
            return 'moveBetweenGroups';
        }
        if (!over.parentId) {
            if (isImmediateTopLevelAfterGroup(tree, active.parentId, over.id)) {
                return 'exitGroup';
            }
            return 'exitGroup';
        }
        return 'none';
    }

    return 'none';
};
