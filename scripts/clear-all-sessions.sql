-- Clear all active sessions
-- Run this to force all users to re-authenticate

DELETE FROM sessions;

-- Verify sessions are cleared
SELECT COUNT(*) as remaining_sessions FROM sessions;