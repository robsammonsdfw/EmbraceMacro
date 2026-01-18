
import pg from 'pg';
import crypto from 'crypto';

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
        dataForClient.hasImage = true;
    } else {
        dataForClient.hasImage = false;
    }
    return dataForClient;
};

// NEW: Helper to strip image data for list views to prevent payload limits
const processMealDataForList = (mealData, externalHasImage = false) => {
    const dataForList = { ...mealData };
    
    // Determine if image exists (either passed in via SQL or inside the JSON)
    const hasImage = externalHasImage || !!dataForList.imageBase64 || !!dataForList.imageUrl;
    
    // STRIP HEAVY DATA
    delete dataForList.imageBase64;
    delete dataForList.imageUrl;
    
    dataForList.hasImage = hasImage;
    return dataForList;
};

export const findOrCreateUserByEmail = async (email, inviteCode = null) => {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO users (email) 
            VALUES ($1) 
            ON CONFLICT (email) 
            DO NOTHING;
        `;
        await client.query(insertQuery, [email]);

        const selectQuery = `SELECT id, email, shopify_customer_id FROM users WHERE email = $1;`;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
            throw new Error("Failed to find or create user after insert operation.");
        }
        
        const user = res.rows[0];

        // Ensure ALL application tables exist
        await ensureTables(client);
        
        // Ensure rewards balance entry exists for this user
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING;
        `, [user.id]);

        // Process Invite Code if provided (Referral Fulfillment)
        if (inviteCode) {
            await processReferral(client, user.id, inviteCode);
        }

        return user;

    } catch (err) {
        console.error('Database error in findOrCreateUserByEmail:', err);
        throw new Error('Could not save or retrieve user data from the database.');
    } finally {
        client.release();
    }
};

const processReferral = async (client, newUserId, code) => {
    try {
        // Find invitation
        const invRes = await client.query(`SELECT id, inviter_id, status FROM invitations WHERE token = $1`, [code]);
        if (invRes.rows.length === 0) return; // Invalid code
        
        const invite = invRes.rows[0];
        if (invite.status === 'joined') return; // Already used

        // 1. Mark joined
        await client.query(`UPDATE invitations SET status = 'joined' WHERE id = $1`, [invite.id]);

        // 2. Award Inviter 450 pts
        await client.query(`
            INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata)
            VALUES ($1, 'referral.join', 450, $2)
        `, [invite.inviter_id, JSON.stringify({ new_user_id: newUserId })]);

        await client.query(`
            UPDATE rewards_balances
            SET points_total = points_total + 450, points_available = points_available + 450
            WHERE user_id = $1
        `, [invite.inviter_id]);

        // 3. Create bidirectional friendship
        // Status 'accepted' because it was an invite
        const friendshipQ = `
            INSERT INTO friendships (requester_id, receiver_id, status)
            VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted')
            ON CONFLICT DO NOTHING
        `;
        await client.query(friendshipQ, [invite.inviter_id, newUserId]);

    } catch (e) {
        console.error("Referral processing error:", e);
    }
};

const ensureTables = async (client) => {
    // Core User & Rewards
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
            list_id INT, 
            name VARCHAR(255) NOT NULL,
            checked BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS invitations (
            id SERIAL PRIMARY KEY,
            inviter_id VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            token VARCHAR(64) UNIQUE NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Migration: Add list_id to items if it doesn't exist
    try {
        await client.query(`ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS list_id INT;`);
    } catch (e) { console.warn("Skipping migration for grocery_list_items", e.message); }

    // Logs (Pantry, Restaurant, Body, Form)
    await client.query(`
        CREATE TABLE IF NOT EXISTS pantry_logs (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            image_base64 TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS restaurant_logs (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            image_base64 TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS body_photos (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            image_base64 TEXT,
            category VARCHAR(50) DEFAULT 'General',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS form_checks (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            exercise VARCHAR(100),
            image_base64 TEXT,
            ai_score INT,
            ai_feedback TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Pulse / Articles (Knowledge Hub)
    // Updated schema support manually added columns (author_id, is_squad_exclusive)
    await client.query(`
        CREATE TABLE IF NOT EXISTS articles (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            summary TEXT,
            content TEXT,
            image_url TEXT,
            author_name VARCHAR(100),
            author_avatar TEXT,
            embedded_actions JSONB DEFAULT '{}',
            author_id INT, 
            is_squad_exclusive BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Seed Data Check for Articles
    const artCount = await client.query('SELECT COUNT(*) FROM articles');
    if (parseInt(artCount.rows[0].count) === 0) {
        const seedArticles = [
            {
                title: "Fix Your Squat Form in 5 Minutes",
                summary: "Knee pain? Back pain? It might be your form. Use our AI analyzer to correct your posture instantly.",
                content: "Squatting is the king of exercises, but doing it wrong causes injury. The most common mistakes are knee valgus (caving in) and rounding the back. Our Vision AI can detect these micro-movements in real-time.",
                image_url: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=800&q=80",
                author_name: "Dr. Squat",
                author_avatar: "bg-emerald-500",
                embedded_actions: { type: 'OPEN_FORM_CHECK', exercise: 'Squat', label: 'Analyze My Squat' }
            },
            {
                title: "Eating for Diabetes & Hypertension",
                summary: "A scientifically backed meal plan strategy to manage blood sugar and pressure simultaneously.",
                content: "Managing comorbidity requires precision. We prioritize low-sodium options to manage blood pressure while strictly controlling glycemic load for insulin sensitivity. This plan uses the Mediterranean framework.",
                image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
                author_name: "Clinical Nutritionist",
                author_avatar: "bg-blue-500",
                embedded_actions: { type: 'GENERATE_MEDICAL_PLAN', conditions: ['Diabetes', 'Hypertension'], cuisine: 'Mediterranean', duration: 'week', label: 'Generate Medical Plan' }
            },
            {
                title: "The Perfect Pan-Seared Steak",
                summary: "Gordon Ramsay style. Butter, garlic, thyme. Simple yet perfect.",
                content: "The maillard reaction is your best friend. Ensure the steak is dry before searing. Basting with butter solids adds the nutty flavor profile essential for a steakhouse quality finish.",
                image_url: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=800&q=80",
                author_name: "Chef Mike",
                author_avatar: "bg-orange-500",
                embedded_actions: { 
                    type: 'OPEN_COOK_MODE', 
                    label: 'Start Cooking', 
                    recipe: { 
                        recipeName: "Perfect Pan-Seared Steak", 
                        description: "Classic butter-basted steak.", 
                        ingredients: [{name: "Ribeye Steak", quantity: "1 (12oz)"}, {name: "Butter", quantity: "2 tbsp"}, {name: "Garlic", quantity: "2 cloves"}, {name: "Thyme", "quantity": "2 sprigs"}], 
                        instructions: ["Pat steak dry with paper towels.", "Season heavily with salt and pepper.", "Heat pan until smoking.", "Add oil and steak. Sear 2 mins.", "Flip, add butter, garlic, thyme.", "Baste for 2 mins.", "Rest for 5 mins."], 
                        nutrition: {totalCalories: 650, totalProtein: 45, totalCarbs: 2, totalFat: 50} 
                    } 
                }
            }
        ];

        for (const art of seedArticles) {
            await client.query(
                `INSERT INTO articles (title, summary, content, image_url, author_name, author_avatar, embedded_actions) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [art.title, art.summary, art.content, art.image_url, art.author_name, art.author_avatar, art.embedded_actions]
            );
        }
    }

    // Health Metrics - Expanded Schema
    await client.query(`
        CREATE TABLE IF NOT EXISTS health_metrics (
            user_id VARCHAR(255) PRIMARY KEY,
            steps INT DEFAULT 0,
            active_calories INT DEFAULT 0,
            resting_calories INT DEFAULT 0,
            distance_miles FLOAT DEFAULT 0,
            flights_climbed INT DEFAULT 0,
            heart_rate INT DEFAULT 0,
            resting_heart_rate INT DEFAULT 0,
            blood_pressure_systolic INT DEFAULT 0,
            blood_pressure_diastolic INT DEFAULT 0,
            weight_lbs FLOAT DEFAULT 0,
            body_fat_percentage FLOAT DEFAULT 0,
            bmi FLOAT DEFAULT 0,
            sleep_score INT DEFAULT 0,
            vo2_max FLOAT DEFAULT 0,
            last_synced TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    // Attempt to add missing columns if table already exists (Migration Logic)
    const addColumnSafe = async (col, type) => {
        try {
            await client.query(`ALTER TABLE health_metrics ADD COLUMN IF NOT EXISTS ${col} ${type};`);
        } catch (e) { console.warn(`Skipping col add ${col}`, e.message); }
    };
    
    await addColumnSafe('resting_heart_rate', 'INT DEFAULT 0');
    await addColumnSafe('blood_pressure_systolic', 'INT DEFAULT 0');
    await addColumnSafe('blood_pressure_diastolic', 'INT DEFAULT 0');
    await addColumnSafe('weight_lbs', 'FLOAT DEFAULT 0');
    await addColumnSafe('body_fat_percentage', 'FLOAT DEFAULT 0');
    await addColumnSafe('bmi', 'FLOAT DEFAULT 0');
    await addColumnSafe('sleep_score', 'INT DEFAULT 0');
    await addColumnSafe('vo2_max', 'FLOAT DEFAULT 0');
};

export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.shopify_customer_id;
    } catch (err) {
        console.error('Error getting shopify customer id:', err);
        return null;
    } finally {
        client.release();
    }
};

// --- Pulse / Articles Accessor ---
// UPDATED: Now supports Squad Locking and Author Details
export const getArticles = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        
        const query = `
            SELECT 
                a.*,
                u.first_name as author_first_name, 
                u.last_name as author_last_name,
                u.id as author_user_id,
                CASE 
                    WHEN f.id IS NOT NULL THEN true 
                    WHEN a.author_id = $1 THEN true -- User is the author
                    ELSE false 
                END as is_squad_member,
                CASE 
                    WHEN a.is_squad_exclusive = true AND 
                         f.id IS NULL AND 
                         (a.author_id IS NOT NULL AND a.author_id != $1) 
                    THEN true 
                    ELSE false 
                END as is_locked
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
            LEFT JOIN friendships f ON 
                ((f.requester_id = $1 AND f.receiver_id = a.author_id) OR 
                 (f.receiver_id = $1 AND f.requester_id = a.author_id)) 
                AND f.status = 'accepted'
            ORDER BY a.created_at DESC
        `;

        const res = await client.query(query, [userId]);
        
        return res.rows.map(row => {
            const content = row.is_locked 
                ? row.content.substring(0, 150) + "..." 
                : row.content;

            return {
                id: row.id,
                title: row.title,
                summary: row.summary,
                content: content,
                image_url: row.image_url,
                author_name: row.author_first_name ? `${row.author_first_name} ${row.author_last_name || ''}`.trim() : row.author_name,
                author_avatar: row.author_avatar,
                author_id: row.author_user_id, 
                embedded_actions: row.embedded_actions,
                is_locked: row.is_locked,
                is_squad_exclusive: row.is_squad_exclusive,
                created_at: row.created_at
            };
        });
    } catch (e) {
        console.error("Error fetching articles:", e);
        return [];
    } finally {
        client.release();
    }
};

// NEW: Create Article for Creators
export const createArticle = async (userId, articleData) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        const { title, summary, content, image_url, embedded_actions, is_squad_exclusive } = articleData;
        
        // Fetch user details for author name
        const userRes = await client.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
        const authorName = userRes.rows[0] ? `${userRes.rows[0].first_name} ${userRes.rows[0].last_name || ''}`.trim() : 'Creator';

        const query = `
            INSERT INTO articles (title, summary, content, image_url, author_name, author_avatar, embedded_actions, author_id, is_squad_exclusive)
            VALUES ($1, $2, $3, $4, $5, 'bg-indigo-600', $6, $7, $8)
            RETURNING id, title, created_at
        `;
        
        const res = await client.query(query, [
            title, 
            summary, 
            content, 
            image_url, 
            authorName, 
            embedded_actions || {}, 
            userId, 
            is_squad_exclusive || false
        ]);
        
        return res.rows[0];
    } catch (e) {
        console.error("Error creating article:", e);
        throw new Error("Failed to publish article");
    } finally {
        client.release();
    }
};

// NEW: Complete Action Endpoint Logic
export const completeArticleAction = async (userId, articleId, actionType) => {
    const client = await pool.connect();
    try {
        // 1. Get Article Author
        const articleRes = await client.query(`SELECT author_id FROM articles WHERE id = $1`, [articleId]);
        if (articleRes.rows.length === 0) throw new Error("Article not found");
        
        const authorId = articleRes.rows[0].author_id;

        // 2. Award Points to User (Engagement)
        await awardPoints(userId, 'user.action_completed', 50, { article_id: articleId, action: actionType });

        // 3. Award Points to Creator (Attribution) - if author exists and isn't self
        if (authorId && authorId != userId) {
            await awardPoints(authorId, 'creator.action_completed', 100, { article_id: articleId, performed_by: userId });
        }

        return { success: true, pointsAwarded: 50 };
    } catch (e) {
        console.error("Error completing action:", e);
        throw e;
    } finally {
        client.release();
    }
};

// --- Rewards Logic ---

export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata)
            VALUES ($1, $2, $3, $4)
        `, [userId, eventType, points, metadata]);

        const updateRes = await client.query(`
            UPDATE rewards_balances
            SET points_total = points_total + $2,
                points_available = points_available + $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING points_total
        `, [userId, points]);
        
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

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64)
            VALUES ($1, $2, $3)
            RETURNING id, meal_data, image_base64, created_at;
        `;
        const res = await client.query(query, [userId, mealData, imageBase64]);
        const row = res.rows[0];
        
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id });

        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        // Return full object on creation so UI updates immediately
        return { 
            id: row.id,
            ...mealDataFromDb,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            hasImage: true,
            createdAt: row.created_at
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
        // OPTIMIZATION: Do NOT select image_base64. Use a CASE statement to determine existence.
        const query = `
            SELECT id, meal_data, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image, created_at 
            FROM meal_log_entries
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return {
                id: row.id,
                ...processMealDataForList(mealData, row.has_image),
                createdAt: row.created_at,
            };
        });
    } catch (err) {
        console.error('Database error in getMealLogEntries:', err);
        throw new Error('Could not retrieve meal history.');
    } finally {
        client.release();
    }
};

export const getMealLogEntryById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return {
            id: row.id,
            ...processMealDataForClient(mealData), // Keeps image
            imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : undefined,
            createdAt: row.created_at,
        };
    } finally {
        client.release();
    }
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
            // Strip the image from the list view
            return { id: row.id, ...processMealDataForList(mealData) };
        });
    } catch (err) {
        console.error('Database error in getSavedMeals:', err);
        throw new Error('Could not retrieve saved meals.');
    } finally {
        client.release();
    }
};

export const getSavedMealById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        // Full data for details view
        return { id: row.id, ...processMealDataForClient(mealData) };
    } finally {
        client.release();
    }
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
                i.id as item_id,
                sm.id as meal_id, sm.meal_data,
                i.metadata
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1
            ORDER BY p.name, i.created_at;
        `;
        const res = await client.query(query, [userId]);
        
        const plans = new Map();
        res.rows.forEach(row => {
            if (!plans.has(row.plan_id)) {
                plans.set(row.plan_id, {
                    id: row.plan_id,
                    name: row.plan_name,
                    items: [],
                });
            }
            if (row.item_id) {
                const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
                plans.get(row.plan_id).items.push({
                    id: row.item_id,
                    meal: {
                        id: row.meal_id,
                        ...processMealDataForList(mealData) // Strip image from plans too
                    },
                    metadata: row.metadata || {}
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
        return { ...res.rows[0], items: [] };
    } catch(err) {
        if (err.code === '23505') {
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
        const checkQuery = `
           SELECT (SELECT user_id FROM meal_plans WHERE id = $1) = $3 AS owns_plan,
                  (SELECT user_id FROM saved_meals WHERE id = $2) = $3 AS owns_meal;
        `;
        const checkRes = await client.query(checkQuery, [planId, savedMealId, userId]);
        if (!checkRes.rows[0] || !checkRes.rows[0].owns_plan || !checkRes.rows[0].owns_meal) {
            throw new Error("Authorization error.");
        }

        const insertQuery = `
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
        const insertRes = await client.query(insertQuery, [userId, planId, savedMealId, metadata]);
        const newItemId = insertRes.rows[0].id;

        const selectQuery = `
            SELECT 
                i.id,
                m.id as meal_id,
                m.meal_data,
                i.metadata
            FROM meal_plan_items i
            JOIN saved_meals m ON i.saved_meal_id = m.id
            WHERE i.id = $1;
        `;
        const selectRes = await client.query(selectQuery, [newItemId]);
        const row = selectRes.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return {
            id: row.id,
            meal: { id: row.meal_id, ...processMealDataForList(mealData) }, // Strip image
            metadata: row.metadata
        };

    } catch (err) {
        console.error('Database error in addMealToPlanItem:', err);
        throw new Error('Could not add meal to plan.');
    } finally {
        client.release();
    }
};


export const addMealAndLinkToPlan = async (userId, mealData, planId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const newMeal = await saveMeal(userId, mealData);
        const newPlanItem = await addMealToPlanItem(userId, planId, newMeal.id);
        await client.query('COMMIT');
        return newPlanItem;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database transaction error in addMealAndLinkToPlan:', err);
        throw new Error('Could not add meal.');
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
        await ensureTables(client);
        
        // If no lists exist, create a default one
        const check = await client.query('SELECT id FROM grocery_lists WHERE user_id = $1 LIMIT 1', [userId]);
        if (check.rows.length === 0) {
            await client.query(`INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, 'Main List', TRUE)`, [userId]);
        }

        const query = `
            SELECT id, name, is_active, created_at 
            FROM grocery_lists 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows;
    } catch (err) {
        console.error('Database error in getGroceryLists:', err);
        throw new Error('Could not retrieve grocery lists.');
    } finally {
        client.release();
    }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, name, checked FROM grocery_list_items 
            WHERE user_id = $1 AND list_id = $2
            ORDER BY name ASC;
        `;
        const res = await client.query(query, [userId, listId]);
        return res.rows;
    } catch (err) {
        console.error('Database error in getGroceryListItems:', err);
        throw new Error('Could not retrieve grocery items.');
    } finally {
        client.release();
    }
};

// Legacy fallback
export const getGroceryList = async (userId) => {
    // Falls back to the first active list if no ID provided
    const lists = await getGroceryLists(userId);
    if (lists.length > 0) return getGroceryListItems(userId, lists[0].id);
    return [];
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        // Set others to inactive first
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`, [userId]);
        
        const query = `
            INSERT INTO grocery_lists (user_id, name, is_active)
            VALUES ($1, $2, TRUE)
            RETURNING id, name, is_active;
        `;
        const res = await client.query(query, [userId, name]);
        return res.rows[0];
    } catch (err) {
        console.error('Database error in createGroceryList:', err);
        throw new Error('Could not create grocery list.');
    } finally {
        client.release();
    }
};

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM grocery_list_items WHERE list_id = $1 AND user_id = $2`, [listId, userId]);
        await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [listId, userId]);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database error in deleteGroceryList:', err);
        throw new Error('Could not delete grocery list.');
    } finally {
        client.release();
    }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO grocery_list_items (user_id, list_id, name, checked)
            VALUES ($1, $2, $3, FALSE)
            RETURNING id, name, checked;
        `;
        const res = await client.query(query, [userId, listId, name]);
        return res.rows[0];
    } catch (err) {
        console.error('Database error in addGroceryItem:', err);
        throw new Error('Could not add grocery item.');
    } finally {
        client.release();
    }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2;`, [itemId, userId]);
    } catch (err) {
        console.error('Database error in removeGroceryItem:', err);
        throw new Error('Could not delete grocery item.');
    } finally {
        client.release();
    }
};

export const generateGroceryList = async (userId, listId, planIds = []) => {
    const client = await pool.connect();
    if (planIds.length === 0) {
        return getGroceryListItems(userId, listId);
    }
    
    try {
        await client.query('BEGIN');
        const mealQuery = `
            SELECT sm.meal_data
            FROM saved_meals sm
            JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
            WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[]);
        `;
        const mealRes = await client.query(mealQuery, [userId, planIds]);
        
        // Extract ingredients
        const allIngredients = mealRes.rows.flatMap(row => {
            const data = row.meal_data;
            if (data && Array.isArray(data.ingredients)) return data.ingredients;
            if (data && data.recipe && Array.isArray(data.recipe.ingredients)) return data.recipe.ingredients;
            return [];
        });
        
        const uniqueIngredientNames = [...new Set(allIngredients.map(ing => ing.name))].sort();
        
        if (uniqueIngredientNames.length > 0) {
             for (const name of uniqueIngredientNames) {
                 // Check dupe in list
                 const check = await client.query(
                     `SELECT id FROM grocery_list_items WHERE user_id = $1 AND list_id = $2 AND name = $3`,
                     [userId, listId, name]
                 );
                 if (check.rows.length === 0) {
                     await client.query(
                         `INSERT INTO grocery_list_items (user_id, list_id, name) VALUES ($1, $2, $3)`, 
                         [userId, listId, name]
                     );
                 }
             }
        }
        await client.query('COMMIT');
        return getGroceryListItems(userId, listId);
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
        return res.rows[0];
    } catch (err) {
        console.error('Database error in updateGroceryListItem:', err);
        throw new Error('Could not update grocery list item.');
    } finally {
        client.release();
    }
};

export const clearGroceryList = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        let query;
        if (type === 'checked') {
            query = `DELETE FROM grocery_list_items WHERE user_id = $1 AND list_id = $2 AND checked = TRUE;`;
        } else if (type === 'all') {
            query = `DELETE FROM grocery_list_items WHERE user_id = $1 AND list_id = $2;`;
        } else {
            throw new Error("Invalid clear type.");
        }
        await client.query(query, [userId, listId]);
    } catch (err) {
        console.error('Database error in clearGroceryList:', err);
        throw new Error('Could not clear grocery list.');
    } finally {
        client.release();
    }
};

// --- Pantry & Restaurant Log Implementation ---

export const getPantryLog = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        // Optimize: Don't send heavy image_base64 in list view
        const query = `
            SELECT id, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image 
            FROM pantry_logs 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(r => ({
            id: r.id,
            created_at: r.created_at,
            hasImage: r.has_image
        }));
    } catch (err) {
        console.error("Error getting pantry log", err);
        return [];
    } finally { 
        client.release(); 
    }
};

export const getPantryLogEntryById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64, created_at FROM pantry_logs WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        return {
            id: res.rows[0].id,
            imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}`,
            created_at: res.rows[0].created_at
        };
    } finally { client.release(); }
};

export const savePantryLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO pantry_logs (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]);
        await awardPoints(userId, 'pantry.scan', 10);
    } finally { client.release(); }
};

export const getRestaurantLog = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        const query = `
            SELECT id, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image 
            FROM restaurant_logs 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(r => ({
            id: r.id,
            created_at: r.created_at,
            hasImage: r.has_image
        }));
    } catch (err) {
        console.error("Error getting restaurant log", err);
        return [];
    } finally { 
        client.release(); 
    }
};

export const getRestaurantLogEntryById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64, created_at FROM restaurant_logs WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        return {
            id: res.rows[0].id,
            imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}`,
            created_at: res.rows[0].created_at
        };
    } finally { client.release(); }
};

export const saveRestaurantLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO restaurant_logs (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]);
        await awardPoints(userId, 'dining.scan', 15);
    } finally { client.release(); }
};

// --- Body Photos Implementation ---

export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        // CRITICAL: Strip image_base64 to comply with 6MB AWS Lambda payload limit
        const query = `
            SELECT id, category, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image 
            FROM body_photos 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(r => ({
            id: r.id,
            category: r.category,
            createdAt: r.created_at,
            hasImage: r.has_image // Boolean flag only, no string
        }));
    } catch (err) {
        console.error("Error getting body photos", err);
        return [];
    } finally { 
        client.release(); 
    }
};

export const uploadBodyPhoto = async (userId, imageBase64, category) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3)`, [userId, imageBase64, category]);
        await awardPoints(userId, 'body.photo', 25);
    } finally { client.release(); }
};

export const getBodyPhotoById = async (id) => {
    const client = await pool.connect();
    try {
        // Only return full base64 data in the detailed ID query
        const res = await client.query(`SELECT id, image_base64, category, created_at FROM body_photos WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        return {
            id: res.rows[0].id,
            imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}`,
            category: res.rows[0].category,
            createdAt: res.rows[0].created_at
        };
    } finally { client.release(); }
};

// --- Form Checks Implementation ---

export const getFormChecks = async (userId, exercise) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        // CRITICAL: Strip image_base64 to comply with 6MB AWS Lambda payload limit
        const query = `
            SELECT id, exercise, ai_score, ai_feedback, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image
            FROM form_checks
            WHERE user_id = $1 AND exercise = $2
            ORDER BY created_at DESC
        `;
        const res = await client.query(query, [userId, exercise]);
        return res.rows.map(r => ({
            id: r.id,
            exercise: r.exercise,
            ai_score: r.ai_score,
            ai_feedback: r.ai_feedback,
            created_at: r.created_at,
            hasImage: r.has_image // Boolean flag only
        }));
    } catch (err) {
        console.error("Error getting form checks", err);
        return [];
    } finally { 
        client.release(); 
    }
};

export const saveFormCheck = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO form_checks (user_id, exercise, image_base64, ai_score, ai_feedback) VALUES ($1, $2, $3, $4, $5)`,
            [userId, data.exercise, data.imageBase64, data.score, data.feedback]
        );
        await awardPoints(userId, 'form.check', 30);
    } finally { client.release(); }
};

export const getFormCheckById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64, exercise, ai_score, ai_feedback, created_at FROM form_checks WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        return {
            id: res.rows[0].id,
            imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}`,
            exercise: res.rows[0].exercise,
            ai_score: res.rows[0].ai_score,
            ai_feedback: res.rows[0].ai_feedback,
            created_at: res.rows[0].created_at
        };
    } finally { client.release(); }
};

/**
 * Friends - Bidirectional logic with correct column names (requester_id, receiver_id)
 */
export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT u.id as "friendId", u.email, u.first_name as "firstName"
            FROM friendships f
            JOIN users u ON (CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END) = u.id
            WHERE (f.requester_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'
        `, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT f.id, u.email
            FROM friendships f
            JOIN users u ON f.requester_id = u.id
            WHERE f.receiver_id = $1 AND f.status = 'pending'
        `, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const sendFriendRequest = async (userId, email) => {
    const client = await pool.connect();
    try {
        const target = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (target.rows.length === 0) throw new Error("User not found");
        await client.query(`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`, [userId, target.rows[0].id]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, requestId, userId]); } finally { client.release(); }
};

export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email, first_name as "firstName", privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateSocialProfile = async (userId, updates) => {
    const client = await pool.connect();
    try {
        const fields = [];
        const values = [];
        if (updates.privacyMode) { fields.push(`privacy_mode = $${values.length + 1}`); values.push(updates.privacyMode); }
        if (updates.bio !== undefined) { fields.push(`bio = $${values.length + 1}`); values.push(updates.bio); }
        if (fields.length === 0) return getSocialProfile(userId);
        values.push(userId);
        await client.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
        return getSocialProfile(userId);
    } finally { client.release(); }
};

// --- Bulk Invite Logic ---

export const processBulkInvites = async (userId, contacts) => {
    const client = await pool.connect();
    try {
        await ensureTables(client); // Ensure invitation table exists
        
        let invitesSent = 0;
        let requestsSent = 0;
        let friendsAdded = 0;
        let pointsAwarded = 0;

        for (const contact of contacts) {
            const email = contact.email.toLowerCase().trim();
            if (email === '') continue;

            // 1. Check if user exists
            const userRes = await client.query(`SELECT id, privacy_mode FROM users WHERE email = $1`, [email]);
            const existingUser = userRes.rows[0];

            if (existingUser) {
                if (existingUser.id === userId) continue; // Skip self

                // Check existing friendship
                const friendRes = await client.query(`
                    SELECT status FROM friendships 
                    WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1)
                `, [userId, existingUser.id]);

                if (friendRes.rows.length === 0) {
                    if (existingUser.privacy_mode === 'public') {
                        // Public: Add as friend (accepted)
                        await client.query(`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'accepted')`, [userId, existingUser.id]);
                        friendsAdded++;
                    } else {
                        // Private: Send Request
                        await client.query(`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'pending')`, [userId, existingUser.id]);
                        requestsSent++;
                    }
                }
            } else {
                // 2. New User - Send Invite
                // Check if invite already exists
                const inviteRes = await client.query(`SELECT id FROM invitations WHERE inviter_id = $1 AND email = $2`, [userId, email]);
                
                if (inviteRes.rows.length === 0) {
                    const token = crypto.randomBytes(16).toString('hex');
                    await client.query(`
                        INSERT INTO invitations (inviter_id, email, name, token)
                        VALUES ($1, $2, $3, $4)
                    `, [userId, email, contact.name, token]);
                    
                    invitesSent++;
                    pointsAwarded += 50;
                    
                    // In real app: Send Email with link: https://embracehealth.ai?invite_token=${token}
                    console.log(`[MOCK EMAIL] To: ${email}, Link: https://main.embracehealth.ai?invite_token=${token}`);
                }
            }
        }

        if (pointsAwarded > 0) {
            await awardPoints(userId, 'referral.invite', pointsAwarded);
        }

        return { invitesSent, requestsSent, friendsAdded, pointsAwarded };

    } catch (e) {
        console.error("Bulk Invite Error:", e);
        throw new Error("Failed to process bulk invites.");
    } finally {
        client.release();
    }
};

// --- Sleep Records ---

export const saveSleepRecord = async (userId, sleepData) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO sleep_records (user_id, duration_minutes, quality_score, start_time, end_time)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, duration_minutes, quality_score, start_time, end_time, created_at;
        `;
        const res = await client.query(query, [
            userId, 
            sleepData.durationMinutes, 
            sleepData.qualityScore || null, 
            sleepData.startTime, 
            sleepData.endTime
        ]);
        
        await awardPoints(userId, 'sleep.tracked', 20);
        const row = res.rows[0];
        return {
            id: row.id,
            durationMinutes: row.duration_minutes,
            qualityScore: row.quality_score,
            startTime: row.start_time,
            endTime: row.end_time,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error('Database error in saveSleepRecord:', err);
        throw new Error('Could not save sleep record.');
    } finally {
        client.release();
    }
};

export const getSleepRecords = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, duration_minutes, quality_score, start_time, end_time, created_at 
            FROM sleep_records 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => ({
            id: row.id,
            durationMinutes: row.duration_minutes,
            qualityScore: row.quality_score,
            startTime: row.start_time,
            endTime: row.end_time,
            createdAt: row.created_at
        }));
    } catch (err) {
        console.error('Database error in getSleepRecords:', err);
        throw new Error('Could not retrieve sleep records.');
    } finally {
        client.release();
    }
};

/**
 * Health & Dashboard Prefs
 */
export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try { 
        // Ensure tables exist before querying
        await ensureTables(client);
        
        const res = await client.query(`
            SELECT 
                steps, 
                active_calories as "activeCalories", 
                resting_calories as "restingCalories", 
                distance_miles as "distanceMiles", 
                flights_climbed as "flightsClimbed", 
                heart_rate as "heartRate", 
                resting_heart_rate as "restingHeartRate",
                blood_pressure_systolic as "bloodPressureSystolic",
                blood_pressure_diastolic as "bloodPressureDiastolic",
                weight_lbs as "weightLbs",
                body_fat_percentage as "bodyFatPercentage",
                bmi as "bmi",
                sleep_score as "sleepScore",
                vo2_max as "vo2Max",
                last_synced as "lastSynced"
            FROM health_metrics WHERE user_id = $1
        `, [userId]);
        return res.rows[0] || { 
            steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, 
            flightsClimbed: 0, heartRate: 0, restingHeartRate: 0,
            bloodPressureSystolic: 0, bloodPressureDiastolic: 0, weightLbs: 0, 
            bodyFatPercentage: 0, bmi: 0, sleepScore: 0, vo2Max: 0
        }; 
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);

        // Normalize keys (handle spaces, snake_case, etc.)
        const normalize = (key) => key.toLowerCase().replace(/[\s_]+/g, '');
        const map = {};
        Object.keys(stats).forEach(k => map[normalize(k)] = stats[k]);

        // Helper to find value from map
        const getVal = (keys) => {
            for (const k of keys) {
                if (map[normalize(k)] !== undefined) return map[normalize(k)];
            }
            return 0;
        };

        // Parse BP String (e.g. "120/80")
        let bpSys = getVal(['bloodPressureSystolic', 'systolic']);
        let bpDia = getVal(['bloodPressureDiastolic', 'diastolic']);
        const bpString = getVal(['bloodPressure', 'bp']);
        if (typeof bpString === 'string' && bpString.includes('/')) {
            const parts = bpString.split('/');
            bpSys = parseInt(parts[0]) || 0;
            bpDia = parseInt(parts[1]) || 0;
        }

        const q = `INSERT INTO health_metrics (
            user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, 
            heart_rate, resting_heart_rate, blood_pressure_systolic, blood_pressure_diastolic,
            weight_lbs, body_fat_percentage, bmi, sleep_score, vo2_max, last_synced
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET 
            steps = GREATEST(health_metrics.steps, EXCLUDED.steps), 
            active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
            resting_calories = GREATEST(health_metrics.resting_calories, EXCLUDED.resting_calories),
            distance_miles = GREATEST(health_metrics.distance_miles, EXCLUDED.distance_miles),
            flights_climbed = GREATEST(health_metrics.flights_climbed, EXCLUDED.flights_climbed),
            heart_rate = CASE WHEN EXCLUDED.heart_rate > 0 THEN EXCLUDED.heart_rate ELSE health_metrics.heart_rate END,
            resting_heart_rate = CASE WHEN EXCLUDED.resting_heart_rate > 0 THEN EXCLUDED.resting_heart_rate ELSE health_metrics.resting_heart_rate END,
            blood_pressure_systolic = CASE WHEN EXCLUDED.blood_pressure_systolic > 0 THEN EXCLUDED.blood_pressure_systolic ELSE health_metrics.blood_pressure_systolic END,
            blood_pressure_diastolic = CASE WHEN EXCLUDED.blood_pressure_diastolic > 0 THEN EXCLUDED.blood_pressure_diastolic ELSE health_metrics.blood_pressure_diastolic END,
            weight_lbs = CASE WHEN EXCLUDED.weight_lbs > 0 THEN EXCLUDED.weight_lbs ELSE health_metrics.weight_lbs END,
            body_fat_percentage = CASE WHEN EXCLUDED.body_fat_percentage > 0 THEN EXCLUDED.body_fat_percentage ELSE health_metrics.body_fat_percentage END,
            bmi = CASE WHEN EXCLUDED.bmi > 0 THEN EXCLUDED.bmi ELSE health_metrics.bmi END,
            sleep_score = CASE WHEN EXCLUDED.sleep_score > 0 THEN EXCLUDED.sleep_score ELSE health_metrics.sleep_score END,
            vo2_max = CASE WHEN EXCLUDED.vo2_max > 0 THEN EXCLUDED.vo2_max ELSE health_metrics.vo2_max END,
            last_synced = CURRENT_TIMESTAMP 
        RETURNING *`;

        const res = await client.query(q, [
            userId, 
            getVal(['steps', 'stepcount']), 
            getVal(['activeCalories', 'activeEnergy']), 
            getVal(['restingCalories', 'restingEnergy']), 
            getVal(['distanceMiles', 'distance']), 
            getVal(['flightsClimbed', 'flights']), 
            getVal(['heartRate', 'hr', 'pulse']), 
            getVal(['restingHeartRate', 'rhr']),
            bpSys, 
            bpDia,
            getVal(['weight', 'weightLbs', 'bodyMass']),
            getVal(['bodyFat', 'bodyFatPercentage']),
            getVal(['bmi', 'bodyMassIndex']),
            getVal(['sleepScore', 'sleepQuality']),
            getVal(['vo2Max', 'cardioFitness'])
        ]);
        
        // Map back to camelCase for frontend
        const r = res.rows[0];
        return {
            steps: r.steps,
            activeCalories: r.active_calories,
            restingCalories: r.resting_calories,
            distanceMiles: r.distance_miles,
            flightsClimbed: r.flights_climbed,
            heartRate: r.heart_rate,
            restingHeartRate: r.resting_heart_rate,
            bloodPressureSystolic: r.blood_pressure_systolic,
            bloodPressureDiastolic: r.blood_pressure_diastolic,
            weightLbs: r.weight_lbs,
            bodyFatPercentage: r.body_fat_percentage,
            bmi: r.bmi,
            sleepScore: r.sleep_score,
            vo2Max: r.vo2_max,
            lastSynced: r.last_synced
        };
    } finally { client.release(); }
};

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try { 
        const res = await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.dashboard_prefs || { selectedWidgets: ['steps', 'activeCalories', 'distanceMiles'] }; 
    } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

// NEW: Intake Data Persistence
export const saveIntakeResponses = async (userId, intakeData) => {
    const client = await pool.connect();
    try {
        // Ensure column exists
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS intake_data JSONB DEFAULT '{}';`);
        
        // Merge with existing data
        const currentRes = await client.query(`SELECT intake_data FROM users WHERE id = $1`, [userId]);
        const currentData = currentRes.rows[0]?.intake_data || {};
        const newData = { ...currentData, ...intakeData };
        
        await client.query(`UPDATE users SET intake_data = $1 WHERE id = $2`, [newData, userId]);
    } catch (err) {
        console.error('Database error in saveIntakeResponses:', err);
        throw new Error('Could not save intake data.');
    } finally {
        client.release();
    }
};

export const getIntakeData = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT intake_data FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.intake_data || {};
    } finally {
        client.release();
    }
};

// --- EXTENSIVE MEDICAL INTAKE (NEW) ---

export const getMedicalIntake = async (userId) => {
    const client = await pool.connect();
    try {
        // Ensure columns exist (Migration logic inline)
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_intake_data JSONB DEFAULT '{}';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_intake_step INT DEFAULT 0;`);

        const res = await client.query(`SELECT medical_intake_data, medical_intake_step FROM users WHERE id = $1`, [userId]);
        const row = res.rows[0] || {};
        return {
            step: row.medical_intake_step || 0,
            data: row.medical_intake_data || {}
        };
    } finally {
        client.release();
    }
};

export const updateMedicalIntake = async (userId, step, answerKey, answerValue, isReset = false) => {
    const client = await pool.connect();
    try {
        // If reset, clear everything
        if (isReset) {
            await client.query(`UPDATE users SET medical_intake_data = '{}', medical_intake_step = 0 WHERE id = $1`, [userId]);
            return { success: true };
        }

        // Standard update: Merge new key/value into JSONB and update step
        // PostgreSQL jsonb_set or || operator for merging
        // We fetch current, merge in JS, save back to be DB-agnostic safe
        const currentRes = await client.query(`SELECT medical_intake_data FROM users WHERE id = $1`, [userId]);
        const currentData = currentRes.rows[0]?.medical_intake_data || {};
        
        // Merge new answer
        if (answerKey) {
            currentData[answerKey] = answerValue;
        }

        await client.query(`
            UPDATE users 
            SET medical_intake_data = $1, medical_intake_step = $2 
            WHERE id = $3
        `, [currentData, step, userId]);

        return { success: true };
    } finally {
        client.release();
    }
};


export const logRecoveryStats = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO sleep_records (user_id, duration_minutes, quality_score)
            VALUES ($1, $2, $3)
        `, [userId, data.sleepMinutes, data.sleepQuality]);
        await awardPoints(userId, 'recovery.logged', 20);
    } finally { client.release(); }
};

export const getAssessments = async () => [
    { id: 'daily-pulse', title: 'Daily Pulse', description: 'Quick check of your mental and physical state.', questions: [{id: 'mood', text: 'How is your mood?', type: 'scale', min: 1, max: 10}] }
];
export const submitAssessment = async (userId, id, resp) => { await awardPoints(userId, 'assessment.complete', 50, { assessmentId: id }); };
export const getPartnerBlueprint = async () => ({ preferences: {} });
export const savePartnerBlueprint = async () => {};
export const getMatches = async () => [];
