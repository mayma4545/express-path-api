# Event Recurrence Feature Implementation Guide

## Overview
Added recurrence/frequency feature to events. Users can now specify if an event occurs:
- **Once** (default) - Single occurrence
- **Daily** - Repeats every day
- **Weekly** - Repeats every week
- **Monthly** - Repeats every month
- **Yearly** - Repeats every year

## Changes Made

### 1. Database Model Update
**File:** `src/models/index.js`

Updated the Event model's `recurrence_type` field:
- Changed ENUM from `('none', 'daily', 'weekly', 'monthly', 'yearly')` to `('once', 'daily', 'weekly', 'monthly', 'yearly')`
- Changed default from `'none'` to `'once'`
- Added `recurrence_end_date` field (DATEONLY, nullable) - specifies when recurring events should stop

### 2. Frontend Form Update
**File:** `src/views/organizer/add_event.ejs`

Added two new fields to the event creation form:

**a) Recurrence Type Dropdown:**
- Label: "Recurrence"
- Options: Once Only (default), Daily, Weekly, Monthly, Yearly
- Field name: `recurrence_type`

**b) Recurrence End Date (conditional):**
- Label: "Recurrence End Date"
- Field name: `recurrence_end_date`
- Visibility: Hidden when "Once Only" is selected, shown for other options
- Allows organizers to set an end date for recurring events

**JavaScript Behavior:**
- Automatically shows/hides the recurrence end date field based on selection
- Clears the end date when switching back to "Once Only"

### 3. Backend Route Update
**File:** `src/routes/organizer/index.js`

Updated the `POST /organizer/events/add` endpoint to:
- Extract `recurrence_type` and `recurrence_end_date` from request
- Default `recurrence_type` to `'once'` if not provided
- Only save `recurrence_end_date` if recurrence type is NOT 'once'
- Store both values in the database when creating new events

### 4. Database Migration Script
**File:** `scripts/migrate_recurrence_type.js`

Created migration script to:
- Update existing records with `recurrence_type='none'` to `'once'`
- Modify the ENUM column definition in the database
- Can be run with: `npm run db:migrate:recurrence`

### 5. Package.json Script
**File:** `package.json`

Added npm script: `db:migrate:recurrence` to run the migration

## How to Use

### For New Events:
1. Navigate to `/organizer/events/add`
2. Fill in all event details as usual
3. Select recurrence type from dropdown (defaults to "Once Only")
4. If selecting Daily, Weekly, Monthly, or Yearly:
   - An "Recurrence End Date" field will appear
   - Set the date when the recurrence should stop
5. Submit the form

### For Existing Database:
1. Run the migration script to update existing data:
   ```bash
   npm run db:migrate:recurrence
   ```

   This will:
   - Convert all existing `'none'` values to `'once'`
   - Update the ENUM column definition

2. If the migration script fails due to database access, you can manually run:
   ```sql
   UPDATE events SET recurrence_type='once' WHERE recurrence_type='none';
   
   ALTER TABLE events 
   MODIFY COLUMN recurrence_type 
   ENUM('once', 'daily', 'weekly', 'monthly', 'yearly') 
   DEFAULT 'once' NOT NULL;
   ```

## Database Schema Changes

### Before:
```sql
recurrence_type ENUM('none', 'daily', 'weekly', 'monthly', 'yearly') DEFAULT 'none'
recurrence_end_date DATE (already existed)
```

### After:
```sql
recurrence_type ENUM('once', 'daily', 'weekly', 'monthly', 'yearly') DEFAULT 'once'
recurrence_end_date DATE (unchanged)
```

## Form Validation

- `recurrence_type` defaults to "once" if user doesn't select anything
- `recurrence_end_date` is optional and only saved if recurrence type is not "once"
- If recurrence type is "once", any previously set `recurrence_end_date` is cleared

## Testing Checklist

✓ Event model updated with new ENUM values
✓ Form fields added to add_event.ejs
✓ JavaScript visibility toggle implemented
✓ Backend route captures recurrence fields
✓ Default value set to "once"
✓ Migration script created and added to npm scripts
✓ Recurrence end date is conditional

## Next Steps (Optional)

If you want to implement recurring event logic in the future:
1. Create a service to generate event instances based on `recurrence_type` and `recurrence_end_date`
2. Add event expansion on demand (e.g., show next 10 occurrences)
3. Add recurrence field display to event details pages
4. Create update/delete logic for recurring events (update all vs. single instance)

## Files Modified

1. `src/models/index.js` - Updated Event model
2. `src/views/organizer/add_event.ejs` - Added form fields and JS
3. `src/routes/organizer/index.js` - Updated event creation route
4. `package.json` - Added migration script
5. `scripts/migrate_recurrence_type.js` - New migration script (created)

## Support

If you encounter issues:
1. Ensure `.env` file has correct database credentials
2. Check console for specific error messages
3. Verify database connection before running migration
4. If manual SQL is needed, use a MySQL client with proper privileges
