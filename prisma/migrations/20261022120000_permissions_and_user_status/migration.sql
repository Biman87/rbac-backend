-- Migration: Add Permission model, RolePermission join table, and isActive on User

-- Step 1 — Create permissions table
CREATE TABLE "permissions" (
    "id"          TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "action"      TEXT        NOT NULL,
    "resource"    TEXT        NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_name_key"            ON "permissions"("name");
CREATE UNIQUE INDEX "permissions_action_resource_key" ON "permissions"("action", "resource");

-- Step 2 — Create role_permissions join table
CREATE TABLE "role_permissions" (
    "roleId"       TEXT        NOT NULL,
    "permissionId" TEXT        NOT NULL,
    "assignedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId", "permissionId")
);

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 3 — Add isActive column to users (nullable first, then backfill, then NOT NULL)
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN;
UPDATE "users" SET "isActive" = true;
ALTER TABLE "users" ALTER COLUMN "isActive" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "isActive" SET DEFAULT true;
