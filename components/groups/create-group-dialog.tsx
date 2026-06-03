'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface CreatedGroup {
    id: string;
    name: string;
    path: string;
}

interface CreateGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parentId?: string | null;
    parentName?: string | null;
    onCreated?: (group: CreatedGroup) => void | Promise<void>;
}

export const CreateGroupDialog = ({
    open,
    onOpenChange,
    parentId = null,
    parentName,
    onCreated,
}: CreateGroupDialogProps) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) {
            setName('');
            setDescription('');
            setSaving(false);
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            alert('Название группы обязательно');
            return;
        }

        try {
            setSaving(true);

            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    parentId,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'Ошибка создания группы');
                return;
            }

            const data = await response.json();
            onOpenChange(false);

            if (onCreated) {
                await onCreated(data.group);
            }
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Ошибка создания группы');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] text-[var(--color-grayscale-3)] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Создать папку</DialogTitle>
                    <DialogDescription className="text-[var(--color-grayscale-6)]">
                        {parentName
                            ? `Новая папка будет создана внутри «${parentName}».`
                            : 'Новая папка будет создана на верхнем уровне.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--color-grayscale-5)]">
                            Название *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Новая папка"
                            required
                            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
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
                            placeholder="Короткое описание папки"
                            className="w-full resize-none rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
                        />
                    </div>

                    <DialogFooter>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm font-medium text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)] cursor-pointer"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {saving ? 'Создание...' : 'Создать папку'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
