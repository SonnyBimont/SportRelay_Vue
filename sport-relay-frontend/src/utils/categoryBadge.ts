const normalizeCategory = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const getCategoryBadgeClass = (category: string) => {
  const normalized = normalizeCategory(category);

  if (
    normalized.includes('cycl') ||
    normalized.includes('route') ||
    normalized.includes('vtt') ||
    normalized.includes('gravel') ||
    normalized.includes('triathlon')
  ) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }

  if (
    normalized.includes('course') ||
    normalized.includes('trail') ||
    normalized.includes('randonnee') ||
    normalized.includes('escalade') ||
    normalized.includes('camping')
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (
    normalized.includes('fitness') ||
    normalized.includes('musculation') ||
    normalized.includes('crossfit') ||
    normalized.includes('yoga') ||
    normalized.includes('pilates')
  ) {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }

  if (
    normalized.includes('tennis') ||
    normalized.includes('padel') ||
    normalized.includes('badminton') ||
    normalized.includes('collectif') ||
    normalized.includes('combat')
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (normalized.includes('natation') || normalized.includes('hiver')) {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  }

  return 'border-gray-200 bg-gray-100 text-gray-700';
};
