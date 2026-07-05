-- Normalize every historical (relevancy-windowed) account's cutover date to
-- 2026-06-30, so all La Lana backfill accounts hand off to their live-tracked
-- replacements at the same point, regardless of when each was added.

UPDATE account
SET relevant_until = '2026-06-30'
WHERE relevant_until IS NOT NULL;
