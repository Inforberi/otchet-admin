import type { ReportBlockFromDB } from '@/lib/db-types';
import {
    applyBlockDrag,
    buildEditorTree,
    getBlockDragIntent,
    insertSectionAt,
    isLastChildInGroup,
    isSectionEditorCollapsed,
    isSectionSidebarCollapsed,
    makeGroupExitDropId,
    moveBlockAfterSection,
    normalizeBlockOrder,
    resolveSidebarDragOver,
    setSectionEditorCollapsed,
    setSectionSidebarCollapsed,
} from './block-tree';

const assert = (condition: boolean, message: string) => {
    if (!condition) {
        throw new Error(message);
    }
};

const block = (
    id: string,
    type: ReportBlockFromDB['type'],
    position: number,
    parentId: string | null = null,
    data: ReportBlockFromDB['data'] = {},
): ReportBlockFromDB => ({
    id,
    reportId: 'report-1',
    type,
    position,
    version: 1,
    parentId,
    createdAt: new Date(),
    updatedAt: new Date(),
    data,
});

const run = () => {
    const sectionA = block('sec-a', 'section', 0, null, { title: 'Group A' });
    const childA1 = block('child-a1', 'text', 1, 'sec-a', { title: 'Task 1' });
    const childA2 = block('child-a2', 'text', 2, 'sec-a', { title: 'Task 2' });
    const topBlock = block('top-1', 'text', 3, null, { title: 'Top' });

    const groupBlocks = [sectionA, childA1, childA2, topBlock];

    const afterSection = insertSectionAt(
        groupBlocks,
        block('sec-b', 'section', 0, null, { title: 'Group B' }),
        'sec-a',
    );
    const treeAfterSection = buildEditorTree(afterSection);
    const groupANode = treeAfterSection.find(
        (n) => n.kind === 'section' && n.section.id === 'sec-a',
    );
    if (groupANode?.kind !== 'section') {
        throw new Error('group A exists after insert');
    }
    assert(
        groupANode.children.length === 2,
        'children stay in group when adding section after group header',
    );
    assert(
        groupANode.children.every((c) => c.parentId === 'sec-a'),
        'children keep parentId after insertSectionAt',
    );

    const afterChild = insertSectionAt(
        groupBlocks,
        block('sec-c', 'section', 0, null, { title: 'Group C' }),
        'child-a1',
    );
    const treeAfterChild = buildEditorTree(afterChild);
    const groupAAfterChildNode = treeAfterChild.find(
        (n) => n.kind === 'section' && n.section.id === 'sec-a',
    );
    if (groupAAfterChildNode?.kind !== 'section') {
        throw new Error('group A exists after insert after child');
    }
    assert(
        groupAAfterChildNode.children.length === 2,
        'children stay in group when adding section after child in middle',
    );

    const brokenOrder = [sectionA, childA1, topBlock, childA2];
    const normalized = normalizeBlockOrder(brokenOrder);
    const treeNormalized = buildEditorTree(normalized);
    const groupNormalizedNode = treeNormalized.find(
        (n) => n.kind === 'section' && n.section.id === 'sec-a',
    );
    if (groupNormalizedNode?.kind !== 'section') {
        throw new Error('group A exists after normalize');
    }
    assert(
        groupNormalizedNode.children.length === 2,
        'normalizeBlockOrder repairs broken flat list',
    );
    const flatIds = normalized.map((b) => b.id);
    assert(
        flatIds.indexOf('sec-a') < flatIds.indexOf('child-a1') &&
            flatIds.indexOf('child-a1') < flatIds.indexOf('child-a2') &&
            flatIds.indexOf('child-a2') < flatIds.indexOf('top-1'),
        'normalizeBlockOrder produces contiguous group run',
    );

    const dragOut = applyBlockDrag(groupBlocks, 'child-a1', 'top-1');
    const dragged = dragOut.find((b) => b.id === 'child-a1');
    assert(
        dragged?.parentId === null,
        'drag child onto top-level block exits group',
    );

    const exitDropId = makeGroupExitDropId('sec-a');
    assert(
        getBlockDragIntent(groupBlocks, 'child-a2', exitDropId) === 'exitGroup',
        'exit zone intent is exitGroup',
    );
    const exitViaZone = applyBlockDrag(groupBlocks, 'child-a2', exitDropId);
    const exitedChild = exitViaZone.find((b) => b.id === 'child-a2');
    assert(exitedChild?.parentId === null, 'drop on exit zone clears parentId');
    const exitFlatIds = exitViaZone.map((b) => b.id);
    assert(
        exitFlatIds.indexOf('sec-a') < exitFlatIds.indexOf('child-a2'),
        'exit zone places block after group',
    );

    const singleChildGroup = [
        sectionA,
        block('only-child', 'text', 1, 'sec-a', { title: 'Only' }),
        topBlock,
    ];
    assert(
        isLastChildInGroup(singleChildGroup, 'sec-a', 'only-child'),
        'isLastChildInGroup detects last child',
    );
    const lastChildExit = moveBlockAfterSection(
        singleChildGroup,
        'only-child',
        'sec-a',
    );
    assert(
        lastChildExit.find((b) => b.id === 'only-child')?.parentId === null,
        'moveBlockAfterSection exits last child from group',
    );

    const sectionWithLegacy = block('sec-legacy', 'section', 0, null, {
        title: '',
        collapsed: true,
    });
    assert(
        isSectionSidebarCollapsed(sectionWithLegacy) &&
            isSectionEditorCollapsed(sectionWithLegacy),
        'legacy collapsed applies to both sidebar and editor',
    );

    const sidebarOnly = setSectionSidebarCollapsed(sectionWithLegacy, false);
    assert(
        !isSectionSidebarCollapsed(sidebarOnly) &&
            isSectionEditorCollapsed(sidebarOnly),
        'sidebar and editor collapse flags are independent',
    );

    const editorOnly = setSectionEditorCollapsed(sectionWithLegacy, false);
    assert(
        isSectionSidebarCollapsed(sectionWithLegacy) &&
            !isSectionEditorCollapsed(editorOnly),
        'editor collapse can be toggled independently',
    );

    const sectionB = block('sec-b', 'section', 3, null, { title: 'Group B' });
    const childB1 = block('child-b1', 'text', 4, 'sec-b', { title: 'B Task' });
    const twoGroups = [sectionA, childA1, childA2, sectionB, childB1];

    assert(
        resolveSidebarDragOver(twoGroups, 'sec-a', 'child-a2') === 'sec-b',
        'section over own child resolves to next top-level',
    );
    assert(
        resolveSidebarDragOver(twoGroups, 'sec-a', 'child-b1') === 'sec-b',
        'section over other group child resolves to that section',
    );

    const swapGroups = applyBlockDrag(twoGroups, 'sec-a', 'child-a2');
    const swapIds = swapGroups.map((b) => b.id);
    assert(
        swapIds.indexOf('sec-b') < swapIds.indexOf('sec-a'),
        'section drag down via own child swaps groups',
    );

    const swapViaOtherChild = applyBlockDrag(twoGroups, 'sec-a', 'child-b1');
    const swapViaOtherIds = swapViaOtherChild.map((b) => b.id);
    assert(
        swapViaOtherIds.indexOf('sec-b') < swapViaOtherIds.indexOf('sec-a'),
        'section drag over other group child reorders groups',
    );

    assert(
        getBlockDragIntent(twoGroups, 'sec-a', 'child-a2') === 'moveGroup',
        'section over own child shows moveGroup intent',
    );

    const reorderInGroup = applyBlockDrag(groupBlocks, 'child-a1', 'child-a2');
    const reorderedChildren = reorderInGroup.filter((b) => b.parentId === 'sec-a');
    assert(
        reorderedChildren[0]?.id === 'child-a2' &&
            reorderedChildren[1]?.id === 'child-a1',
        'child drag onto sibling below reorders within group',
    );

    console.log('block-tree.test.ts: all assertions passed');
};

run();
