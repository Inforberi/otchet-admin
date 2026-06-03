'use client';

type GroupOption = {
    id: string;
    name: string;
    path: string;
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
    return (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            {groups.length === 0 ? (
                <p className="text-sm text-zinc-500">Нет доступных групп</p>
            ) : (
                groups.map((group) => (
                    <label
                        key={group.id}
                        className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            checked={selectedGroupIds.includes(group.id)}
                            disabled={disabled}
                            onChange={(e) => {
                                onChange(
                                    e.target.checked
                                        ? [...selectedGroupIds, group.id]
                                        : selectedGroupIds.filter(
                                              (id) => id !== group.id
                                          )
                                );
                            }}
                        />
                        <span>
                            {group.name}{' '}
                            <span className="text-zinc-500">({group.path})</span>
                        </span>
                    </label>
                ))
            )}
        </div>
    );
}
