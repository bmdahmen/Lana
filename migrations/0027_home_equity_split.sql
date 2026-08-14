-- Supports jointly-owned accounts where the two owners contributed
-- unequal amounts up front but split everything since (appreciation,
-- principal paydown) evenly. When set, the account's balance is
-- attributed 50/50 between brian/emily plus/minus this fixed dollar
-- offset (positive favors brian) instead of wholesale to `owner` -- see
-- computeNetWorthSeries in src/lib/queries.ts. NULL keeps the existing
-- single-owner behavior; 0 means an even 50/50 split with no skew.
ALTER TABLE account ADD COLUMN split_offset REAL;

-- Home (18321 SE 147th Pl, Renton, WA): purchase price $1,100,000, first
-- mortgage $776,000 (as recalled -- Lana doesn't store loan origination
-- amounts since Plaid's Liabilities product isn't connected for this
-- item, only Transactions/Investments). Emily's initial down payment was
-- $50,000; Brian covered the rest of the $324,000 total down payment
-- ($274,000). Both split all appreciation and paydown since evenly, which
-- reduces to a $112,000 fixed offset in Brian's favor on top of a 50/50
-- split (see conversation for derivation): offset = (purchase_price -
-- emily_initial)/2 - loan/2 = (1,100,000 - 50,000)/2 - 776,000/2.
UPDATE account SET split_offset = 112000
WHERE id = 'acct_49bc1fe8161b452080f06e9f276d3a9e';

-- The mortgage on the same home: paydown since purchase splits evenly
-- too, so this is a plain 50/50 split (offset 0, not NULL, so it's still
-- treated as split rather than 100% Brian).
UPDATE account SET split_offset = 0
WHERE id = 'acct_38d4ab4bff854fcb98127741b88db7c9';
