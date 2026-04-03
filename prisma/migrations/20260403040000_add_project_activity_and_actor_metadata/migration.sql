ALTER TABLE "Project" ADD COLUMN "createdByActorName" TEXT;
ALTER TABLE "Project" ADD COLUMN "createdByActorClientId" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastEditedByActorName" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastEditedByActorClientId" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastExportedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "lastExportedByActorName" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastExportedByActorClientId" TEXT;

CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "projectNameSnapshot" TEXT NOT NULL,
    "templateId" TEXT,
    "action" TEXT NOT NULL,
    "actorName" TEXT,
    "actorClientId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ProjectActivity_projectId_createdAt_idx" ON "ProjectActivity"("projectId", "createdAt");
CREATE INDEX "ProjectActivity_templateId_createdAt_idx" ON "ProjectActivity"("templateId", "createdAt");
