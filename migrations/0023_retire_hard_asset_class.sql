-- The historical "Hard Assets" bucket (a single La Lana backfill account with
-- blended monthly totals) is being folded into Precious Metals so that line
-- has continuous history back to 2015. Cash has always been tracked
-- separately via its own historical account, so nothing here double-counts.
UPDATE account SET asset_class = 'precious_metals' WHERE asset_class = 'hard_asset';
