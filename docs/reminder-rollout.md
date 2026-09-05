# Workout reminder rollout

Momentum contains a disabled, tested database queue for one optional workout email around 5pm in each user's saved timezone. It selects only confirmed accounts with a non-empty workout that still has an incomplete exercise, and deduplicates by user and local date.

The setting remains hidden and `app_capabilities.email_reminders_ready` remains `false` until delivery is genuinely available. Supabase's built-in email service is for authentication messages and is not a production transactional-email system. Do not enable the flag without completing every item below.

## Required before enabling

1. Configure a transactional email provider and a verified sending domain. Store its API key only in Supabase secrets/Vault.
2. Deploy a Supabase Edge Function that runs every few minutes using `pg_cron` and `pg_net`, calls `claim_workout_reminders`, obtains each payload with its claim token, and uses the delivery ID plus local date as the provider idempotency key.
3. The email must contain a short, pressure-free reminder, the scheduled date, a link to Momentum, and a signed unsubscribe link handled by a server endpoint that calls `unsubscribe_workout_reminders`. Never include workout names, notes, photos, health information, or a person's display name in email.
4. Call `finish_workout_reminder` for sent, failed, and skipped deliveries. Never retry beyond the 5–6pm local window or after the workout becomes complete. Keep email/API failure details out of `error_code`; store only a short internal category.
5. Verify bounce/complaint handling, SPF, DKIM, DMARC, provider rate limits, and an operator-visible failure alert. Test spring/fall DST transitions and opt-out before production.
6. Set `app_capabilities.email_reminders_ready = true` only after end-to-end delivery and unsubscribe tests pass. The client will then reveal the opt-in setting.

## References

- [Supabase custom SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp)
- [Scheduling Supabase Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
