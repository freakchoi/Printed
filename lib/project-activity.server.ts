import type { ProjectAction, PrismaClient } from '@prisma/client'

type PrismaLike = Pick<PrismaClient, 'projectActivity'>
type QueryablePrismaLike = Pick<PrismaClient, '$queryRawUnsafe'>

export type ProjectPersistenceCapabilities = {
  projectActivityTable: boolean
  projectActorColumns: boolean
  projectExportColumns: boolean
}

type SqliteTableInfoRow = {
  name: string
}

type SqliteMasterRow = {
  name: string
}

export type ActorIdentityInput = {
  actorClientId?: string | null
  actorName?: string | null
}

export type ActorIdentity = {
  actorClientId: string | null
  actorName: string | null
}

export function normalizeActorIdentity(input: ActorIdentityInput): ActorIdentity {
  const actorName = input.actorName?.trim() || null
  const actorClientId = input.actorClientId?.trim() || null
  return { actorName, actorClientId }
}

export function buildAutoCloneName(name: string, existingNames: Set<string>) {
  const baseName = `${name} 자동 복구본`
  if (!existingNames.has(baseName)) return baseName

  let suffix = 2
  while (existingNames.has(`${baseName} ${suffix}`)) {
    suffix += 1
  }
  return `${baseName} ${suffix}`
}

export function evaluateProjectPersistenceCapabilities(args: {
  projectColumns: string[]
  tables: string[]
}): ProjectPersistenceCapabilities {
  const columns = new Set(args.projectColumns)
  const tables = new Set(args.tables)

  return {
    projectActorColumns: [
      'createdByActorName',
      'createdByActorClientId',
      'lastEditedByActorName',
      'lastEditedByActorClientId',
    ].every(column => columns.has(column)),
    projectExportColumns: [
      'lastExportedAt',
      'lastExportedByActorName',
      'lastExportedByActorClientId',
    ].every(column => columns.has(column)),
    projectActivityTable: tables.has('ProjectActivity'),
  }
}

function getGlobalProjectPersistenceCache() {
  const globalState = globalThis as typeof globalThis & {
    __printedProjectPersistenceCapabilitiesPromise?: Promise<ProjectPersistenceCapabilities>
    __printedProjectPersistenceWarnings?: Set<string>
  }

  if (!globalState.__printedProjectPersistenceWarnings) {
    globalState.__printedProjectPersistenceWarnings = new Set<string>()
  }

  return globalState
}

function logProjectPersistenceWarningOnce(message: string) {
  const globalState = getGlobalProjectPersistenceCache()
  if (globalState.__printedProjectPersistenceWarnings?.has(message)) return
  globalState.__printedProjectPersistenceWarnings?.add(message)
  console.warn(message)
}

async function inspectProjectPersistenceCapabilities(prisma: QueryablePrismaLike): Promise<ProjectPersistenceCapabilities> {
  try {
    const [projectColumns, tables] = await Promise.all([
      prisma.$queryRawUnsafe<SqliteTableInfoRow[]>('PRAGMA table_info("Project")'),
      prisma.$queryRawUnsafe<SqliteMasterRow[]>("SELECT name FROM sqlite_master WHERE type='table'"),
    ])

    const capabilities = evaluateProjectPersistenceCapabilities({
      projectColumns: projectColumns.map(column => column.name),
      tables: tables.map(table => table.name),
    })

    if (!capabilities.projectActorColumns || !capabilities.projectExportColumns || !capabilities.projectActivityTable) {
      logProjectPersistenceWarningOnce(
        `[Printed] Project persistence capabilities degraded: actorColumns=${String(capabilities.projectActorColumns)}, exportColumns=${String(capabilities.projectExportColumns)}, activityTable=${String(capabilities.projectActivityTable)}. Apply the latest migration and restart the server.`,
      )
    }

    return capabilities
  } catch (error) {
    logProjectPersistenceWarningOnce(
      `[Printed] Failed to inspect project persistence schema. Actor/history features will be disabled. ${error instanceof Error ? error.message : String(error)}`,
    )
    return {
      projectActorColumns: false,
      projectExportColumns: false,
      projectActivityTable: false,
    }
  }
}

export async function getProjectPersistenceCapabilities(prisma: QueryablePrismaLike) {
  const globalState = getGlobalProjectPersistenceCache()
  if (!globalState.__printedProjectPersistenceCapabilitiesPromise) {
    globalState.__printedProjectPersistenceCapabilitiesPromise = inspectProjectPersistenceCapabilities(prisma)
  }

  return globalState.__printedProjectPersistenceCapabilitiesPromise
}

export async function recordProjectActivityIfSupported(
  prisma: PrismaLike,
  capabilities: Pick<ProjectPersistenceCapabilities, 'projectActivityTable'>,
  input: Parameters<typeof recordProjectActivity>[1],
) {
  if (!capabilities.projectActivityTable) return
  await recordProjectActivity(prisma, input)
}

export async function recordProjectActivity(
  prisma: PrismaLike,
  {
    action,
    actor,
    metadata,
    projectId,
    projectNameSnapshot,
    templateId,
  }: {
    action: ProjectAction
    actor: ActorIdentity
    metadata?: Record<string, unknown> | null
    projectId?: string | null
    projectNameSnapshot: string
    templateId?: string | null
  },
) {
  await prisma.projectActivity.create({
    data: {
      action,
      actorClientId: actor.actorClientId,
      actorName: actor.actorName,
      metadata: metadata ? JSON.stringify(metadata) : null,
      projectId: projectId ?? null,
      projectNameSnapshot,
      templateId: templateId ?? null,
    },
  })
}
