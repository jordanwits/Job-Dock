import {
  generateSavedLineItemFieldMapping,
  normalizeSavedLineItemName,
  parseMoneyForCsv,
} from './savedLineItemCsvHelpers'

describe('savedLineItemCsvHelpers', () => {
  test('normalizeSavedLineItemName trims and lowercases', () => {
    expect(normalizeSavedLineItemName('  Hot Water Tank  ')).toBe('hot water tank')
    expect(normalizeSavedLineItemName('ITEM\tname')).toBe('item name')
  })

  test('parseMoneyForCsv handles currency and commas', () => {
    expect(parseMoneyForCsv('$1,234.50')).toBe(1234.5)
    expect(parseMoneyForCsv('99.99')).toBe(99.99)
    expect(parseMoneyForCsv('')).toBeNull()
    expect(parseMoneyForCsv('abc')).toBeNull()
  })

  test('maps name-like columns to description', () => {
    expect(
      generateSavedLineItemFieldMapping(
        ['Item name', 'Qty'],
        [{ 'Item name': 'Basement finishing', Qty: '1' }]
      )
    ).toEqual({
      'Item name': 'description',
      Qty: 'defaultQuantity',
    })
  })

  test('detects unnamed numeric column as unit price', () => {
    expect(
      generateSavedLineItemFieldMapping(
        ['Basement Finishing', 'Unnamed: 1', 'Unnamed: 4'],
        [
          {
            'Basement Finishing': 'Basement Finishing - Full Basement Completion',
            'Unnamed: 1': '',
            'Unnamed: 4': '25000.0',
          },
          {
            'Basement Finishing': 'Basement Finishing - Open Concept Living Space',
            'Unnamed: 1': '',
            'Unnamed: 4': '18000.0',
          },
        ]
      )
    ).toEqual({
      'Basement Finishing': 'description',
      'Unnamed: 4': 'unitPrice',
    })
  })
})
