/**
 * The contact CSV importer used to ignore the field mapping the user picked: any column called
 * "Name"/"Client Name"/etc. was split into first + last even when the UI showed it as
 * "Don't import", and columns literally named Contact/Address/Info/Special Notes were read
 * regardless of their mapping. These tests pin the fix — the mapping is authoritative.
 */

const store: any[] = []
let nextId = 1

const fakePrisma = {
  contact: {
    findFirst: jest.fn(async ({ where }: any) =>
      store.find(c => Object.entries(where).every(([k, v]) => (c as any)[k] === v)) ?? null
    ),
    create: jest.fn(async ({ data }: any) => {
      const rec = { id: `c${nextId++}`, ...data }
      store.push(rec)
      return rec
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const rec = store.find(c => c.id === where.id)
      Object.assign(rec, data)
      return rec
    }),
  },
}

jest.mock('./db', () => ({ __esModule: true, default: fakePrisma, prisma: fakePrisma }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseCSVPreview, createImportSession, processImportSession } = require('./csvImport')

const HIJACK_CSV = `Name,Contact,Address,Info,Company
Moss Bucket,555-2001,88 Suds Blvd,Back gate,Bucket Co
`

/** Import `csv` with `mapping` and return the session result plus the rows it created. */
async function importWith(csv: string, mapping: Record<string, string>) {
  const before = store.length
  const session = createImportSession('tenant-1', 'test.csv', csv, mapping)
  const result = await processImportSession(session.id)
  return { result, created: store.slice(before) }
}

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  jest.restoreAllMocks()
})

beforeEach(() => {
  store.length = 0
})

describe('generateFieldMapping', () => {
  it('maps a full-name column to the fullName target instead of leaving it unmapped', () => {
    const { suggestedMapping } = parseCSVPreview(HIJACK_CSV)

    // Previously `Name` was deliberately absent here, so the import UI reported it as skipped
    // while the server split it anyway.
    expect(suggestedMapping).toEqual({
      Name: 'fullName',
      Contact: 'phone',
      Address: 'address',
      Info: 'notes',
      Company: 'company',
    })
  })
})

describe('mapRowToContact honours the chosen mapping', () => {
  it('splits a column mapped to fullName into first and last name', async () => {
    const { result, created } = await importWith(HIJACK_CSV, {
      Name: 'fullName',
      Contact: 'phone',
      Address: 'address',
      Info: 'notes',
      Company: 'company',
    })

    expect(result.progress.inserted).toBe(1)
    expect(created[0]).toMatchObject({
      firstName: 'Moss',
      lastName: 'Bucket',
      phone: '555-2001',
      address: '88 Suds Blvd',
      notes: 'Back gate',
      company: 'Bucket Co',
    })
  })

  it("does not import a name column the user set to Don't import", async () => {
    const { result, created } = await importWith(HIJACK_CSV, {
      Name: '',
      Contact: 'phone',
      Address: 'address',
      Info: 'notes',
      Company: 'company',
    })

    // With no name mapped the row cannot satisfy the required fields, and that is the honest
    // outcome — it must not be rescued by splitting a column the user opted out of.
    expect(created).toHaveLength(0)
    expect(result.progress.inserted).toBe(0)
    expect(result.progress.failed).toBe(1)
    expect(result.errors[0].message).toContain('Missing required fields')
  })

  it("leaves a field empty when its column is set to Don't import", async () => {
    const { created } = await importWith(HIJACK_CSV, {
      Name: 'fullName',
      Contact: '',
      Address: '',
      Info: '',
      Company: 'company',
    })

    expect(created).toHaveLength(1)
    // `Contact`, `Address` and `Info` used to be read straight off the row by name.
    expect(created[0].phone).toBeNull()
    expect(created[0].address).toBeNull()
    expect(created[0].notes).toBeNull()
    expect(created[0].company).toBe('Bucket Co')
  })

  it('writes a column to whatever field the user re-points it at', async () => {
    const { created } = await importWith(HIJACK_CSV, {
      Name: 'fullName',
      Info: 'jobTitle',
    })

    expect(created[0].jobTitle).toBe('Back gate')
    expect(created[0].notes).toBeNull()
  })

  it('lets an explicit firstName mapping win over a fullName split', async () => {
    const csv = `Name,First Name\nMoss Bucket,Mossy\n`
    const { created } = await importWith(csv, { Name: 'fullName', 'First Name': 'firstName' })

    expect(created[0].firstName).toBe('Mossy')
    expect(created[0].lastName).toBe('Bucket')
  })

  it('still splits a name column for a client that predates the fullName target', async () => {
    // Old clients omit full-name columns from the mapping entirely (rather than sending '').
    // Those files would otherwise fail every row, so the legacy auto-split still applies.
    const { result, created } = await importWith(HIJACK_CSV, { Contact: 'phone' })

    expect(result.progress.inserted).toBe(1)
    expect(created[0]).toMatchObject({ firstName: 'Moss', lastName: 'Bucket', phone: '555-2001' })
  })

  it('never leaks the synthetic fullName key into a conflict payload', async () => {
    const csv = `Name,Email\nDara Mopwell,dara@dummymail.test\n`
    const mapping = { Name: 'fullName', Email: 'email' }

    const first = await importWith(csv, mapping)
    expect(first.result.progress.inserted).toBe(1)
    expect(first.created[0]).toMatchObject({ firstName: 'Dara', lastName: 'Mopwell' })

    // Re-importing the same row raises a conflict, and resolving it spreads incomingData straight
    // into prisma.contact.update — a stray `fullName` key would throw there.
    const second = await importWith(csv, mapping)
    expect(second.result.pendingConflicts).toHaveLength(1)
    expect(second.result.pendingConflicts[0].incomingData).not.toHaveProperty('fullName')
  })
})
