# Livskraft (Health App Beta)

Livskraft ("Life force" / "Vitality") is a modern, personalized health, nutrition, fitness, and everyday-activity web application. The core philosophy is: "Appen anpassar sig efter människan – människan behöver inte anpassa sig efter appen."

## Architecture Overview

- **Frontend**: Next.js 14 (App Router) with React, Tailwind CSS, and shadcn/ui inspired components.
- **Backend**: Next.js API routes / Server Actions.
- **Database**: Prisma ORM with SQLite for the beta (easily portable and deployable).
- **Styling**: Tailwind CSS for responsive, accessible, and theme-able design.
- **Language**: TypeScript for end-to-end type safety.

## Technology Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Prisma (SQLite)
- Lucide React (Icons)
- Radix UI (Primitives)

## Local Installation

1. Ensure Node.js (v18+) is installed.
2. Clone the repository and navigate to the project root.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Initialize the database and run the seed script to populate demo data:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

Copy `.env.example` to `.env` (automatically created by Prisma if not present).

```
# .env
DATABASE_URL="file:./dev.db"
```

## Implemented Features (Full Beta)

- **Landing Page**: Modern, premium, unaggressive design communicating the core philosophy.
- **Onboarding Flow**: Multi-step setup gathering goals, dietary restrictions, and lifestyle preferences. Evaluates weight-loss goals for safety.
- **Database & Persistence**: Wired end-to-end to Prisma (SQLite). User profiles, restrictions, and logs are persisted.
- **Dashboard ("Idag")**: A clean daily overview connected to DB state. Prioritizes "What do I do next?". Includes Simple vs Advanced view toggling.
- **Meals & Rules Engine**: Dynamic filtering of recipes based on hard constraints (e.g., lactose-free, vegan) set during onboarding. Includes a generated shopping list.
- **Training Page**: Supports different training environments (home vs gym) with sets/reps and duration. Allows for quick alternatives if short on time.
- **Progress Page**: Adaptive Week implementation, analyzing past adherence to propose forward-looking changes, plus visual trends.
- **AI Coach Mockup**: A conversational interface demonstrating contextual "Life Happens" support, reacting differently to missing ingredients vs missed workouts vs dining out.
- **Goal Safety System**: Blocks/warns on excessively aggressive weight-loss requests (>1kg/week).

## Known Limitations & Future Improvements

- Authentication uses a naive `localStorage` ID token for beta demonstration; requires NextAuth/Auth.js for production.
- AI Coach responses are deterministic, context-aware mocks.
- Food tracking and training completion currently use hardcoded toggles or simplified counters.
- Full dynamic generation of a 7-day meal plan array is approximated via filtered recipes.

## AWS Deployment Considerations

To deploy this application to AWS:

1. **Database**: Migrate from SQLite to Amazon RDS (PostgreSQL). Update the `DATABASE_URL` and Prisma schema provider.
2. **Compute**: Deploy the Next.js application using AWS Amplify Hosting for Next.js, or containerize it using Docker and deploy via Amazon ECS (Fargate).
3. **Secrets**: Store production secrets (e.g., API keys for the AI service) in AWS Secrets Manager and expose them as environment variables to the container.
