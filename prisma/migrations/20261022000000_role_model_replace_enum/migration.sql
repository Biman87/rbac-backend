-- Migration: Replace Role enum with a standalone roles table
-- Strategy (safe for existing data):
--   1. Create the new `roles` table
--   2. Seed the three canonical roles so they exist before we touch `users`
--   3. Add `roleId` as nullable first, backfill from the old `role` column, then set NOT NULL
--   4. Add the FK constraint
--   5. Drop the old enum column and the enum type

-- Step 1 — Create roles table
CREATE TABLE "roles" (
    "id"          TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- Step 2 — Seed the three canonical roles with deterministic IDs so the
--          backfill in step 3 can reference them directly.
INSERT INTO "roles" ("id", "name", "description", "createdAt", "updatedAt") VALUES
    ('role_admin',    'ADMIN',    'Full system access. Can manage users, roles, and all resources.',           NOW(), NOW()),
    ('role_manager',  'MANAGER',  'Can manage resources and view reports. Cannot manage roles.',               NOW(), NOW()),
    ('role_customer', 'CUSTOMER', 'Standard customer account with read-only access to own data.',              NOW(), NOW());

-- Step 3a — Add roleId as nullable (avoids the "no default value" error on existing rows)
ALTER TABLE "users" ADD COLUMN "roleId" TEXT;

-- Step 3b — Backfill: map old Role enum values → new role IDs
--   ADMIN  → role_admin
--   USER   → role_customer  (closest equivalent in the new scheme)
UPDATE "users"
SET "roleId" = CASE
    WHEN "role"::TEXT = 'ADMIN' THEN 'role_admin'
    ELSE 'role_customer'
END;

-- Step 3c — Now that every row has a value, enforce NOT NULL
ALTER TABLE "users" ALTER COLUMN "roleId" SET NOT NULL;

-- Step 4 — Add the foreign-key constraint
ALTER TABLE "users"
    ADD CONSTRAINT "users_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5a — Drop the old enum column
ALTER TABLE "users" DROP COLUMN "role";

-- Step 5b — Drop the enum type
DROP TYPE "Role";
