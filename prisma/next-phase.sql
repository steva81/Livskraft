-- Additive SQLite upgrade for an existing pre-next-phase database.
-- Back up the database first. No existing table/row is altered or removed.
-- Birth year, calculation sex and primary goal use the existing preferences JSON.
CREATE TABLE IF NOT EXISTS "OwnMeal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "components" TEXT NOT NULL,
  "portion" TEXT NOT NULL,
  "mealType" TEXT NOT NULL,
  "eatenAt" DATETIME NOT NULL,
  "nutrition" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OwnMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OwnMeal_userId_eatenAt_idx" ON "OwnMeal"("userId", "eatenAt");
CREATE TABLE IF NOT EXISTS "NutritionDecision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "proposalKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NutritionDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NutritionDecision_userId_proposalKey_key" ON "NutritionDecision"("userId", "proposalKey");
