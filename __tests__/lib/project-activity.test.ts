import { buildAutoCloneName, evaluateProjectPersistenceCapabilities, normalizeActorIdentity } from '@/lib/project-activity.server'

describe('normalizeActorIdentity', () => {
  it('작업자 이름과 client id를 trim 해서 정규화한다', () => {
    expect(normalizeActorIdentity({
      actorName: '  디자이너A  ',
      actorClientId: '  client-1  ',
    })).toEqual({
      actorName: '디자이너A',
      actorClientId: 'client-1',
    })
  })

  it('빈 값은 null 로 정규화한다', () => {
    expect(normalizeActorIdentity({
      actorName: '   ',
      actorClientId: '',
    })).toEqual({
      actorName: null,
      actorClientId: null,
    })
  })
})

describe('buildAutoCloneName', () => {
  it('중복이 없으면 자동 복구본 이름을 바로 반환한다', () => {
    expect(buildAutoCloneName('명함 시안', new Set(['명함 시안']))).toBe('명함 시안 자동 복구본')
  })

  it('중복이 있으면 suffix 를 붙인다', () => {
    expect(buildAutoCloneName('명함 시안', new Set([
      '명함 시안',
      '명함 시안 자동 복구본',
      '명함 시안 자동 복구본 2',
    ]))).toBe('명함 시안 자동 복구본 3')
  })
})

describe('evaluateProjectPersistenceCapabilities', () => {
  it('필수 컬럼과 테이블이 모두 있으면 모든 기능을 활성화한다', () => {
    expect(evaluateProjectPersistenceCapabilities({
      projectColumns: [
        'id',
        'createdByActorName',
        'createdByActorClientId',
        'lastEditedByActorName',
        'lastEditedByActorClientId',
        'lastExportedAt',
        'lastExportedByActorName',
        'lastExportedByActorClientId',
      ],
      tables: ['Project', 'ProjectActivity'],
    })).toEqual({
      projectActorColumns: true,
      projectExportColumns: true,
      projectActivityTable: true,
    })
  })

  it('필수 컬럼이나 테이블이 없으면 degrade 상태로 계산한다', () => {
    expect(evaluateProjectPersistenceCapabilities({
      projectColumns: ['id', 'createdByActorName'],
      tables: ['Project'],
    })).toEqual({
      projectActorColumns: false,
      projectExportColumns: false,
      projectActivityTable: false,
    })
  })
})
