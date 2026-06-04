'use client';

import { Fragment, memo, useCallback, useMemo } from 'react';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ReportBlockFromDB } from '@/lib/db-types';
import {
    buildEditorTree,
    buildTopLevelSortableIds,
    getBlockDragIntent,
    isSectionSidebarCollapsed,
    makeGroupExitDropId,
    parseGroupExitDropId,
    type BlockDragIntent,
    type EditorTreeNode,
} from '@/lib/block-tree';
import type {
    DraggableAttributes,
    DraggableSyntheticListeners,
} from '@dnd-kit/core';

export type BlockListCardProps = {
    block: ReportBlockFromDB;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
    onDelete?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    dragHandleProps?: {
        attributes: DraggableAttributes;
        listeners: DraggableSyntheticListeners;
    };
    isDragOverlay?: boolean;
    subtitle?: string;
    collapseToggle?: { collapsed: boolean; onToggle: () => void };
    dropIntent?: BlockDragIntent;
    showDropIntentHint?: boolean;
    indented?: boolean;
};

type EditorBlocksSidebarTreeProps = {
    blocks: ReportBlockFromDB[];
    selectedBlockId: string | null;
    activeBlockId: string | null;
    overBlockId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleSectionSidebarCollapsed: (sectionId: string) => void;
    BlockListCard: React.ComponentType<BlockListCardProps>;
};

const CROSS_LEVEL_DRAG_INTENTS: BlockDragIntent[] = [
    'enterGroup',
    'exitGroup',
    'moveBetweenGroups',
];

const noLayoutAnimation = () => false;

const resolveDropIntent = (
    blocks: ReportBlockFromDB[],
    activeBlockId: string | null,
    overBlockId: string | null,
    targetId: string,
): BlockDragIntent => {
    if (!activeBlockId || !overBlockId || overBlockId !== targetId) {
        return 'none';
    }
    return getBlockDragIntent(blocks, activeBlockId, overBlockId);
};

const GroupExitDropZone = memo(function GroupExitDropZone({
    sectionId,
    blocks,
    activeBlockId,
    overBlockId,
}: {
    sectionId: string;
    blocks: ReportBlockFromDB[];
    activeBlockId: string | null;
    overBlockId: string | null;
}) {
    const dropId = makeGroupExitDropId(sectionId);
    const { setNodeRef } = useDroppable({
        id: dropId,
        data: { type: 'group-exit', sectionId },
    });
    const intent = resolveDropIntent(
        blocks,
        activeBlockId,
        overBlockId,
        dropId,
    );
    const highlighted = intent === 'exitGroup';
    const isDragging = Boolean(activeBlockId);

    return (
        <div
            ref={setNodeRef}
            className={`ml-2 rounded ${
                isDragging ? 'h-2.5 min-h-[10px]' : 'h-1'
            } ${
                highlighted
                    ? 'bg-sky-500/45'
                    : isDragging
                      ? 'bg-zinc-700/25'
                      : 'bg-transparent'
            }`}
            aria-hidden
        />
    );
});

const SortableBlockCardWrapper = memo(function SortableBlockCardWrapper({
    block,
    isSelected,
    onSelect,
    onDelete,
    onDuplicate,
    BlockListCard,
    collapseToggle,
    dropIntent,
    freezeSortableTransforms,
    showDropIntentHint,
    indented,
}: {
    block: ReportBlockFromDB;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    BlockListCard: React.ComponentType<BlockListCardProps>;
    collapseToggle?: BlockListCardProps['collapseToggle'];
    dropIntent: BlockDragIntent;
    freezeSortableTransforms: boolean;
    showDropIntentHint: boolean;
    indented?: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: block.id,
        data: {
            parentId: block.parentId ?? null,
            type: block.type,
        },
        animateLayoutChanges: noLayoutAnimation,
    });

    const style = useMemo(
        () => ({
            transform:
                isDragging || freezeSortableTransforms
                    ? undefined
                    : CSS.Transform.toString(transform),
            transition: undefined,
            opacity: isDragging ? 0 : 1,
        }),
        [transform, isDragging, freezeSortableTransforms],
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={isDragging ? 'relative z-0' : undefined}
        >
            <BlockListCard
                block={block}
                isSelected={isSelected}
                onSelect={onSelect}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                dragHandleProps={{ attributes, listeners }}
                collapseToggle={collapseToggle}
                dropIntent={dropIntent}
                showDropIntentHint={showDropIntentHint}
                indented={indented}
            />
        </div>
    );
});

const SortableSectionHeader = memo(function SortableSectionHeader({
    section,
    childCount,
    selectedBlockId,
    onSelect,
    onDelete,
    onDuplicate,
    onToggleSectionSidebarCollapsed,
    BlockListCard,
    dropIntent,
    freezeSortableTransforms,
    showDropIntentHint,
}: {
    section: ReportBlockFromDB;
    childCount: number;
    selectedBlockId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleSectionSidebarCollapsed: (sectionId: string) => void;
    BlockListCard: React.ComponentType<BlockListCardProps>;
    dropIntent: BlockDragIntent;
    freezeSortableTransforms: boolean;
    showDropIntentHint: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: section.id,
        data: { parentId: null, type: 'section' },
        animateLayoutChanges: noLayoutAnimation,
    });

    const style = useMemo(
        () => ({
            transform:
                isDragging || freezeSortableTransforms
                    ? undefined
                    : CSS.Transform.toString(transform),
            transition: undefined,
            opacity: isDragging ? 0 : 1,
        }),
        [transform, isDragging, freezeSortableTransforms],
    );

    const collapsed = isSectionSidebarCollapsed(section);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={isDragging ? 'relative z-0' : undefined}
        >
            <BlockListCard
                block={section}
                isSelected={selectedBlockId === section.id}
                onSelect={onSelect}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                dragHandleProps={{ attributes, listeners }}
                collapseToggle={{
                    collapsed,
                    onToggle: () => onToggleSectionSidebarCollapsed(section.id),
                }}
                subtitle={
                    childCount > 0
                        ? `${childCount} ${
                              childCount === 1
                                  ? 'блок'
                                  : childCount < 5
                                    ? 'блока'
                                    : 'блоков'
                          }`
                        : undefined
                }
                dropIntent={dropIntent}
                showDropIntentHint={showDropIntentHint}
            />
        </div>
    );
});

export const EditorBlocksSidebarTree = memo(function EditorBlocksSidebarTree({
    blocks,
    selectedBlockId,
    activeBlockId,
    overBlockId,
    onSelect,
    onDelete,
    onDuplicate,
    onToggleSectionSidebarCollapsed,
    BlockListCard,
}: EditorBlocksSidebarTreeProps) {
    const tree = useMemo(() => buildEditorTree(blocks), [blocks]);
    const topLevelIds = useMemo(
        () => buildTopLevelSortableIds(tree),
        [tree],
    );
    const showDropIntentHint = Boolean(activeBlockId);

    const dragIntent = useMemo(() => {
        if (!activeBlockId || !overBlockId) return 'none' as BlockDragIntent;
        return getBlockDragIntent(blocks, activeBlockId, overBlockId);
    }, [blocks, activeBlockId, overBlockId]);

    const freezeSortableTransforms =
        CROSS_LEVEL_DRAG_INTENTS.includes(dragIntent);

    const renderNode = useCallback(
        (node: EditorTreeNode) => {
            if (node.kind === 'section') {
                const collapsed = isSectionSidebarCollapsed(node.section);
                const childIds = node.children.map((c) => c.id);
                const showChildrenZoneHint =
                    !collapsed &&
                    node.children.length > 0 &&
                    activeBlockId &&
                    overBlockId &&
                    !parseGroupExitDropId(overBlockId) &&
                    (() => {
                        const intent = getBlockDragIntent(
                            blocks,
                            activeBlockId,
                            overBlockId,
                        );
                        return (
                            intent === 'enterGroup' ||
                            intent === 'moveBetweenGroups' ||
                            intent === 'reorderInGroup'
                        );
                    })();

                return (
                    <Fragment key={node.section.id}>
                        <SortableSectionHeader
                            section={node.section}
                            childCount={node.children.length}
                            selectedBlockId={selectedBlockId}
                            onSelect={onSelect}
                            onDelete={onDelete}
                            onDuplicate={onDuplicate}
                            onToggleSectionSidebarCollapsed={
                                onToggleSectionSidebarCollapsed
                            }
                            BlockListCard={BlockListCard}
                            dropIntent={resolveDropIntent(
                                blocks,
                                activeBlockId,
                                overBlockId,
                                node.section.id,
                            )}
                            freezeSortableTransforms={freezeSortableTransforms}
                            showDropIntentHint={showDropIntentHint}
                        />
                        {!collapsed && node.children.length > 0 && (
                            <>
                                <SortableContext
                                    items={childIds}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div
                                        className={`ml-2 space-y-1 border-l border-zinc-700/40 py-0.5 pl-2 ${
                                            showChildrenZoneHint
                                                ? 'shadow-[inset_2px_0_0_0_rgba(245,158,11,0.35)]'
                                                : ''
                                        }`}
                                    >
                                        {node.children.map((child) => (
                                            <SortableBlockCardWrapper
                                                key={child.id}
                                                block={child}
                                                isSelected={
                                                    selectedBlockId === child.id
                                                }
                                                onSelect={onSelect}
                                                onDelete={onDelete}
                                                onDuplicate={onDuplicate}
                                                BlockListCard={BlockListCard}
                                                dropIntent={resolveDropIntent(
                                                    blocks,
                                                    activeBlockId,
                                                    overBlockId,
                                                    child.id,
                                                )}
                                                freezeSortableTransforms={
                                                    freezeSortableTransforms
                                                }
                                                showDropIntentHint={
                                                    showDropIntentHint
                                                }
                                                indented
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                                <GroupExitDropZone
                                    sectionId={node.section.id}
                                    blocks={blocks}
                                    activeBlockId={activeBlockId}
                                    overBlockId={overBlockId}
                                />
                            </>
                        )}
                    </Fragment>
                );
            }

            return (
                <SortableBlockCardWrapper
                    key={node.block.id}
                    block={node.block}
                    isSelected={selectedBlockId === node.block.id}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    BlockListCard={BlockListCard}
                    dropIntent={resolveDropIntent(
                        blocks,
                        activeBlockId,
                        overBlockId,
                        node.block.id,
                    )}
                    freezeSortableTransforms={freezeSortableTransforms}
                    showDropIntentHint={showDropIntentHint}
                />
            );
        },
        [
            BlockListCard,
            activeBlockId,
            overBlockId,
            blocks,
            freezeSortableTransforms,
            showDropIntentHint,
            onDelete,
            onDuplicate,
            onSelect,
            onToggleSectionSidebarCollapsed,
            selectedBlockId,
        ],
    );

    return (
        <SortableContext
            items={topLevelIds}
            strategy={verticalListSortingStrategy}
        >
            <div className="space-y-1">{tree.map(renderNode)}</div>
        </SortableContext>
    );
});
