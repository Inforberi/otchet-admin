// Утилита для создания slug из текста

export function createSlug(text: string): string {
    // Транслитерация русских символов
    const transliterate = (str: string): string => {
        const translitMap: Record<string, string> = {
            а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
            ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
            н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
            ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
            ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
        };
        return str
            .split('')
            .map((char) => translitMap[char.toLowerCase()] || char)
            .join('');
    };

    // Убираем HTML теги
    let slug = text.replace(/<[^>]*>/g, '');
    
    // Транслитерируем
    slug = transliterate(slug);
    
    // Приводим к нижнему регистру
    slug = slug.toLowerCase();
    
    // Заменяем пробелы и спецсимволы на дефисы
    slug = slug.replace(/[^a-z0-9]+/g, '-');
    
    // Убираем дефисы в начале и конце
    slug = slug.replace(/^-+|-+$/g, '');
    
    // Ограничиваем длину
    if (slug.length > 100) {
        slug = slug.substring(0, 100);
        slug = slug.replace(/-+$/, ''); // Убираем дефис в конце если обрезали
    }
    
    // Если пусто, возвращаем дефолтное значение
    if (!slug) {
        slug = 'item';
    }
    
    return slug;
}

export async function generateUniqueSlug(
    baseSlug: string,
    checkUnique: (slug: string) => Promise<boolean>,
    maxAttempts: number = 100
): Promise<string> {
    let slug = baseSlug;
    let attempt = 0;
    
    // Сначала пробуем базовый slug
    const isBaseUnique = await checkUnique(baseSlug);
    if (isBaseUnique) {
        return baseSlug;
    }
    
    // Если базовый slug занят, добавляем суффикс
    attempt = 1;
    while (attempt < maxAttempts) {
        slug = `${baseSlug}-${attempt}`;
        const isUnique = await checkUnique(slug);
        if (isUnique) {
            return slug;
        }
        attempt++;
    }
    
    // Если не удалось найти уникальный slug за maxAttempts попыток, добавляем timestamp
    return `${baseSlug}-${Date.now()}`;
}
