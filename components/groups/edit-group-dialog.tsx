'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { EyeOff } from 'lucide-react';
import { SettingToggleRow } from '@/components/ui/setting-toggle-row';
import { getIndentedGroupLabel } from '@/lib/group-utils';

type GroupRecord = {
    id: string;
    name: string;
    path: string;
    description: string | null;
    parentId: string | null;
    createdByUserId?: string | null;
    isHidden?: boolean;
    version: number;
};

interface EditGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: GroupRecord | null;
    currentUserId?: string | null;
    showHiddenGroups?: boolean;
    onUpdated?: (group: GroupRecord) => void | Promise<void>;
    onDeleted?: () => void | Promise<void>;
}

type FlatGroup = GroupRecord & { depth: number };

const formatGroupApiError = (
    message: string | undefined,
    fallback: string
): string => {
    if (!message) return fallback;
    if (
        message.includes('Cannot delete non-empty group') ||
        message.toLowerCase().includes('non-empty group')
    ) {
        return 'Нельзя удалить папку: в ней есть подпапки или отчёты. Сначала удалите подгруппы и отчёты.';
    }
    return message;
};

const buildFlatGroups = (groups: GroupRecord[]): FlatGroup[] => {
    const childrenByParent = new Map<string | null, GroupRecord[]>();

    groups.forEach((g) => {
        const siblings = childrenByParent.get(g.parentId) || [];
        siblings.push(g);
        childrenByParent.set(g.parentId, siblings);
    });

    const sortGroups = (items: GroupRecord[]) =>
        [...items].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    const result: FlatGroup[] = [];

    const walk = (parentId: string | null, depth: number) => {
        sortGroups(childrenByParent.get(parentId) || []).forEach((item) => {
            result.push({ ...item, depth });
            walk(item.id, depth + 1);
        });
    };

    walk(null, 0);
    return result;
};

export const EditGroupDialog = ({
    open,
    onOpenChange,
    group,
    currentUserId,
    showHiddenGroups = false,
    onUpdated,
    onDeleted,
}: EditGroupDialogProps) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [parentId, setParentId] = useState('');
    const [isHidden, setIsHidden] = useState(false);
    const [allGroups, setAllGroups] = useState<GroupRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const loadGroups = useCallback(async () => {
        const params = new URLSearchParams({ tree: '1' });
        if (showHiddenGroups) params.set('showHidden', '1');
        const response = await fetch(`/api/groups?${params.toString()}`);
        if (response.ok) {
            const data = await response.json();
            setAllGroups(data.groups || []);
        }
    }, [showHiddenGroups]);

    useEffect(() => {
        if (!open || !group) return;
        setName(group.name);
        setDescription(group.description || '');
        setParentId(group.parentId || '');
        setIsHidden(Boolean(group.isHidden));
        void loadGroups();
    }, [open, group, loadGroups]);

    useEffect(() => {
        if (!open) {
            setSaving(false);
            setDeleting(false);
        }
    }, [open]);

    const parentOptions = useMemo(() => {
        if (!group) return [];
        return buildFlatGroups(allGroups).filter((g) => g.id !== group.id);
    }, [allGroups, group]);

    const canToggleHidden =
        Boolean(currentUserId) &&
        (!group?.createdByUserId || group.createdByUserId === currentUserId);

    const hideFolderDescription = !group?.createdByUserId
        ? 'Папка без создателя — при скрытии вы станете владельцем'
        : 'Папка будет видна только вам (и super admin с флагом)';

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!group || !name.trim()) {
            alert('Название группы обязательно');
            return;
        }

        try {
            setSaving(true);
            const response = await fetch(`/api/groups/${group.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    parentId: parentId || null,
                    ...(canToggleHidden ? { isHidden } : {}),
                    expectedVersion: group.version,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'Ошибка обновления группы');
                return;
            }

            const data = await response.json();
            onOpenChange(false);
            if (onUpdated) {
                await onUpdated(data.group);
            }
        } catch (error) {
            console.error('Error updating group:', error);
            alert('Ошибка обновления группы');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!group) return;
        if (
            !confirm(
                'Удалить папку? Сначала удалите все подпапки и отчёты — пустые папки удаляются без восстановления.'
            )
        ) {
            return;
        }

        try {
            setDeleting(true);
            const response = await fetch(`/api/groups/${group.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expectedVersion: group.version }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(
                    formatGroupApiError(
                        typeof data.error === 'string' ? data.error : undefined,
                        'Ошибка удаления группы'
                    )
                );
                return;
            }

            onOpenChange(false);
            if (onDeleted) {
                await onDeleted();
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('Ошибка удаления группы');
        } finally {
            setDeleting(false);
        }
    };

    if (!group) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] text-[var(--color-grayscale-3)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Настройки папки</DialogTitle>
                    <DialogDescription className="text-[var(--color-grayscale-6)]">
                        «{group.name}»
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                            Название *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                            Описание
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                            Родительская папка
                        </label>
                        <select
                            value={parentId}
                            onChange={(e) => setParentId(e.target.value)}
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
                        >
                            <option value="">Корень (верхний уровень)</option>
                            {parentOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {getIndentedGroupLabel(option.name, option.depth)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {canToggleHidden ? (
                        <SettingToggleRow
                            icon={EyeOff}
                            label="Скрыть папку"
                            description={hideFolderDescription}
                            checked={isHidden}
                            onChange={setIsHidden}
                        />
                    ) : null}

                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                        <button
                            type="button"
                            onClick={() => void handleDelete()}
                            disabled={saving || deleting}
                            className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {deleting ? 'Удаление...' : 'Удалить папку'}
                        </button>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={saving || deleting || !name.trim()}
                                className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                {saving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
