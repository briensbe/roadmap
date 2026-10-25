import {
  formatLocalDate,
  getMondayOfWeek,
  formatWeekStart,
  formatWeekHeaderNumeric,
  getWeekNumber,
  getWeekYear,
  generateWeeksTimeline,
  buildDisplayedQuarters,
} from './week-calendar.utils';

describe('week-calendar.utils', () => {
  it('formatLocalDate formats Date into YYYY-MM-DD properly', () => {
    const d = new Date(2026, 9, 25); // 25 octobre 2026
    expect(formatLocalDate(d)).toBe('2026-10-25');
  });

  it('getMondayOfWeek returns Monday for any day of the same week', () => {
    // Dimanche 25 octobre 2026 -> lundi 19 octobre 2026
    const sunday = new Date(2026, 9, 25);
    const monday = getMondayOfWeek(sunday);
    expect(monday.getDay()).toBe(1);
    expect(formatLocalDate(monday)).toBe('2026-10-19');
  });

  it('formatWeekStart returns Monday formatted ISO date', () => {
    const wed = new Date(2026, 9, 21);
    expect(formatWeekStart(wed)).toBe('2026-10-19');
  });

  it('formatWeekHeaderNumeric formats day and month as JJ/MM', () => {
    const d = new Date(2026, 0, 5);
    expect(formatWeekHeaderNumeric(d)).toBe('05/01');
  });

  it('getWeekNumber and getWeekYear return ISO week attributes', () => {
    const d = new Date(2026, 0, 1); // 1er janv 2026 est jeudi -> semaine 1 de 2026
    expect(getWeekNumber(d)).toBe(1);
    expect(getWeekYear(d)).toBe(2026);
  });

  it('generateWeeksTimeline generates exactly 53 weeks and quarters', () => {
    const timeline = generateWeeksTimeline(new Date(2026, 0, 1));
    expect(timeline.displayedWeeks.length).toBe(53);
    expect(timeline.displayedMonths.length).toBeGreaterThan(0);
    expect(timeline.displayedYears.length).toBeGreaterThan(0);
    expect(timeline.isYearChangeMap.length).toBe(53);

    const quarters = buildDisplayedQuarters(timeline.displayedMonths);
    expect(quarters.length).toBeGreaterThan(0);
    const totalWeeksInQuarters = quarters.reduce((acc, q) => acc + q.weeksCount, 0);
    expect(totalWeeksInQuarters).toBe(53);
  });
});
