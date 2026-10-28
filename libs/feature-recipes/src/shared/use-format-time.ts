import { useTranslation } from 'react-i18next';

const MINUTES_PER_HOUR = 60;

/** Minutes as Hebrew copy ("1 שע׳ 15 דק׳"); undefined when the time is unknown. */
export function useFormatTime() {
  const { t } = useTranslation();
  return (minutes: number | null) => {
    if (minutes === null) return undefined;
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const rest = minutes % MINUTES_PER_HOUR;
    if (hours === 0) return t('library.card.minutes', { minutes: rest });
    return rest === 0
      ? t('library.card.hours', { hours })
      : t('library.card.hoursMinutes', { hours, minutes: rest });
  };
}
