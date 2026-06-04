'use client';

import { Fragment, memo, useCallback, useMemo } from 'react';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReportBlockFromDB } from '@/lib/db-types';
import {
    buildEditorTree,
    buildFlatSidebarSortableIds,
    getBlockDragIntent,
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

const noLayoutAnimation = () => false;

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
        animateLayoutChanges: noLayoutAnimation,
    });

    const style = useMemo(
        () => ({
            transform: CSS.Transform.toString(transform),
            transition: isDragging ? undefined : transition,
            opacity: isDragging ? 0.35 : 1,
        }),
        [transform, transition, isDragging]
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={indented ? 'ml-3 sm:ml-4' : undefined}
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
    onToggleSectionCollapsed,
    BlockListCard,
    dropIntent,
}: {
    section: ReportBlockFromDB;
    childCount: number;
    selectedBlockId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleSectionCollapsed: (sectionId: string) => void;
    BlockListCard: React.ComponentType<BlockListCardProps>;
    dropIntent: BlockDragIntent;
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
        animateLayoutChanges: noLayoutAnimation,
    });

    const style = useMemo(
        () => ({
            transform: CSS.Transform.toString(transform),
            transition: isDragging ? undefined : transition,
            opacity: isDragging ? 0.35 : 1,
        }),
        [transform, transition, isDragging]
    );

    const collapsed = isSectionCollapsed(section);

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
                dropIntent={dropIntent}
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
    onToggleSectionCollapsed,
    BlockListCard,
}: EditorBlocksSidebarTreeProps) {
    const tree = useMemo(() => buildEditorTree(blocks), [blocks]);
    const flatIds = useMemo(() => buildFlatSidebarSortableIds(tree), [tree]);

    const renderNode = useCallback(
        (node: EditorTreeNode) => {
            if (node.kind === 'section') {
                const collapsed = isSectionCollapsed(node.section);
                const showChildrenZoneHint =
                    !collapsed &&
                    node.children.length > 0 &&
                    activeBlockId &&
                    overBlockId &&
                    (() => {
                        const intent = getBlockDragIntent(
                            blocks,
                            activeBlockId,
                            overBlockId
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
                            onToggleSectionCollapsed={onToggleSectionCollapsed}
                            BlockListCard={BlockListCard}
                            dropIntent={resolveDropIntent(
                                blocks,
                                activeBlockId,
                                overBlockId,
                                node.section.id
                            )}
                        />
                        {!collapsed && node.children.length > 0 && (
                            <div
                                className={`mb-1 ml-3 border-l pl-2 sm:ml-4 sm:pl-3 ${
                                    showChildrenZoneHint
                                        ? 'border-amber-500/50'
                                        : 'border-zinc-800/60'
                                }`}
                            >
                                {node.children.map((child) => (
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
                                        indented
                                    />
                                ))}
                            </div>
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
        <SortableContext
            items={flatIds}
            strategy={verticalListSortingStrategy}
        >
            {tree.map(renderNode)}
        </SortableContext>
    );
});
