import { buildTaskBlockPrismaData } from './task-draft-block';

const assert = (condition: boolean, message: string) => {
    if (!condition) {
        throw new Error(message);
    }
};

const run = () => {
    const editorId = 'user-1';
    const existingCompleted = {
        taskCompletedAt: new Date('2024-06-01T12:00:00.000Z'),
        taskCompletedByUserId: 'user-old',
        taskCompletionNotes: '<p>Done</p>',
        taskCompletionImages: null,
        taskCompletionLayout: 'full-width',
    };

    const closeResult = buildTaskBlockPrismaData(
        {
            type: 'task',
            data: {},
            taskCompletedAt: '2024-06-15',
            taskCompletionNotes: '<p>Finished</p>',
        },
        {
            taskCompletedAt: null,
            taskCompletedByUserId: null,
            taskCompletionNotes: null,
            taskCompletionImages: null,
            taskCompletionLayout: null,
        },
        editorId
    );
    assert(
        closeResult.taskCompletedAt instanceof Date &&
            closeResult.taskCompletedAt.toISOString().startsWith('2024-06-15'),
        'close sets taskCompletedAt from incoming date'
    );
    assert(
        closeResult.taskCompletedByUserId === editorId,
        'close sets taskCompletedByUserId to editor'
    );

    const changeDateResult = buildTaskBlockPrismaData(
        {
            type: 'task',
            data: {},
            taskCompletedAt: '2024-07-01',
            taskCompletionNotes: '<p>Done</p>',
        },
        existingCompleted,
        editorId
    );
    assert(
        changeDateResult.taskCompletedAt instanceof Date &&
            changeDateResult.taskCompletedAt.toISOString().startsWith('2024-07-01'),
        'change date updates taskCompletedAt while staying completed'
    );
    assert(
        changeDateResult.taskCompletedByUserId === 'user-old',
        'change date preserves taskCompletedByUserId'
    );
    assert(
        changeDateResult.taskCompletionNotes === '<p>Done</p>',
        'change date preserves notes'
    );

    const reopenResult = buildTaskBlockPrismaData(
        {
            type: 'task',
            data: {},
            taskCompletedAt: null,
            taskCompletionNotes: '<p>Done</p>',
        },
        existingCompleted,
        editorId
    );
    assert(reopenResult.taskCompletedAt === null, 'reopen clears taskCompletedAt');
    assert(
        reopenResult.taskCompletedByUserId === null,
        'reopen clears taskCompletedByUserId'
    );
    assert(
        reopenResult.taskCompletionNotes === '<p>Done</p>',
        'reopen keeps completion notes draft'
    );

    console.log('task-draft-block.test.ts: all assertions passed');
};

run();
