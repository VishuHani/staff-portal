-- CreateTable: field_permissions
CREATE TABLE IF NOT EXISTS "field_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "access" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: conditional_permissions
CREATE TABLE IF NOT EXISTS "conditional_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditional_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: time_based_access
CREATE TABLE IF NOT EXISTS "time_based_access" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_based_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "field_permissions_roleId_resource_field_key" ON "field_permissions"("roleId", "resource", "field");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "field_permissions_roleId_idx" ON "field_permissions"("roleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "field_permissions_resource_idx" ON "field_permissions"("resource");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "field_permissions_field_idx" ON "field_permissions"("field");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conditional_permissions_roleId_idx" ON "conditional_permissions"("roleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conditional_permissions_resource_idx" ON "conditional_permissions"("resource");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conditional_permissions_action_idx" ON "conditional_permissions"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "time_based_access_roleId_idx" ON "time_based_access"("roleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "time_based_access_resource_idx" ON "time_based_access"("resource");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "time_based_access_action_idx" ON "time_based_access"("action");

-- AddForeignKey
ALTER TABLE "field_permissions" ADD CONSTRAINT "field_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_permissions" ADD CONSTRAINT "conditional_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_based_access" ADD CONSTRAINT "time_based_access_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
