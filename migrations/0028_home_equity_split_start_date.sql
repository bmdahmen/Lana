-- The historical real estate backfill account (La Lana) carries balance
-- history going back to 2015, including years before the home was
-- purchased (balance $0). Applying split_offset across that whole span
-- would show a phantom +/-offset swing for Brian/Emily during years the
-- property didn't exist. This gates the split to dates on/after it
-- actually started; NULL keeps applying to the full history (unaffected
-- for accounts, like the live Home/Newrez ones, whose history never
-- predates the split anyway).
ALTER TABLE account ADD COLUMN split_offset_from TEXT;

-- Purchase date, confirmed by the historical balance jumping from $0 to
-- $1,100,000 between 2021-06-30 and 2021-07-31.
UPDATE account SET split_offset_from = '2021-07-01'
WHERE id IN ('acct_49bc1fe8161b452080f06e9f276d3a9e', 'acct_38d4ab4bff854fcb98127741b88db7c9');

-- The historical backfill account itself never had split_offset set, so
-- Emily's share only ever showed up from when the live Home/Newrez
-- accounts were linked (2026-07) instead of from purchase.
UPDATE account SET split_offset = 112000, split_offset_from = '2021-07-01'
WHERE id = 'acct_lalana_real_estate';
