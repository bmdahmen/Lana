-- Collapse four spending categories into two: Education and Subscriptions
-- fold into Entertainment; Health & Wellness and Personal Care fold into
-- Shopping. Existing transactions and rules are repointed before the old
-- categories are deleted (deleting first would CASCADE-delete any rules
-- pointing at them, and null out any transactions' category_id).

UPDATE "transaction" SET category_id = 'cat_entertainment' WHERE category_id IN ('cat_education', 'cat_subscriptions');
UPDATE "transaction" SET category_id = 'cat_shopping' WHERE category_id IN ('cat_health', 'cat_personal');

UPDATE category_rule SET category_id = 'cat_entertainment' WHERE category_id IN ('cat_education', 'cat_subscriptions');
UPDATE category_rule SET category_id = 'cat_shopping' WHERE category_id IN ('cat_health', 'cat_personal');

DELETE FROM category WHERE id IN ('cat_education', 'cat_subscriptions', 'cat_health', 'cat_personal');
