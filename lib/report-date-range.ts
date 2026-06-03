export interface CurrentMonthRange {
    dateFrom: string;
    dateTo: string;
}

const padDatePart = (value: number) => value.toString().padStart(2, '0');

export const formatDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = padDatePart(date.getMonth() + 1);
    const day = padDatePart(date.getDate());

    return `${year}-${month}-${day}`;
};

export const getCurrentMonthDateRange = (now = new Date()): CurrentMonthRange => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
        dateFrom: formatDateInputValue(start),
        dateTo: formatDateInputValue(end),
    };
};

const formatDisplayDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);

    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

const formatMonthLabel = (dateFrom: string) => {
    const date = new Date(`${dateFrom}T00:00:00`);

    return date.toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
    });
};

export const getPeriodSummary = ({
    allTime,
    dateFrom,
    dateTo,
    defaultDateRange,
}: {
    allTime: boolean;
    dateFrom: string;
    dateTo: string;
    defaultDateRange: CurrentMonthRange;
}) => {
    if (allTime) {
        return 'Все время';
    }

    if (
        dateFrom === defaultDateRange.dateFrom &&
        dateTo === defaultDateRange.dateTo
    ) {
        return formatMonthLabel(dateFrom);
    }

    return `${formatDisplayDate(dateFrom)} — ${formatDisplayDate(dateTo)}`;
};

export const getEmptyPeriodText = ({
    allTime,
    dateFrom,
    dateTo,
    defaultDateRange,
}: {
    allTime: boolean;
    dateFrom: string;
    dateTo: string;
    defaultDateRange: CurrentMonthRange;
}) => {
    if (allTime) {
        return 'За все время отчётов пока нет';
    }

    if (
        dateFrom === defaultDateRange.dateFrom &&
        dateTo === defaultDateRange.dateTo
    ) {
        return `За ${formatMonthLabel(dateFrom)} отчётов пока нет`;
    }

    return `За период ${formatDisplayDate(dateFrom)} — ${formatDisplayDate(dateTo)} отчётов пока нет`;
};

const MONTH_GENITIVE_RU = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
] as const;

/** Стабильное форматирование без locale — одинаково на сервере и клиенте */
export const formatReportDateLabel = (
    dateString: string | null | undefined
): string => {
    if (!dateString) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1) return '';
    return `${day} ${MONTH_GENITIVE_RU[month - 1]} ${year} г.`;
};
