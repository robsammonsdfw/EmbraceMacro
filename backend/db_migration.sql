��
���-- 1. Create the grocery_lists table if it doesn't exist
CREATE TABLE IF NOT EXISTS grocery_lists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add the grocery_list_id column to items if missing
ALTER TABLE grocery_list_items
ADD COLUMN IF NOT EXISTS grocery_list_id INT;

-- 3. Create an index for performance
CREATE INDEX IF NOT EXISTS idx_grocery_list_items_list_id ON grocery_list_items(grocery_list_id);

-- 4. Create default lists for users who have items but no list
-- We cast user_id to text to avoid type mismatch errors
INSERT INTO grocery_lists (user_id, name, is_active)
SELECT DISTINCT user_id::text, 'My List', TRUE
FROM grocery_list_items
WHERE grocery_list_id IS NULL;

-- 5. Migrate existing items to the new default lists
-- The cast (::text) ensures we can compare user_id regardless of if it is INT or VARCHAR
UPDATE grocery_list_items item
SET grocery_list_id = list.id
FROM grocery_lists list
WHERE item.user_id::text = list.user_id::text
AND item.grocery_list_id IS NULL;