# Select Dropdown Fix - Status & Client Selection

## Issue Description

Two related problems were reported:
1. **Contact Status Dropdown**: Works in creation and edit pages, but the status field value doesn't get properly filled/displayed
2. **Quote Client Selection**: Selecting a client in quote creation doesn't properly set the value

## Root Cause

The custom `Select` component (`src/components/ui/Select.tsx`) was not properly updating the underlying hidden `<select>` element before triggering the `onChange` event handler from react-hook-form.

The issue was in the `handleSelect` function:

### Before (Broken):
```typescript
const handleSelect = (optionValue: string) => {
  if (selectRef.current && onChange) {
    // Created synthetic event but didn't update the actual select element
    const syntheticEvent = {
      target: { value: optionValue, name: name || '' },
      currentTarget: { value: optionValue, name: name || '' },
    } as React.ChangeEvent<HTMLSelectElement>
    
    onChange(syntheticEvent)
  }
  setIsOpen(false)
}
```

### After (Fixed):
```typescript
const handleSelect = (optionValue: string) => {
  if (selectRef.current) {
    // Update the hidden select element's value first
    selectRef.current.value = optionValue
    
    if (onChange) {
      // Create a synthetic event with the actual select element
      const syntheticEvent = {
        target: selectRef.current,
        currentTarget: selectRef.current,
        type: 'change',
      } as React.ChangeEvent<HTMLSelectElement>
      
      onChange(syntheticEvent)
    }
  }
  setIsOpen(false)
}
```

## What Changed

1. **Update Select Element First**: Now directly updates `selectRef.current.value = optionValue` before creating the synthetic event
2. **Use Actual Element**: The synthetic event now uses the actual `selectRef.current` element instead of a plain object
3. **Add Type**: Added `type: 'change'` to make the event more complete

## How This Fixes The Issues

### Contact Status Dropdown
- When creating a contact, selecting "Active", "Inactive", or "Lead" now properly updates the form state
- When editing a contact, the current status is properly displayed
- The status value is correctly saved to the database

### Quote Client Selection
- When creating a quote, selecting a client from the dropdown now properly sets the `contactId` field
- When editing a quote, the selected client is properly displayed
- The client selection is correctly saved when the quote is created/updated

## Testing Instructions

### Test Contact Status

1. **Create New Contact**
   ```
   - Go to CRM → Add Contact
   - Fill in required fields
   - Select Status: "Lead"
   - Save
   - Verify: Status shows as "Lead" in the contacts list
   ```

2. **Edit Contact Status**
   ```
   - Open an existing contact
   - Click Edit
   - Verify: Current status is pre-selected in dropdown
   - Change status to "Inactive"
   - Save
   - Verify: Status updates to "Inactive"
   ```

3. **Check Database**
   ```bash
   # On bastion host
   ssh -i jobdock-bastion.pem ec2-user@13.222.99.228
   cd ~/jobdock/backend
   npx prisma db execute --stdin <<< "SELECT id, firstName, lastName, status FROM contacts;"
   ```

### Test Quote Client Selection

1. **Create New Quote**
   ```
   - Go to Quotes → Create Quote
   - Click "Contact" dropdown
   - Select a contact
   - Verify: Contact name appears in dropdown
   - Fill in line items
   - Save
   - Verify: Quote is created with correct contact
   ```

2. **Edit Quote Client**
   ```
   - Open an existing quote
   - Click Edit
   - Verify: Current contact is pre-selected
   - Change to different contact
   - Save
   - Verify: Quote updates with new contact
   ```

3. **Check Database**
   ```bash
   # On bastion host
   npx prisma db execute --stdin <<< "
   SELECT q.id, q.quoteNumber, q.contactId, 
          c.firstName, c.lastName
   FROM quotes q
   JOIN contacts c ON q.contactId = c.id
   LIMIT 5;
   "
   ```

## Other Affected Components

This fix applies to **all forms using the Select component**:

### ✅ Contact Forms
- Status dropdown (Active/Inactive/Lead)

### ✅ Quote Forms
- Contact selection
- Status dropdown (Draft/Sent/Accepted/Rejected/Expired)

### ✅ Invoice Forms
- Contact selection
- Status dropdown
- Payment status dropdown

### ✅ Job Forms
- Contact selection
- Service selection
- Status dropdown

## Expected Behavior Now

1. **Dropdown Display**
   - Shows correct placeholder when no value selected
   - Shows correct selected option label when value is set
   - Visual indicator (highlighting) for selected option in dropdown list

2. **Form Integration**
   - Properly registers with react-hook-form
   - Correctly updates form state when selection changes
   - Properly displays validation errors
   - Shows correct default/initial values from database

3. **Data Persistence**
   - Selected values are correctly saved to database
   - When editing, current values are properly loaded and displayed
   - No data loss when switching between forms

## Verification Checklist

After the fix, verify these scenarios work:

- [ ] Create contact with status selection
- [ ] Edit contact and change status
- [ ] Status displays correctly in contact list
- [ ] Create quote with client selection
- [ ] Edit quote and change client
- [ ] Client name displays in quote details
- [ ] Create invoice with client selection
- [ ] Create job with contact and service selection
- [ ] All dropdowns show correct values when editing
- [ ] All data saves correctly to database

## Additional Notes

### Why Was This Happening?

React Hook Form needs the actual DOM element to properly track form state. By only passing a plain object with `target.value`, react-hook-form couldn't properly bind to the element or trigger its validation/state updates.

### Best Practice for Custom Form Components

When creating custom form components that wrap native inputs:
1. Always maintain a hidden native input for form libraries
2. Update the native input's value before triggering events
3. Pass the actual element reference in synthetic events
4. Use `forwardRef` and `useImperativeHandle` to expose the ref

### Performance Impact

None - this fix actually improves performance by directly updating the DOM element instead of creating unnecessary object allocations.

---

## Need Help?

If you still see issues:

1. **Clear browser cache** and reload the page
2. **Check browser console** for any errors
3. **Verify the form is using react-hook-form's `register()`** correctly
4. **Check that options array** has the correct `value` and `label` properties

The fix is applied to the base Select component, so all forms using it should automatically work correctly now.

