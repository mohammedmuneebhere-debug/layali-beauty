# Layali — Beauty E-Commerce Platform

Premium beauty e-commerce website for Layali, featuring personalized AI-powered product recommendations, region-based product filtering, and a full admin dashboard.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Animations**: Framer Motion
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security)
- **Deployment**: Vercel (frontend) + GoDaddy DNS
- **Payment**: Cash on Delivery (COD)

## Features

### User Features
- Sign up with gender and region (city/country) selection
- Products filtered by gender and regional outlet
- Fun onboarding beauty survey (skin type, hair type, concerns)
- AI-powered personalized combo recommendations
- Dermatologist-verified product combos
- Shopping cart and COD checkout
- Order tracking and history

### Admin Features
- Dashboard with order stats and revenue
- Order management with status updates and tracking numbers
- Product CRUD (add, edit, delete, pricing, stock)
- Combo creation and management
- Region/outlet management
- Gender-based product categorization

## Getting Started

### 1. Clone and Install

```bash
cd layali
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Optionally run `supabase/seed.sql` for sample products
4. Copy your project URL and anon key from **Settings > API**

### 3. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Create Admin Account

1. Sign up through the app at `/auth/signup`
2. In Supabase SQL Editor, run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
   ```
3. Sign in at `/auth/admin/signin`

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

### GoDaddy DNS

Point your domain to Vercel:
- Add a CNAME record: `www` → `cname.vercel-dns.com`
- Add an A record: `@` → `76.76.21.21`

### Custom Domain in Vercel

Go to Project Settings → Domains → Add your GoDaddy domain.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── shop/                 # Product catalog
│   ├── combos/               # Combo bundles
│   ├── cart/                 # Shopping cart
│   ├── checkout/             # COD checkout
│   ├── survey/               # Beauty profile survey
│   ├── account/              # User account & orders
│   ├── auth/                 # Sign in/up (user & admin)
│   └── admin/                # Admin dashboard
├── components/
│   ├── ui/                   # Reusable UI components
│   └── layout/               # Navbar, Footer
├── lib/
│   ├── supabase/             # Supabase clients
│   ├── ai-recommendation.ts  # AI combo engine
│   └── constants.ts          # App constants
├── store/
│   └── cart.ts               # Zustand cart store
└── types/
    └── database.ts           # TypeScript types
```

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Layali Pink | `#E8B4B8` | Primary accent |
| Layali Blush | `#FADADD` | Backgrounds |
| Layali Cream | `#FFF8F5` | Page background |
| Layali Black | `#1A1A1A` | Text, buttons |
| Layali Gold | `#C9A962` | Premium accents |

## License

Private — Layali Beauty © 2026
