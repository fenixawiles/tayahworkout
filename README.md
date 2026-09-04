# Momentum

Momentum is a focused, Android-first workout calendar built with React, TypeScript, Vite, Supabase, and a lightweight installable PWA shell. It keeps the Today screen calm, makes workout planning explicit, and enforces same-day completion in the database using the profile's saved IANA timezone. Exercises carry Upper body, Lower body, Core, or Full body focus tags, and search matches either names or tags.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase environment variables, the app offers a device-local preview with realistic seeded plans. With them, it uses private accounts and Postgres persistence.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase link --project-ref YOUR_PROJECT_REF` and `supabase db push`.
3. In Supabase Auth URL Configuration, set the site URL to `https://fenixawiles.github.io/tayahworkout/` and allow both that URL and `http://localhost:5173/` as redirects.
4. Add repository variables named `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in GitHub Actions settings. Use the publishable/anon browser key—never a service-role key.

The migration creates all tables, RLS policies, RPCs, the private `exercise-images` bucket, and 24 public-domain seed exercises. Custom images are stored under user-ID-prefixed paths and served with short-lived signed URLs.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
supabase test db
```

The GitHub Actions workflow runs these checks before deploying `dist` to GitHub Pages.

## Exercise image credits

Seed exercise imagery is adapted from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), released under the Unlicense/public domain dedication. Source attribution is also retained in the seeded database records.
