/**
 * The contact CSV importer used to ignore the field mapping the user picked: any column called
 * "Name"/"Client Name"/etc. was split into first + last even when the UI showed it as
 * "Don't import", and columns literally named Contact/Address/Info/Special Notes were read
 * regardless of their mapping. These tests pin the fix — the mapping is authoritative.
 */

const store: any[] = []
let nextId = 1

/** Understands the subset of Prisma `where` syntax csvImport uses: scalars and { equals, mode }. */
const matchesFilter = (actual: any, expected: any): boolean => {
  if (expected && typeof expected === 'object' && 'equals' in expected) {
    const target = (expected as any).equals
    if (
      (expected as any).mode === 'insensitive' &&
      typeof actual === 'string' &&
      typeof target === 'string'
    ) {
      return actual.toLowerCase() === target.toLowerCase()
    }
    return actual === target
  }
  return actual === expected
}

const fakePrisma = {
  contact: {
    findFirst: jest.fn(async ({ where }: any) =>
      store.find(c => Object.entries(where).every(([k, v]) => matchesFilter((c as any)[k], v))) ?? null
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

describe('duplicate detection', () => {
  it('treats an email that differs only in case as the same contact', async () => {
    const mapping = { 'First Name': 'firstName', 'Last Name': 'lastName', Email: 'email' }

    const first = await importWith(
      `First Name,Last Name,Email\nAda,Sparkle,ada.sparkle@dummymail.test\n`,
      mapping
    )
    expect(first.result.progress.inserted).toBe(1)

    // This used to insert a second Ada Sparkle because the lookup was case-sensitive.
    const second = await importWith(
      `First Name,Last Name,Email\nAda,Sparkle,ADA.SPARKLE@DUMMYMAIL.TEST\n`,
      mapping
    )
    expect(second.result.progress.inserted).toBe(0)
    expect(second.result.pendingConflicts).toHaveLength(1)
  })
})

describe('malformed files', () => {
  const RAGGED_CSV = `First Name,Last Name,Email,Phone,Company
Hana,Duster,hana.duster@dummymail.test,555-0401,Duster Co
Ivan,Broom,ivan.broom@dummymail.test
Jo,Pail,jo.pail@dummymail.test,555-0403,Pail Ltd,EXTRA,MORE EXTRA
Kai,Rag,kai.rag@dummymail.test,555-0404,Rag Group
`

  it('imports rows whose column count does not match the header, and warns', () => {
    // Previously a single ragged row threw, which surfaced as a bare 500 and the user never got
    // past the upload step.
    const preview = parseCSVPreview(RAGGED_CSV)

    expect(preview.totalRows).toBe(4)
    expect(preview.warnings).toHaveLength(1)
    // Ivan is short on line 3, Jo has surplus columns on line 4.
    expect(preview.warnings[0]).toContain('lines 3, 4')
  })

  it('imports every row of a ragged file', async () => {
    const { result } = await importWith(RAGGED_CSV, {
      'First Name': 'firstName',
      'Last Name': 'lastName',
      Email: 'email',
      Phone: 'phone',
      Company: 'company',
    })

    expect(result.progress.inserted).toBe(4)
    expect(result.progress.failed).toBe(0)
  })

  it('rejects an unterminated quote with a 400 and a readable message', () => {
    const csv = `First Name,Last Name,Email\nKim,"Unclosed,kim@dummymail.test\n`

    expect(() => parseCSVPreview(csv)).toThrow(/never closed/)
    try {
      parseCSVPreview(csv)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('numbers row errors by their line in the file, counting blank lines', async () => {
    // Blank line 2, so the bad row (no last name) is on line 4 of the file. The old code reported
    // it as "Row 1" because it indexed the filtered array.
    const csv = `First Name,Last Name,Email\n\nLena,Polish,lena@dummymail.test\nUma,,uma@dummymail.test\n`
    const { result } = await importWith(csv, {
      'First Name': 'firstName',
      'Last Name': 'lastName',
      Email: 'email',
    })

    expect(result.progress.inserted).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(4)
    expect(result.errors[0].message).toBe('Missing required field: last name')
  })
})
