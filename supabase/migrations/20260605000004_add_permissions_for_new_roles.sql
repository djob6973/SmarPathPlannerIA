-- Add missing permissions to app_permission enum
-- Note: This must be executed separately from the INSERT statements
-- due to PostgreSQL restrictions on using new enum values in the same transaction

ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'manage_request_expiration';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'manage_areas';
