'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, User, X } from 'lucide-react';
import type { TaskAssignee, TaskAssigneeKind } from '@/lib/db-types';
import {
    assigneeKey,
    formatAssigneeName,
    isAssigneeSelected,
    validatePersonName,
} from '@/lib/task-assignees';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type UserOption = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
};

type PersonOption = {
    id: string;
    firstName: string;
    lastName: string;
};

const CHIP_CLASS =
    'inline-flex items-center gap-1 rounded-full bg-purple-600/20 px-2.5 py-1 text-xs font-medium text-purple-200 ring-1 ring-purple-500/50';

const LIST_ITEM_BASE =
    'cursor-pointer rounded-md text-zinc-300 data-[selected=true]:!bg-zinc-800 data-[selected=true]:!text-zinc-100';

const LIST_ITEM_CHOSEN =
    'bg-purple-600/15 text-purple-100 ring-1 ring-inset ring-purple-500/25 data-[selected=true]:!bg-purple-600/25 data-[selected=true]:!text-purple-100';

type TaskAssigneesPickerProps = {
    value: TaskAssignee[];
    onChange: (assignees: TaskAssignee[]) => void;
    disabled?: boolean;
};

export function TaskAssigneesPicker({
    value,
    onChange,
    disabled = false,
}: TaskAssigneesPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [users, setUsers] = useState<UserOption[]>([]);
    const [people, setPeople] = useState<PersonOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const [addOpen, setAddOpen] = useState(false);
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [addError, setAddError] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 200);
        return () => clearTimeout(t);
    }, [search]);

    const fetchOptions = useCallback(async (q: string) => {
        setLoading(true);
        setLoadError(false);
        const query = q ? `?q=${encodeURIComponent(q)}` : '';
        try {
            const [usersRes, peopleRes] = await Promise.all([
                fetch(`/api/users/assignees${query}`),
                fetch(`/api/task-people${query}`),
            ]);
            const usersData = usersRes.ok
                ? ((await usersRes.json()) as { users: UserOption[] })
                : { users: [] };
            const peopleData = peopleRes.ok
                ? ((await peopleRes.json()) as { people: PersonOption[] })
                : { people: [] };
            if (!usersRes.ok || !peopleRes.ok) setLoadError(true);
            setUsers(usersData.users ?? []);
            setPeople(peopleData.people ?? []);
        } catch {
            setUsers([]);
            setPeople([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        void fetchOptions(debouncedSearch);
    }, [open, debouncedSearch, fetchOptions]);

    const selectedKeys = useMemo(
        () => new Set(value.map((a) => assigneeKey(a.kind, a.id))),
        [value]
    );

    const toggle = (
        kind: TaskAssigneeKind,
        id: string,
        firstName: string,
        lastName: string
    ) => {
        if (isAssigneeSelected(value, kind, id)) {
            onChange(value.filter((a) => !(a.kind === kind && a.id === id)));
        } else {
            onChange([...value, { kind, id, firstName, lastName }]);
        }
    };

    const remove = (kind: TaskAssigneeKind, id: string) => {
        onChange(value.filter((a) => !(a.kind === kind && a.id === id)));
    };

    const handleAddPerson = async () => {
        const validated = validatePersonName(newFirstName, newLastName);
        if ('error' in validated) {
            setAddError(validated.error);
            return;
        }
        setAdding(true);
        setAddError('');
        try {
            const res = await fetch('/api/task-people', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validated),
            });
            const data = await res.json();
            if (!res.ok) {
                setAddError(data.error || 'Ошибка создания');
                return;
            }
            const person = data.person as PersonOption;
            onChange([
                ...value,
                {
                    kind: 'person',
                    id: person.id,
                    firstName: person.firstName,
                    lastName: person.lastName,
                },
            ]);
            setAddOpen(false);
            setNewFirstName('');
            setNewLastName('');
            void fetchOptions(debouncedSearch);
        } catch {
            setAddError('Ошибка создания');
        } finally {
            setAdding(false);
        }
    };

    const renderListItem = (
        kind: TaskAssigneeKind,
        id: string,
        firstName: string,
        lastName: string,
        subtitle?: string
    ) => {
        const selected = selectedKeys.has(assigneeKey(kind, id));
        return (
            <CommandItem
                key={assigneeKey(kind, id)}
                value={`${kind}-${id}-${firstName}-${lastName}-${subtitle ?? ''}`}
                onSelect={() => toggle(kind, id, firstName, lastName)}
                className={cn(LIST_ITEM_BASE, selected && LIST_ITEM_CHOSEN)}
            >
                <span
                    className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        selected
                            ? 'border-purple-400 bg-purple-600/40 text-purple-100'
                            : 'border-zinc-600'
                    )}
                >
                    {selected && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1 truncate">
                    {formatAssigneeName({ firstName, lastName })}
                    {subtitle && (
                        <span className="ml-1 text-zinc-500">{subtitle}</span>
                    )}
                </span>
            </CommandItem>
        );
    };

    return (
        <div className="space-y-2">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((a) => (
                        <span key={assigneeKey(a.kind, a.id)} className={CHIP_CLASS}>
                            {formatAssigneeName(a)}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => remove(a.kind, a.id)}
                                    className="rounded-full p-0.5 hover:bg-purple-500/30 cursor-pointer"
                                    aria-label={`Убрать ${formatAssigneeName(a)}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        className="w-full justify-between border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                    >
                        <span className="truncate text-left">
                            {value.length === 0
                                ? 'Выберите исполнителей…'
                                : `Выбрано: ${value.length}`}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] border-zinc-700 bg-zinc-900 p-0"
                    align="start"
                >
                    <Command
                        shouldFilter={false}
                        className="bg-zinc-900 text-zinc-100 [&_[data-slot=command-input-wrapper]]:border-zinc-700"
                    >
                        <CommandInput
                            placeholder="Поиск по имени, фамилии, email…"
                            value={search}
                            onValueChange={setSearch}
                            className="border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        />
                        <CommandList>
                            {loading && (
                                <div className="py-4 text-center text-xs text-zinc-500">
                                    Загрузка…
                                </div>
                            )}
                            {!loading && loadError && (
                                <div className="py-4 text-center text-xs text-amber-400/90">
                                    Не удалось загрузить списки
                                </div>
                            )}
                            {!loading && users.length === 0 && people.length === 0 && (
                                <CommandEmpty className="text-zinc-500">
                                    Ничего не найдено
                                </CommandEmpty>
                            )}
                            {users.length > 0 && (
                                <CommandGroup
                                    heading="Зарегистрированные пользователи"
                                    className="text-zinc-400 [&_[cmdk-group-heading]]:text-zinc-500"
                                >
                                    {users.map((u) =>
                                        renderListItem(
                                            'user',
                                            u.id,
                                            u.firstName,
                                            u.lastName,
                                            `(${u.email})`
                                        )
                                    )}
                                </CommandGroup>
                            )}
                            {users.length > 0 && people.length > 0 && (
                                <CommandSeparator className="bg-zinc-700" />
                            )}
                            {people.length > 0 && (
                                <CommandGroup
                                    heading="Исполнители"
                                    className="text-zinc-400 [&_[cmdk-group-heading]]:text-zinc-500"
                                >
                                    {people.map((p) =>
                                        renderListItem(
                                            'person',
                                            p.id,
                                            p.firstName,
                                            p.lastName
                                        )
                                    )}
                                </CommandGroup>
                            )}
                        </CommandList>
                        <div className="border-t border-zinc-700 p-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setAddOpen(true);
                                    setAddError('');
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                            >
                                <Plus className="h-4 w-4 text-purple-400" />
                                Добавить исполнителя
                            </button>
                        </div>
                    </Command>
                </PopoverContent>
            </Popover>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-zinc-100">
                            Новый исполнитель
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="assignee-fn" className="text-zinc-400">
                                Имя *
                            </Label>
                            <Input
                                id="assignee-fn"
                                value={newFirstName}
                                onChange={(e) => setNewFirstName(e.target.value)}
                                className="mt-1 border-zinc-700 bg-zinc-800 text-zinc-100"
                            />
                        </div>
                        <div>
                            <Label htmlFor="assignee-ln" className="text-zinc-400">
                                Фамилия *
                            </Label>
                            <Input
                                id="assignee-ln"
                                value={newLastName}
                                onChange={(e) => setNewLastName(e.target.value)}
                                className="mt-1 border-zinc-700 bg-zinc-800 text-zinc-100"
                            />
                        </div>
                        {addError && (
                            <p className="text-sm text-red-400">{addError}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setAddOpen(false)}
                            className="border-zinc-600 bg-transparent text-zinc-300"
                        >
                            Отмена
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void handleAddPerson()}
                            disabled={adding}
                            className="bg-purple-700 text-white hover:bg-purple-600"
                        >
                            {adding ? 'Сохранение…' : 'Добавить'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export function TaskAssigneesBadges({
    assignees,
    emptyLabel = '— Не назначен —',
    className,
}: {
    assignees: TaskAssignee[];
    emptyLabel?: string;
    className?: string;
}) {
    if (assignees.length === 0) {
        return (
            <span className={cn('text-zinc-400', className)}>
                <User className="mr-1 inline h-3 w-3" />
                {emptyLabel}
            </span>
        );
    }

    return (
        <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
            {assignees.map((a) => (
                <span
                    key={assigneeKey(a.kind, a.id)}
                    className={CHIP_CLASS}
                >
                    {formatAssigneeName(a)}
                </span>
            ))}
        </span>
    );
}
