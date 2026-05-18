# LinkNest

LinkNest is a neighborhood book-sharing app prototype built with Expo, React Native, React Native Web, Vite, and Supabase.

## Scripts

- `npm run dev` starts the local web preview.
- `npm run dev:lan` starts a LAN-accessible web preview for phone testing.
- `npm run web` starts the web preview.
- `npm run start` starts Expo.
- `npm run ios` starts the iOS simulator flow.
- `npm run android` starts the Android simulator flow.
- `npm run typecheck` checks TypeScript.
- `npm run build` builds the web app.
- `npm run check` runs typecheck and build.

## Local Setup

```bash
npm install
npm run dev
```

Open the URL printed by Vite.

## Phone Testing

For phone browser testing, make sure the phone and computer are on the same Wi-Fi:

```bash
npm run dev:lan
```

Open the Network URL shown in the terminal.

For Expo Go:

```bash
npm run start
```

Then scan the QR code with Expo Go.

## Supabase

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.

Run the SQL in:

```text
supabase/migrations/20260518000000_initial_schema.sql
```

See:

- `docs/Supabase接入.md`
- `docs/数据库Schema.md`
- `docs/隐私与安全.md`
- `docs/Beta准备清单.md`
