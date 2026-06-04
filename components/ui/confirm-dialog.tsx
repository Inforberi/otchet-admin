'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type ConfirmDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'destructive';
    loading?: boolean;
    onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    variant = 'default',
    loading = false,
    onConfirm,
}: ConfirmDialogProps) {
    const handleConfirm = () => {
        void Promise.resolve(onConfirm());
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-zinc-100">{title}</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel
                        disabled={loading}
                        className="border-zinc-600 bg-transparent text-zinc-300 hover:bg-zinc-800"
                    >
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={loading}
                        className={cn(
                            variant === 'destructive'
                                ? 'bg-red-700 text-white hover:bg-red-600 focus:ring-red-500'
                                : 'bg-green-700 text-white hover:bg-green-600 focus:ring-green-500'
                        )}
                    >
                        {loading ? 'Подождите...' : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
