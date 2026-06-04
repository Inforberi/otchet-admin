'use client';

import { memo, useCallback, useMemo } from 'react';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReportBlockFromDB } from '@/lib/db-types';
import {
    buildEditorTree,
    getBlockDragIntent,
    getTopLevelNodeId,
    isSectionCollapsed,
    type BlockDragIntent,
    type EditorTreeNode,
} from '@/lib/block-tree';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';

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
};

type EditorBlocksSidebarTreeProps = {
    blocks: ReportBlockFromDB[];
    selectedBlockId: string | null;
    activeBlockId: string | null;
    overBlockId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleSectionCollapsed: (sectionId: string) => void;
    BlockListCard: React.ComponentType<BlockListCardProps>;
};

const resolveDropIntent = (
    blocks: ReportBlockFromDB[],
    activeBlockId: string | null,
    overBlockId: string | null,
    blockId: string
): BlockDragIntent => {
    if (!activeBlockId || !overBlockId || overBlockId !== blockId) {
        return 'none';
    }
    return getBlockDragIntent(blocks, activeBlockId, overBlockId);
};

const SortableBlockCardWrapper = memo(function SortableBlockCardWrapper({
    block,
    isSelected,
    onSelect,
    onDelete,
    onDuplicate,
    BlockListCard,
    collapseToggle,
    dropIntent,
}: {
    block: ReportBlockFromDB;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    BlockListCard: React.ComponentType<BlockListCardProps>;
    collapseToggle?: BlockListCardProps['collapseToggle'];
    dropIntent: BlockDragIntent;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id });

    const style = useMemo(
        () => ({
            transform: CSS.Transform.toString(transform),
            transition: isDragging ? undefined : transition,
            opacity: isDragging ? 0.35 : 1,
        }),
        [transform, transition, isDragging]
    );

    return (
        <div ref={setNodeRef} style={style}>
            <BlockListCard
                block={block}
                isSelected={isSelected}
                onSelect={onSelect}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                dragHandleProps={{ attributes, listeners }}
                collapseToggle={collapseToggle}
                dropIntent={dropIntent}
            />
        </div>
    );
});

const SortableSectionRow = memo(function SortableSectionRow({
    section,
    childrenBlocks,
    selectedBlockId,
    activeBlockId,
    overBlockId,
    blocks,
    onSelect,
    onDelete,
    onDuplicate,
    onToggleSectionCollapsed,
    BlockListCard,
}: {
    section: ReportBlockFromDB;
    childrenBlocks: ReportBlockFromDB[];
    selectedBlockId: string | null;
    activeBlockId: string | null;
    overBlockId: string | null;
    blocks: ReportBlockFromDB[];
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleSectionCollapsed: (sectionId: string) => void;
    BlockListCard: React.ComponentType<BlockListCardProps>;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: section.id });

    const style = useMemo(
        () => ({
            transform: CSS.Transform.toString(transform),
            transition: isDragging ? undefined : transition,
            opacity: isDragging ? 0.35 : 1,
        }),
        [transform, transition, isDragging]
    );

    const collapsed = isSectionCollapsed(section);
    const childCount = childrenBlocks.length;
    const sectionDropIntent = resolveDropIntent(
        blocks,
        activeBlockId,
        overBlockId,
        section.id
    );

    const childrenZoneIntent = useMemo((): BlockDragIntent => {
        if (!activeBlockId || !overBlockId) return 'none';
        if (overBlockId === section.id) return sectionDropIntent;
        const overChild = childrenBlocks.find((c) => c.id === overBlockId);
        if (!overChild) return 'none';
        return getBlockDragIntent(blocks, activeBlockId, overBlockId);
    }, [
        activeBlockId,
        overBlockId,
        section.id,
        sectionDropIntent,
        childrenBlocks,
        blocks,
    ]);

    const showChildrenZoneHint =
        !collapsed &&
        childrenBlocks.length > 0 &&
        (childrenZoneIntent === 'enterGroup' ||
            childrenZoneIntent === 'moveBetweenGroups' ||
            childrenZoneIntent === 'reorderInGroup');

    return (
        <div ref={setNodeRef} style={style} className="mb-1">
            <BlockListCard
                block={section}
                isSelected={selectedBlockId === section.id}
                onSelect={onSelect}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                dragHandleProps={{ attributes, listeners }}
                collapseToggle={{
                    collapsed,
                    onToggle: () => onToggleSectionCollapsed(section.id),
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
                dropIntent={sectionDropIntent}
            />
            {!collapsed && childrenBlocks.length > 0 && (
                <SortableContext
                    items={childrenBlocks.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div
                        className={`ml-3 border-l pl-2 sm:ml-4 sm:pl-3 ${
                            showChildrenZoneHint
                                ? 'border-amber-500/50'
                                : 'border-zinc-800/60'
                        }`}
                    >
                        {childrenBlocks.map((child) => (
                            <SortableBlockCardWrapper
                                key={child.id}
                                block={child}
                                isSelected={selectedBlockId === child.id}
                                onSelect={onSelect}
                                onDelete={onDelete}
                                onDuplicate={onDuplicate}
                                BlockListCard={BlockListCard}
                                dropIntent={resolveDropIntent(
                                    blocks,
                                    activeBlockId,
                                    overBlockId,
                                    child.id
                                )}
                            />
                        ))}
                    </div>
                </SortableContext>
            )}
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
    onToggleSectionCollapsed,
    BlockListCard,
}: EditorBlocksSidebarTreeProps) {
    const tree = useMemo(() => buildEditorTree(blocks), [blocks]);
    const topLevelIds = useMemo(() => tree.map(getTopLevelNodeId), [tree]);

    const renderNode = useCallback(
        (node: EditorTreeNode) => {
            if (node.kind === 'section') {
                return (
                    <SortableSectionRow
                        key={node.section.id}
                        section={node.section}
                        childrenBlocks={node.children}
                        selectedBlockId={selectedBlockId}
                        activeBlockId={activeBlockId}
                        overBlockId={overBlockId}
                        blocks={blocks}
                        onSelect={onSelect}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                        onToggleSectionCollapsed={onToggleSectionCollapsed}
                        BlockListCard={BlockListCard}
                    />
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
                        node.block.id
                    )}
                />
            );
        },
        [
            BlockListCard,
            activeBlockId,
            overBlockId,
            blocks,
            onDelete,
            onDuplicate,
            onSelect,
            onToggleSectionCollapsed,
            selectedBlockId,
        ]
    );

    return (
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
            {tree.map(renderNode)}
        </SortableContext>
    );
});
