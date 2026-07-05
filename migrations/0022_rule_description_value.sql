-- Rules with match_field = 'both' need a distinct value per field --
-- merchant_name and name (the raw description) are rarely the same text, so
-- reusing a single match_value against both was too narrow to be useful.
-- match_value continues to hold the merchant-name value (or the sole value
-- for a single-field rule); description_value only applies when both fields
-- are required.
ALTER TABLE category_rule ADD COLUMN description_value TEXT;
