'use client';

import type { LucideIcon } from 'lucide-react';

type SettingToggleRowProps = {
    icon: LucideIcon;
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
};

export const SettingToggleRow = ({
    icon: Icon,
    label,
    description,
    checked,
    onChange,
    disabled = false,
}: SettingToggleRowProps) => (
    <label
        className={`flex items-start gap-3 rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-3 py-3 transition-colors ${
            disabled
                ? 'cursor-not-allowed opacity-60'
                : 'cursor-pointer hover:border-[var(--color-primary)]/40'
        }`}
    >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-grayscale-13)] text-[var(--color-grayscale-5)]">
            <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-[var(--color-grayscale-3)]">
                {label}
            </span>
            {description ? (
                <span className="mt-0.5 block text-xs text-[var(--color-grayscale-6)]">
                    {description}
                </span>
            ) : null}
        </span>
        <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--color-alpha-3)] accent-[var(--color-primary)]"
        />
    </label>
);
