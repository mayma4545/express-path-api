-- SQL Migration: Add Event Recurrence Feature
-- Date: 2026-04-19
-- Purpose: Update recurrence_type enum from 'none' to 'once' and ensure proper defaults

-- Step 1: Update existing records with 'none' to 'once'
UPDATE events SET recurrence_type='once' WHERE recurrence_type='none';

-- Step 2: Modify the enum column definition
-- This may require dropping and recreating the column depending on your MySQL version
ALTER TABLE events 
MODIFY COLUMN recurrence_type 
ENUM('once', 'daily', 'weekly', 'monthly', 'yearly') 
DEFAULT 'once' NOT NULL;

-- Verification: Check if migration was successful
SELECT COUNT(*) as recurrence_once_count FROM events WHERE recurrence_type='once';
SELECT DISTINCT recurrence_type FROM events;

-- Optional: Check recurrence_end_date column (should already exist)
-- If not present, you can add it with:
-- ALTER TABLE events ADD COLUMN recurrence_end_date DATE NULL;
