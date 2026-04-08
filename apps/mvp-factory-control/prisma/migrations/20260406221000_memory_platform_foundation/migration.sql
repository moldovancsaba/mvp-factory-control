-- CreateEnum
CREATE TYPE "MemoryScope" AS ENUM ('GLOBAL', 'APP', 'USER', 'APP_USER', 'SHARED');

-- CreateEnum
CREATE TYPE "MemoryLifecycleState" AS ENUM ('DRAFT', 'SYSTEM_PROPOSED', 'HUMAN_APPROVED', 'SUPERSEDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MemorySourceKind" AS ENUM ('MANUAL', 'AGENT_SESSION', 'SYSTEM_SUMMARY', 'IMPORT', 'POLICY', 'HANDOFF');

-- CreateTable
CREATE TABLE "MemoryAppInstance" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryAppInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryUserProfile" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryUserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorySource" (
    "id" TEXT NOT NULL,
    "kind" "MemorySourceKind" NOT NULL,
    "ref" TEXT,
    "title" TEXT,
    "contentHash" TEXT,
    "metadata" JSONB,
    "appInstanceId" TEXT,
    "userProfileId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemorySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryRecord" (
    "id" TEXT NOT NULL,
    "scope" "MemoryScope" NOT NULL,
    "lifecycleState" "MemoryLifecycleState" NOT NULL DEFAULT 'DRAFT',
    "recordType" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "keywords" TEXT[],
    "confidence" DOUBLE PRECISION,
    "appInstanceId" TEXT,
    "userProfileId" TEXT,
    "sharedChannelKey" TEXT,
    "sourceId" TEXT,
    "authoredByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEvent" (
    "id" TEXT NOT NULL,
    "recordId" TEXT,
    "eventType" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryAppInstance_key_key" ON "MemoryAppInstance"("key");

-- CreateIndex
CREATE INDEX "MemoryAppInstance_displayName_idx" ON "MemoryAppInstance"("displayName");

-- CreateIndex
CREATE INDEX "MemoryAppInstance_createdAt_idx" ON "MemoryAppInstance"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryUserProfile_key_key" ON "MemoryUserProfile"("key");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryUserProfile_userId_key" ON "MemoryUserProfile"("userId");

-- CreateIndex
CREATE INDEX "MemoryUserProfile_displayName_idx" ON "MemoryUserProfile"("displayName");

-- CreateIndex
CREATE INDEX "MemoryUserProfile_createdAt_idx" ON "MemoryUserProfile"("createdAt");

-- CreateIndex
CREATE INDEX "MemorySource_kind_createdAt_idx" ON "MemorySource"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "MemorySource_appInstanceId_createdAt_idx" ON "MemorySource"("appInstanceId", "createdAt");

-- CreateIndex
CREATE INDEX "MemorySource_userProfileId_createdAt_idx" ON "MemorySource"("userProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryRecord_scope_lifecycleState_createdAt_idx" ON "MemoryRecord"("scope", "lifecycleState", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryRecord_appInstanceId_scope_createdAt_idx" ON "MemoryRecord"("appInstanceId", "scope", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryRecord_userProfileId_scope_createdAt_idx" ON "MemoryRecord"("userProfileId", "scope", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryRecord_sharedChannelKey_lifecycleState_createdAt_idx" ON "MemoryRecord"("sharedChannelKey", "lifecycleState", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryRecord_recordType_createdAt_idx" ON "MemoryRecord"("recordType", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_recordId_createdAt_idx" ON "MemoryEvent"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_eventType_createdAt_idx" ON "MemoryEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_actorRole_createdAt_idx" ON "MemoryEvent"("actorRole", "createdAt");

-- AddForeignKey
ALTER TABLE "MemoryUserProfile" ADD CONSTRAINT "MemoryUserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorySource" ADD CONSTRAINT "MemorySource_appInstanceId_fkey" FOREIGN KEY ("appInstanceId") REFERENCES "MemoryAppInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorySource" ADD CONSTRAINT "MemorySource_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "MemoryUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorySource" ADD CONSTRAINT "MemorySource_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRecord" ADD CONSTRAINT "MemoryRecord_appInstanceId_fkey" FOREIGN KEY ("appInstanceId") REFERENCES "MemoryAppInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRecord" ADD CONSTRAINT "MemoryRecord_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "MemoryUserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRecord" ADD CONSTRAINT "MemoryRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MemorySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRecord" ADD CONSTRAINT "MemoryRecord_authoredByUserId_fkey" FOREIGN KEY ("authoredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRecord" ADD CONSTRAINT "MemoryRecord_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRecord" ADD CONSTRAINT "MemoryRecord_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "MemoryRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MemoryRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
