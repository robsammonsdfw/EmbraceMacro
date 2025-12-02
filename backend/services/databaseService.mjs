
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Helper function to prepare meal data for database insertion.
 */
const processMealDataForSave = (mealData) => {
    const dataForDb = { ...mealData };
    if (dataForDb.imageUrl && dataForDb.imageUrl.startsWith('data:image')) {
        dataForDb.imageBase64 = dataForDb.imageUrl.split(',')[1];
        delete dataForDb.imageUrl;
    }
    delete dataForDb.id;
    delete dataForDb.createdAt;
    return dataForDb;
};

/**
 * Helper function to prepare meal data for the client.
 */
const processMealDataForClient = (mealData) => {
    const dataForClient = { ...mealData };
    if (dataForClient.imageBase64) {
        dataForClient.imageUrl = `data:image/jpeg;base64,${dataForClient.imageBase64}`;
        delete dataForClient.imageBase64;
    }
    return dataForClient;
};


export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO users (email) 
            VALUES ($1) 
            ON CONFLICT (email) 
            DO NOTHING;
        `;
        await client.query(insertQuery, [email]);

        const selectQuery = `SELECT id, email FROM users WHERE email = $1;`;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
            throw new Error("Failed to find or create user after insert operation.");
        }
        
        // Ensure core tables exist
        await ensureTables(client);
        
        // Ensure rewards balance entry exists for this user
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING;
        `, [res.rows[0].id]);

        return res.rows[0];

    } catch (err) {
        console.error('Database error in findOrCreateUserByEmail:', err);
        throw new Error('Could not save or retrieve user data from the database.');
    } finally {
        client.release();
    }
};

const ensureTables = async (client) => {
    // Rewards
    await client.query(`
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
    `);

    // Venues (New for Reputation/Interest Graph)
    await client.query(`
        CREATE TABLE IF NOT EXISTS venues (
            id SERIAL PRIMARY KEY,
            google_place_id VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            address TEXT,
            types JSONB,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Add venue_id to meal_log_entries if not exists
    await client.query(`
        CREATE TABLE IF NOT EXISTS meal_log_entries (id SERIAL PRIMARY KEY, user_id VARCHAR(255) NOT NULL, meal_data JSONB, image_base64 TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
    `);
    
    try {
        await client.query(`ALTER TABLE meal_log_entries ADD COLUMN IF NOT EXISTS venue_id INT REFERENCES venues(id);`);
    } catch (e) {
        // Column likely exists
    }

    // Grocery Lists (New)
    await client.query(`
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
            name VARCHAR(255) NOT NULL, 
            checked BOOLEAN DEFAULT FALSE
        );
    `);
    
    // Updates to existing tables if needed
    try {
        await client.query(`ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS grocery_list_id INT REFERENCES grocery_lists(id) ON DELETE CASCADE;`);
    } catch (e) { console.log('Column grocery_list_id might already exist or error adding it', e); }

    try {
        await client.query(`ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';`);
    } catch (e) { console.log('Column metadata might already exist', e); }
};

// --- Venues Logic ---

export const getOrCreateVenue = async (placeData) => {
    if (!placeData || !placeData.place_id) return null;
    
    const client = await pool.connect();
    try {
        // Try to find
        const findQuery = `SELECT id, google_place_id, name, address FROM venues WHERE google_place_id = $1`;
        const findRes = await client.query(findQuery, [placeData.place_id]);
        
        if (findRes.rows.length > 0) {
            return findRes.rows[0];
        }

        // Create
        const insertQuery = `
            INSERT INTO venues (google_place_id, name, address, types)
            VALUES ($1, $2, $3, $4)
            RETURNING id, google_place_id, name, address;
        `;
        const insertRes = await client.query(insertQuery, [
            placeData.place_id, 
            placeData.name, 
            placeData.formatted_address || '', 
            JSON.stringify(placeData.types || [])
        ]);
        return insertRes.rows[0];
    } catch (err) {
        console.error("Error in getOrCreateVenue:", err);
        return null; // Fail gracefully, log the meal without a venue
    } finally {
        client.release();
    }
};

export const getVenueById = async (venueId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM venues WHERE id = $1`, [venueId]);
        return res.rows[0];
    } finally {
        client.release();
    }
}


// --- Rewards Logic ---

export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert into ledger
        await client.query(`
            INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata)
            VALUES ($1, $2, $3, $4)
        `, [userId, eventType, points, metadata]);

        // 2. Update balances
        const updateRes = await client.query(`
            UPDATE rewards_balances
            SET points_total = points_total + $2,
                points_available = points_available + $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING points_total
        `, [userId, points]);
        
        // 3. Recalculate Tier
        const newTotal = updateRes.rows[0].points_total;
        let newTier = 'Bronze';
        if (newTotal >= 5000) newTier = 'Platinum';
        else if (newTotal >= 1000) newTier = 'Gold';
        else if (newTotal >= 200) newTier = 'Silver';

        await client.query(`
            UPDATE rewards_balances SET tier = $2 WHERE user_id = $1
        `, [userId, newTier]);

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error awarding points:', err);
        // We don't throw here to avoid blocking the main user action if rewards fail
    } finally {
        client.release();
    }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const balanceRes = await client.query(`
            SELECT points_total, points_available, tier 
            FROM rewards_balances WHERE user_id = $1
        `, [userId]);
        
        const historyRes = await client.query(`
            SELECT entry_id, event_type, points_delta, created_at, metadata
            FROM rewards_ledger
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [userId]);

        const balance = balanceRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };

        return {
            ...balance,
            history: historyRes.rows
        };
    } catch (err) {
        console.error('Error getting rewards summary:', err);
        throw new Error('Could not retrieve rewards.');
    } finally {
        client.release();
    }
};


// --- Meal Log (History) Persistence ---

export const createMealLogEntry = async (userId, mealData, imageBase64, placeData = null) => {
    const client = await pool.connect();
    try {
        let venueId = null;
        
        // 1. Handle Venue Logic (Interest Graph)
        if (placeData) {
            const venue = await getOrCreateVenue(placeData);
            if (venue) venueId = venue.id;
        }

        // 2. Insert Meal Log
        const query = `
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64, venue_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, meal_data, image_base64, venue_id, created_at;
        `;
        const res = await client.query(query, [userId, mealData, imageBase64, venueId]);
        const row = res.rows[0];
        
        // 3. Award points
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id, venue_id: venueId });

        // 4. Return formatted data
        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        
        // Fetch full venue details if attached
        let venue = null;
        if (venueId) {
             venue = await getVenueById(venueId);
        }

        return { 
            id: row.id,
            ...mealDataFromDb,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at,
            venue: venue
        };
    } catch (err) {
        console.error('Database error in createMealLogEntry:', err);
        throw new Error('Could not save meal to history.');
    } finally {
        client.release();
    }
};


export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                m.id, m.meal_data, m.image_base64, m.created_at,
                v.id as venue_id, v.name as venue_name, v.google_place_id, v.address as venue_address
            FROM meal_log_entries m
            LEFT JOIN venues v ON m.venue_id = v.id
            WHERE m.user_id = $1 
            ORDER BY m.created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            
            let venue = null;
            if (row.venue_id) {
                venue = {
                    id: row.venue_id,
                    name: row.venue_name,
                    google_place_id: row.google_place_id,
                    address: row.venue_address
                };
            }

            return {
                id: row.id,
                ...mealData,
                imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
                createdAt: row.created_at,
                venue: venue
            };
        });
    } catch (err) {
        console.error('Database error in getMealLogEntries:', err);
        throw new Error('Could not retrieve meal history.');
    } finally {
        client.release();
    }
};

export const getMealLogEntryById = async (userId, logId) => {
    const client = await pool.connect();
    try {
         const query = `
            SELECT 
                m.id, m.meal_data, m.image_base64, m.created_at,
                v.id as venue_id, v.name as venue_name, v.google_place_id, v.address as venue_address
            FROM meal_log_entries m
            LEFT JOIN venues v ON m.venue_id = v.id
            WHERE m.user_id = $1 AND m.id = $2;
        `;
        const res = await client.query(query, [userId, logId]);
        if(res.rows.length === 0) return null;
        const row = res.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
         let venue = null;
        if (row.venue_id) {
            venue = {
                id: row.venue_id,
                name: row.venue_name,
                google_place_id: row.google_place_id,
                address: row.venue_address
            };
        }
        return {
            id: row.id,
            ...mealData,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at,
            venue: venue
        };
    } finally { client.release(); }
};

// --- Saved Meals Persistence ---

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, meal_data FROM saved_meals 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return { id: row.id, ...processMealDataForClient(mealData) };
        });
    } catch (err) {
        console.error('Database error in getSavedMeals:', err);
        throw new Error('Could not retrieve saved meals.');
    } finally {
        client.release();
    }
};

export const getSavedMealById = async (userId, mealId) => {
     const client = await pool.connect();
    try {
        const query = `SELECT id, meal_data FROM saved_meals WHERE user_id = $1 AND id = $2;`;
        const res = await client.query(query, [userId, mealId]);
        if(res.rows.length === 0) return null;
        const mealData = res.rows[0].meal_data && typeof res.rows[0].meal_data === 'object' ? res.rows[0].meal_data : {};
        return { id: res.rows[0].id, ...processMealDataForClient(mealData) };
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const mealDataForDb = processMealDataForSave(mealData);
        const query = `
            INSERT INTO saved_meals (user_id, meal_data) 
            VALUES ($1, $2) 
            RETURNING id, meal_data;
        `;
        const res = await client.query(query, [userId, mealDataForDb]);
        const row = res.rows[0];
        
        // Award points for saving a meal
        await awardPoints(userId, 'meal.saved', 10, { saved_meal_id: row.id });
        
        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};

        return { id: row.id, ...processMealDataForClient(mealDataFromDb) };
    } catch (err) {
        console.error('Database error in saveMeal:', err);
        throw new Error('Could not save meal.');
    } finally {
        client.release();
    }
};

export const deleteMeal = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2;`, [mealId, userId]);
    } catch (err) {
        console.error('Database error in deleteMeal:', err);
        throw new Error('Could not delete meal.');
    } finally {
        client.release();
    }
};

// --- Meal Plans Persistence ---

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                p.id as plan_id, p.name as plan_name,
                i.id as item_id, i.metadata,
                sm.id as meal_id, sm.meal_data
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1
            ORDER BY p.name, i.created_at;
        `;
        const res = await client.query(query, [userId]);
        
        // Process flat results into nested structure
        const plans = new Map();
        res.rows.forEach(row => {
            if (!plans.has(row.plan_id)) {
                plans.set(row.plan_id, {
                    id: row.plan_id,
                    name: row.plan_name,
                    items: [],
                });
            }
            if (row.item_id) { // Ensure item exists (for empty plans)
                const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
                plans.get(row.plan_id).items.push({
                    id: row.item_id,
                    metadata: row.metadata,
                    meal: {
                        id: row.meal_id,
                        ...processMealDataForClient(mealData)
                    }
                });
            }
        });
        return Array.from(plans.values());
    } catch (err) {
        console.error('Database error in getMealPlans:', err);
        throw new Error('Could not retrieve meal plans.');
    } finally {
        client.release();
    }
};

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try {
        const query = `INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name;`;
        const res = await client.query(query, [userId, name]);
        return { ...res.rows[0], items: [] }; // Return new plan with empty items
    } catch(err) {
        if (err.code === '23505') { // unique_violation
            throw new Error(`A meal plan with the name "${name}" already exists.`);
        }
        console.error('Database error in createMealPlan:', err);
        throw new Error('Could not create meal plan.');
    } finally {
        client.release();
    }
};

export const deleteMealPlan = async (userId, planId) => {
    const client = await pool.connect();
    try {
        // ON DELETE CASCADE will handle deleting items from meal_plan_items
        await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2;`, [planId, userId]);
    } catch(err) {
        console.error('Database error in deleteMealPlan:', err);
        throw new Error('Could not delete meal plan.');
    } finally {
        client.release();
    }
};


export const addMealToPlanItem = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try {
        // Verify the user owns the plan and the meal before inserting
        const checkQuery = `
           SELECT (SELECT user_id FROM meal_plans WHERE id = $1) = $3 AS owns_plan,
                  (SELECT user_id FROM saved_meals WHERE id = $2) = $3 AS owns_meal;
        `;
        const checkRes = await client.query(checkQuery, [planId, savedMealId, userId]);
        if (!checkRes.rows[0] || !checkRes.rows[0].owns_plan || !checkRes.rows[0].owns_meal) {
            throw new Error("Authorization error: Cannot add meal to a plan you don't own, or meal/plan does not exist.");
        }

        const insertQuery = `
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING id, metadata;
        `;
        const insertRes = await client.query(insertQuery, [userId, planId, savedMealId, metadata]);
        const newItemId = insertRes.rows[0].id;
        const savedMetadata = insertRes.rows[0].metadata;

        // Fetch the full data for the new item to return to client
        const selectQuery = `
            SELECT 
                i.id,
                m.id as meal_id,
                m.meal_data
            FROM meal_plan_items i
            JOIN saved_meals m ON i.saved_meal_id = m.id
            WHERE i.id = $1;
        `;
        const selectRes = await client.query(selectQuery, [newItemId]);
        const row = selectRes.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return {
            id: row.id,
            metadata: savedMetadata,
            meal: { id: row.meal_id, ...processMealDataForClient(mealData) }
        };

    } catch (err) {
        console.error('Database error in addMealToPlanItem:', err);
        throw new Error('Could not add meal to plan.');
    } finally {
        client.release();
    }
};


export const addMealAndLinkToPlan = async (userId, mealData, planId, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Step 1: Save the new meal to get an ID.
        const newMeal = await saveMeal(userId, mealData);
        
        // Step 2: Add the newly saved meal to the specified plan.
        const newPlanItem = await addMealToPlanItem(userId, planId, newMeal.id, metadata);
        
        await client.query('COMMIT');
        
        return newPlanItem;

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database transaction error in addMealAndLinkToPlan:', err);
        throw new Error('Could not add meal from history to plan due to a database error.');
    } finally {
        client.release();
    }
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2;`, [planItemId, userId]);
    } catch (err) {
        console.error('Database error in removeMealFromPlanItem:', err);
        throw new Error('Could not remove meal from plan.');
    } finally {
        client.release();
    }
};


// --- Grocery List Persistence ---

export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
}

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM grocery_list_items WHERE user_id = $1 AND grocery_list_id = $2 ORDER BY name ASC`, [userId, listId]);
        return res.rows;
    } finally { client.release(); }
}

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING *`, [userId, name]);
        return res.rows[0];
    } finally { client.release(); }
}

export const setActiveGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`, [userId]);
        await client.query(`UPDATE grocery_lists SET is_active = TRUE WHERE user_id = $1 AND id = $2`, [userId, listId]);
        await client.query('COMMIT');
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally { client.release(); }
}

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_lists WHERE user_id = $1 AND id = $2`, [userId, listId]);
    } finally { client.release(); }
}

export const addGroceryListItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_list_items (user_id, grocery_list_id, name, checked) VALUES ($1, $2, $3, FALSE) RETURNING *`, [userId, listId, name]);
        return res.rows[0];
    } finally { client.release(); }
}

export const removeGroceryListItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_list_items WHERE user_id = $1 AND id = $2`, [userId, itemId]);
    } finally { client.release(); }
}

export const generateGroceryList = async (userId, planIds = [], name = "Generated List") => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Step 1: Create a new grocery list
        const listRes = await client.query(`INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, TRUE) RETURNING *`, [userId, name]);
        const listId = listRes.rows[0].id;
        
        // Deactivate other lists
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1 AND id != $2`, [userId, listId]);

        if (planIds.length > 0) {
            // Step 2: Get all ingredients from meals within the selected plans
            const mealQuery = `
                SELECT sm.meal_data
                FROM saved_meals sm
                JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
                WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[]);
            `;
            const mealRes = await client.query(mealQuery, [userId, planIds]);
            const allIngredients = mealRes.rows.flatMap(row => row.meal_data?.ingredients || []);
            
            // Step 3: Create a unique, sorted list of ingredient names
            const uniqueIngredientNames = [...new Set(allIngredients.map(ing => ing.name))].sort();

            // Step 4: Insert the new list items
            if (uniqueIngredientNames.length > 0) {
                const insertQuery = `
                    INSERT INTO grocery_list_items (user_id, grocery_list_id, name)
                    SELECT $1, $2, unnest($3::text[]);
                `;
                await client.query(insertQuery, [userId, listId, uniqueIngredientNames]);
            }
        }
        
        await client.query('COMMIT');

        // Step 5: Return the newly created list
        return listRes.rows[0];

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database transaction error in generateGroceryList:', err);
        throw new Error('Could not generate grocery list.');
    } finally {
        client.release();
    }
};

export const updateGroceryListItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const query = `
            UPDATE grocery_list_items 
            SET checked = $1 
            WHERE id = $2 AND user_id = $3
            RETURNING id, name, checked;
        `;
        const res = await client.query(query, [checked, itemId, userId]);
        if (res.rows.length === 0) {
            throw new Error("Grocery item not found or user unauthorized.");
        }
        return res.rows[0];
    } catch (err) {
        console.error('Database error in updateGroceryListItem:', err);
        throw new Error('Could not update grocery list item.');
    } finally {
        client.release();
    }
};

// Deprecated or alternative clear function, assuming singular list approach legacy
export const clearGroceryList = async (userId, type) => {
    // This functionality might need to be scoped to a listId in future, 
    // but for now, let's assume it clears items from all lists or active ones if we wanted to be strict.
    // Given the request errors, this might not be called by the updated lambda code, 
    // but we keep it for safety if referenced elsewhere.
    const client = await pool.connect();
    try {
        let query;
        if (type === 'checked') {
            query = `DELETE FROM grocery_list_items WHERE user_id = $1 AND checked = TRUE;`;
        } else if (type === 'all') {
            query = `DELETE FROM grocery_list_items WHERE user_id = $1;`;
        } else {
            throw new Error("Invalid clear type specified.");
        }
        await client.query(query, [userId]);
    } catch (err) {
        console.error('Database error in clearGroceryList:', err);
        throw new Error('Could not clear grocery list items.');
    } finally {
        client.release();
    }
};

// --- Body Scans Persistence ---

export const saveBodyScan = async (userId, scanData) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO body_scans (user_id, scan_data)
            VALUES ($1, $2)
            RETURNING id, scan_data, created_at;
        `;
        const res = await client.query(query, [userId, scanData]);
        return res.rows[0];
    } catch (err) {
        console.error('Database error in saveBodyScan:', err);
        throw new Error('Could not save body scan.');
    } finally {
        client.release();
    }
};

export const getBodyScans = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, scan_data, created_at
            FROM body_scans
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows;
    } catch (err) {
        console.error('Database error in getBodyScans:', err);
        throw new Error('Could not retrieve body scans.');
    } finally {
        client.release();
    }
};
