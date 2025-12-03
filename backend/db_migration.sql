-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL
);

-- 2. Rewards System
CREATE TABLE IF NOT EXISTS rewards_balances (
    user_id VARCHAR(255) PRIMARY KEY,
    points_total INT DEFAULT 0,
    points_available INT DEFAULT 0,
    tier VARCHAR(50) DEFAULT 'Bronze',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rewards_ledger (
    entry_id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    points_delta INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- 3. Core Meal Data
CREATE TABLE IF NOT EXISTS saved_meals (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    meal_data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meal_log_entries (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    meal_data JSONB,
    image_base64 TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Meal Plans
CREATE TABLE IF NOT EXISTS meal_plans (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meal_plan_items (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    meal_plan_id INT NOT NULL,
    saved_meal_id INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Grocery Lists
CREATE TABLE IF NOT EXISTS grocery_lists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grocery_list_items (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    grocery_list_id INT,
    name VARCHAR(255) NOT NULL,
    checked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_grocery_list_items_list_id ON grocery_list_items(grocery_list_id);