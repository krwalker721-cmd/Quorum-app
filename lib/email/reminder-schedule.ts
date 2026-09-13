// When each trial reminder goes out. Deliberately import-free, so the timing
// rules can be checked on their own.

const DAY_MS = 86_400_000;

/** Days before a trial ends that a reminder is sent. */
export const REMINDER_DAYS = [7, 3, 1] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];

/**
 * The reminder due now, if any.
 *
 * The job runs once a day and a trial can end at any hour, so a mark is never
 * hit exactly. Each mark owns a one-day window centred on it (the 7-day
 * reminder goes out with 6.5 to 7.5 days left), and one daily run always lands
 * in each window. If a run is missed, the reminder goes out on the next one;
 * the email states the real time left, so it's late but never wrong. Once a
 * nearer mark is reached, the farther ones are skipped for good.
 * trial_reminder_sends stops a mark from going out twice.
 */
export function dueReminder(trialEndsAt: Date, now: Date): ReminderDay | null {
  const daysLeft = (trialEndsAt.getTime() - now.getTime()) / DAY_MS;
  if (daysLeft <= 0) return null;
  for (const mark of [...REMINDER_DAYS].reverse()) {
    if (daysLeft <= mark + 0.5) return mark;
  }
  return null;
}
