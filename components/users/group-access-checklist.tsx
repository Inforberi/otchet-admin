'use client';

import { Folder, FolderOpen } from 'lucide-react';
import { getSubtreeIdsByParent } from '@/lib/group-utils';

type GroupOption = {
    id: string;
    name: string;
    path: string;
    parentId?: string | null;
    depth?: number;
};

type GroupAccessChecklistProps = {
    groups: GroupOption[];
    selectedGroupIds: string[];
    onChange: (groupIds: string[]) => void;
    disabled?: boolean;
};

export function GroupAccessChecklist({
    groups,
    selectedGroupIds,
    onChange,
    disabled = false,
}: GroupAccessChecklistProps) {
    const sortedGroups = [...groups].sort((a, b) => {
        const depthA = a.depth ?? 0;
        const depthB = b.depth ?? 0;
        if (depthA !== depthB) return depthA - depthB;
        return a.name.localeCompare(b.name, 'ru');
    });

    const treeGroups = groups.map((g) => ({
        id: g.id,
        parentId: g.parentId ?? null,
    }));

    return (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2">
            {sortedGroups.length === 0 ? (
                <p className="px-2 py-3 text-sm text-zinc-500">Нет доступных групп</p>
            ) : (
                sortedGroups.map((group) => {
                    const depth = group.depth ?? 0;
                    const Icon = depth > 0 ? FolderOpen : Folder;

                    return (
                        <label
                            key={group.id}
                            title={group.path}
                            className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/50 ${
                                depth > 0 ? 'border-l border-zinc-700/60' : ''
                            }`}
                            style={{
                                marginLeft: depth > 0 ? depth * 12 : 0,
                                paddingLeft: depth > 0 ? 8 : undefined,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={selectedGroupIds.includes(group.id)}
                                disabled={disabled}
                                onChange={(e) => {
                                    const subtree = getSubtreeIdsByParent(
                                        group.id,
                                        treeGroups
                                    );
                                    onChange(
                                        e.target.checked
                                            ? [
                                                  ...new Set([
                                                      ...selectedGroupIds,
                                                      ...subtree,
                                                  ]),
                                              ]
                                            : selectedGroupIds.filter(
                                                  (id) => !subtree.includes(id)
                                              )
                                    );
                                }}
                                className="h-4 w-4 shrink-0 rounded border-zinc-600 accent-blue-500"
                            />
                            <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                            <span className="truncate">{group.name}</span>
                        </label>
                    );
                })
            )}
        </div>
    );
}
