
import pg from 'pg';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendInviteEmail = async (toEmail, token, inviterName) => {
    if (!process.env.SMTP_HOST) {
        console.warn("SMTP_HOST not set. Email skipped. Token:", token);
        return;
    }

    const inviteLink = `https://main.embracehealth.ai?invite_token=${token}`;
    const sender = process.env.SENDER_EMAIL || '"EmbraceHealth" <no-reply@embracehealth.ai>';

    try {
        await transporter.sendMail({
            from: sender,
            to: toEmail,
            subject: `${inviterName || 'A friend'} invited you to EmbraceHealth`,
            text: `You have been invited to join EmbraceHealth! Use this link to get started: ${inviteLink}`,
            html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; padding: 20px;">
                        <h2 style="color: #10b981;">You're Invited!</h2>
                        <p style="font-size: 16px;">${inviterName || 'A friend'} wants to connect with you on EmbraceHealth to track nutrition and fitness goals together.</p>
                        <br/>
                        <a href="${inviteLink}" style="display: inline-block; padding: 14px 28px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Accept Invitation</a>
                        <br/><br/>
                        <p style="font-size: 12px; color: #666;">Or copy this link into your browser:</p>
                        <p style="font-size: 12px; color: #666; word-break: break-all;">${inviteLink}</p>
                    </div>
                </div>
            `
        });
        console.log(`Email sent to ${toEmail}`);
    } catch (error) {
        console.error(`Failed to send email to ${toEmail}:`, error);
    }
};

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

// Helper to strip image data for list views to prevent payload limits
const processMealDataForList = (mealData, externalHasImage = false) => {
    const dataForList = { ...mealData };
    const hasImage = externalHasImage || !!dataForList.imageBase64 || !!dataForList.imageUrl;
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

        await ensureTables(client);
        
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING;
        `, [user.id]);

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
        const invRes = await client.query(`SELECT id, inviter_id, status FROM invitations WHERE token = $1`, [code]);
        if (invRes.rows.length === 0) return; 
        
        const invite = invRes.rows[0];
        if (invite.status === 'joined') return; 

        await client.query(`UPDATE invitations SET status = 'joined' WHERE id = $1`, [invite.id]);

        await client.query(`
            INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata)
            VALUES ($1, 'referral.join', 450, $2)
        `, [invite.inviter_id, JSON.stringify({ new_user_id: newUserId })]);

        await client.query(`
            UPDATE rewards_balances
            SET points_total = points_total + 450, points_available = points_available + 450
            WHERE user_id = $1
        `, [invite.inviter_id]);

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
        CREATE TABLE IF NOT EXISTS friendships (
            id SERIAL PRIMARY KEY,
            requester_id VARCHAR(255) NOT NULL,
            receiver_id VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(requester_id, receiver_id)
        );
    `);

    // User Column Migrations
    try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_mode VARCHAR(50) DEFAULT 'private'`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`);
        
        // Fitbit Credentials
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_access_token TEXT`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_refresh_token TEXT`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_token_expires TIMESTAMPTZ`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_user_id VARCHAR(255)`);
    } catch (e) { console.warn("User column migration skipped", e.message); }

    try {
        await client.query(`ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS list_id INT;`);
    } catch (e) { console.warn("Skipping migration for grocery_list_items", e.message); }

    // Logs
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

    // Articles
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

    try {
        await client.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id INT`);
        await client.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_squad_exclusive BOOLEAN DEFAULT FALSE`);
    } catch (e) { console.warn("Article column migration skipped", e.message); }

    // Health Metrics
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

export const updateFitbitCredentials = async (userId, data) => {
    const client = await pool.connect();
    try {
        const query = `
            UPDATE users 
            SET fitbit_access_token = $1, 
                fitbit_refresh_token = $2, 
                fitbit_token_expires = $3,
                fitbit_user_id = $4
            WHERE id = $5
        `;
        const expiresAt = new Date(Date.now() + data.expires_in * 1000);
        await client.query(query, [data.access_token, data.refresh_token, expiresAt, data.user_id, userId]);
    } finally {
        client.release();
    }
};

export const getFitbitCredentials = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT fitbit_access_token, fitbit_refresh_token, fitbit_token_expires, fitbit_user_id FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally {
        client.release();
    }
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
                    WHEN a.author_id = $1 THEN true 
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
        return res.rows.map(row => ({
            id: row.id,
            title: row.title,
            summary: row.summary,
            content: row.is_locked ? row.content.substring(0, 150) + "..." : row.content,
            image_url: row.image_url,
            author_name: row.author_first_name ? `${row.author_first_name} ${row.author_last_name || ''}`.trim() : row.author_name,
            author_avatar: row.author_avatar,
            author_id: row.author_user_id, 
            embedded_actions: row.embedded_actions,
            is_locked: row.is_locked,
            is_squad_exclusive: row.is_squad_exclusive,
            created_at: row.created_at
        }));
    } finally {
        client.release();
    }
};

export const createArticle = async (userId, articleData) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        const { title, summary, content, image_url, embedded_actions, is_squad_exclusive } = articleData;
        const userRes = await client.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
        const authorName = userRes.rows[0] ? `${userRes.rows[0].first_name} ${userRes.rows[0].last_name || ''}`.trim() : 'Creator';
        const query = `
            INSERT INTO articles (title, summary, content, image_url, author_name, author_avatar, embedded_actions, author_id, is_squad_exclusive)
            VALUES ($1, $2, $3, $4, $5, 'bg-indigo-600', $6, $7, $8)
            RETURNING id, title, created_at
        `;
        const res = await client.query(query, [title, summary, content, image_url, authorName, embedded_actions || {}, userId, is_squad_exclusive || false]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const completeArticleAction = async (userId, articleId, actionType) => {
    const client = await pool.connect();
    try {
        const articleRes = await client.query(`SELECT author_id FROM articles WHERE id = $1`, [articleId]);
        if (articleRes.rows.length === 0) throw new Error("Article not found");
        const authorId = articleRes.rows[0].author_id;
        await awardPoints(userId, 'user.action_completed', 50, { article_id: articleId, action: actionType });
        if (authorId && authorId != userId) {
            await awardPoints(authorId, 'creator.action_completed', 100, { article_id: articleId, performed_by: userId });
        }
        return { success: true, pointsAwarded: 50 };
    } finally {
        client.release();
    }
};

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
        await client.query(`UPDATE rewards_balances SET tier = $2 WHERE user_id = $1`, [userId, newTier]);
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
        const balanceRes = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const historyRes = await client.query(`SELECT entry_id, event_type, points_delta, created_at, metadata FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
        const balance = balanceRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };
        return { ...balance, history: historyRes.rows };
    } finally {
        client.release();
    }
};

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
        return { 
            id: row.id,
            ...mealDataFromDb,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            hasImage: true,
            createdAt: row.created_at
        };
    } finally {
        client.release();
    }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, meal_data, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image, created_at 
            FROM meal_log_entries
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return { id: row.id, ...processMealDataForList(mealData, row.has_image), createdAt: row.created_at };
        });
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
        return { id: row.id, ...processMealDataForClient(mealData), createdAt: row.created_at };
    } finally {
        client.release();
    }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `SELECT id, meal_data FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC;`;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return { id: row.id, ...processMealDataForList(mealData) };
        });
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
    } finally {
        client.release();
    }
};

export const deleteMeal = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2;`, [mealId, userId]);
    } finally {
        client.release();
    }
};

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT p.id as plan_id, p.name as plan_name, i.id as item_id, sm.id as meal_id, sm.meal_data, i.metadata
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
                plans.set(row.plan_id, { id: row.plan_id, name: row.plan_name, items: [] });
            }
            if (row.item_id) {
                const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
                plans.get(row.plan_id).items.push({ id: row.item_id, meal: { id: row.meal_id, ...processMealDataForList(mealData) }, metadata: row.metadata || {} });
            }
        });
        return Array.from(plans.values());
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
        if (err.code === '23505') throw new Error(`A meal plan with the name "${name}" already exists.`);
        throw err;
    } finally {
        client.release();
    }
};

export const generateGroceryList = async (userId, listId, planIds = []) => {
    const client = await pool.connect();
    if (planIds.length === 0) return [];
    
    try {
        await client.query('BEGIN');
        const mealQuery = `
            SELECT sm.meal_data
            FROM saved_meals sm
            JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
            WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[]);
        `;
        const mealRes = await client.query(mealQuery, [userId, planIds]);
        const allIngredients = mealRes.rows.flatMap(row => row.meal_data?.ingredients || []);
        const uniqueIngredientNames = [...new Set(allIngredients.map(ing => ing.name))].sort();
        
        const results = [];
        for (const name of uniqueIngredientNames) {
            const insertQuery = `INSERT INTO grocery_list_items (user_id, list_id, name, checked) VALUES ($1, $2, $3, FALSE) RETURNING id, name, checked;`;
            const res = await client.query(insertQuery, [userId, listId, name]);
            results.push(res.rows[0]);
        }
        
        await client.query('COMMIT');
        return results;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const addMealToPlanItem = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try {
        const insertQuery = `INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id;`;
        const insertRes = await client.query(insertQuery, [userId, planId, savedMealId, metadata]);
        const newItemId = insertRes.rows[0].id;
        const selectQuery = `SELECT i.id, m.id as meal_id, m.meal_data, i.metadata FROM meal_plan_items i JOIN saved_meals m ON i.saved_meal_id = m.id WHERE i.id = $1;`;
        const selectRes = await client.query(selectQuery, [newItemId]);
        const row = selectRes.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { id: row.id, meal: { id: row.meal_id, ...processMealDataForList(mealData) }, metadata: row.metadata };
    } finally {
        client.release();
    }
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2;`, [planItemId, userId]);
    } finally {
        client.release();
    }
};

export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        const query = `SELECT id, name, is_active, created_at FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC;`;
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally {
        client.release();
    }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const query = `SELECT id, name, checked FROM grocery_list_items WHERE user_id = $1 AND list_id = $2 ORDER BY name ASC;`;
        const res = await client.query(query, [userId, listId]);
        return res.rows;
    } finally {
        client.release();
    }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`, [userId]);
        const query = `INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, TRUE) RETURNING id, name, is_active;`;
        const res = await client.query(query, [userId, name]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const query = `INSERT INTO grocery_list_items (user_id, list_id, name, checked) VALUES ($1, $2, $3, FALSE) RETURNING id, name, checked;`;
        const res = await client.query(query, [userId, listId, name]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2;`, [itemId, userId]);
    } finally {
        client.release();
    }
};

export const updateGroceryListItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const query = `UPDATE grocery_list_items SET checked = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, checked;`;
        const res = await client.query(query, [checked, itemId, userId]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const clearGroceryList = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        const query = type === 'checked' 
            ? `DELETE FROM grocery_list_items WHERE user_id = $1 AND list_id = $2 AND checked = TRUE;`
            : `DELETE FROM grocery_list_items WHERE user_id = $1 AND list_id = $2;`;
        await client.query(query, [userId, listId]);
    } finally {
        client.release();
    }
};

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try { 
        await ensureTables(client);
        const res = await client.query(`
            SELECT steps, active_calories as "activeCalories", resting_calories as "restingCalories", distance_miles as "distanceMiles", flights_climbed as "flightsClimbed", heart_rate as "heartRate", resting_heart_rate as "restingHeartRate", blood_pressure_systolic as "bloodPressureSystolic", blood_pressure_diastolic as "bloodPressureDiastolic", weight_lbs as "weightLbs", body_fat_percentage as "bodyFatPercentage", bmi as "bmi", sleep_score as "sleepScore", vo2_max as "vo2Max", last_synced as "lastSynced"
            FROM health_metrics WHERE user_id = $1
        `, [userId]);
        return res.rows[0] || { 
            steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, flightsClimbed: 0, heartRate: 0, restingHeartRate: 0,
            bloodPressureSystolic: 0, bloodPressureDiastolic: 0, weightLbs: 0, bodyFatPercentage: 0, bmi: 0, sleepScore: 0, vo2Max: 0
        }; 
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        const normalize = (key) => key.toLowerCase().replace(/[\s_]+/g, '');
        const map = {};
        Object.keys(stats).forEach(k => map[normalize(k)] = stats[k]);
        const getVal = (keys, fallback = 0) => {
            for (const k of keys) { if (map[normalize(k)] !== undefined) return map[normalize(k)]; }
            return fallback;
        };

        const bpString = getVal(['bloodPressure', 'bp'], null);
        let bpSys = getVal(['bloodPressureSystolic', 'systolic'], 0);
        let bpDia = getVal(['bloodPressureDiastolic', 'diastolic'], 0);
        if (typeof bpString === 'string' && bpString.includes('/')) {
            const parts = bpString.split('/');
            bpSys = parseInt(parts[0]) || 0;
            bpDia = parseInt(parts[1]) || 0;
        }

        const q = `INSERT INTO health_metrics (user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, heart_rate, resting_heart_rate, blood_pressure_systolic, blood_pressure_diastolic, weight_lbs, body_fat_percentage, bmi, sleep_score, vo2_max, last_synced)
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
                        last_synced = CURRENT_TIMESTAMP RETURNING *`;
        const res = await client.query(q, [userId, getVal(['steps']), getVal(['activeCalories']), getVal(['restingCalories']), getVal(['distanceMiles']), getVal(['flightsClimbed']), getVal(['heartRate']), getVal(['restingHeartRate']), bpSys, bpDia, getVal(['weightLbs']), getVal(['bodyFatPercentage']), getVal(['bmi']), getVal(['sleepScore']), getVal(['vo2Max'])]);
        const r = res.rows[0];
        return { steps: r.steps, activeCalories: r.active_calories, restingCalories: r.resting_calories, distanceMiles: r.distance_miles, flightsClimbed: r.flights_climbed, heartRate: r.heart_rate, restingHeartRate: r.resting_heart_rate, bloodPressureSystolic: r.blood_pressure_systolic, bloodPressureDiastolic: r.blood_pressure_diastolic, weightLbs: r.weight_lbs, bodyFatPercentage: r.body_fat_percentage, bmi: r.bmi, sleepScore: r.sleep_score, vo2Max: r.vo2_max, lastSynced: r.last_synced };
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

export const getMedicalIntake = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_intake_data JSONB DEFAULT '{}';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_intake_step INT DEFAULT 0;`);
        const res = await client.query(`SELECT medical_intake_data, medical_intake_step FROM users WHERE id = $1`, [userId]);
        const row = res.rows[0] || {};
        return { step: row.medical_intake_step || 0, data: row.medical_intake_data || {} };
    } finally { client.release(); }
};

export const updateMedicalIntake = async (userId, step, answerKey, answerValue, isReset = false) => {
    const client = await pool.connect();
    try {
        if (isReset) {
            await client.query(`UPDATE users SET medical_intake_data = '{}', medical_intake_step = 0 WHERE id = $1`, [userId]);
            return { success: true };
        }
        const currentRes = await client.query(`SELECT medical_intake_data FROM users WHERE id = $1`, [userId]);
        const currentData = currentRes.rows[0]?.medical_intake_data || {};
        if (answerKey) currentData[answerKey] = answerValue;
        await client.query(`UPDATE users SET medical_intake_data = $1, medical_intake_step = $2 WHERE id = $3`, [currentData, step, userId]);
        return { success: true };
    } finally { client.release(); }
};

export const saveUserIntake = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`
            UPDATE users 
            SET medical_intake_data = medical_intake_data || $1::jsonb
            WHERE id = $2
        `, [JSON.stringify(data), userId]);
    } finally {
        client.release();
    }
};

export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT u.id as "friendId", u.email, u.first_name as "firstName" FROM friendships f JOIN users u ON (CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END) = u.id WHERE (f.requester_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email, first_name as "firstName", privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT f.id, u.email FROM friendships f JOIN users u ON f.requester_id = u.id WHERE f.receiver_id = $1 AND f.status = 'pending'`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        const query = `SELECT id, category, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC`;
        const res = await client.query(query, [userId]);
        return res.rows.map(r => ({ id: r.id, category: r.category, createdAt: r.created_at, hasImage: r.has_image }));
    } finally { client.release(); }
};

export const getBodyPhotoById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64, category, created_at FROM body_photos WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        return { id: res.rows[0].id, imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}`, category: res.rows[0].category, createdAt: res.rows[0].created_at };
    } finally { client.release(); }
};

export const uploadBodyPhoto = async (userId, imageBase64, category) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3)`, [userId, imageBase64, category]);
        await awardPoints(userId, 'body.photo', 25);
    } finally { client.release(); }
};

export const getPantryLog = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        const query = `SELECT id, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image FROM pantry_logs WHERE user_id = $1 ORDER BY created_at DESC`;
        const res = await client.query(query, [userId]);
        return res.rows.map(r => ({ id: r.id, created_at: r.created_at, hasImage: r.has_image }));
    } finally { client.release(); }
};

export const savePantryLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO pantry_logs (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]);
        await awardPoints(userId, 'pantry.scan', 10);
    } finally { client.release(); }
};

export const getPantryLogEntryById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64, created_at FROM pantry_logs WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        return { id: res.rows[0].id, imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}`, created_at: res.rows[0].created_at };
    } finally { client.release(); }
};

export const getRestaurantLog = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        const query = `SELECT id, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image FROM restaurant_logs WHERE user_id = $1 ORDER BY created_at DESC`;
        const res = await client.query(query, [userId]);
        return res.rows.map(r => ({ id: r.id, created_at: r.created_at, hasImage: r.has_image }));
    } finally { client.release(); }
};

export const saveRestaurantLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO restaurant_logs (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]);
        await awardPoints(userId, 'dining.scan', 15);
    } finally { client.release(); }
};

export const getRestaurantLogEntryById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64, created_at FROM restaurant_logs WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        return { id: res.rows[0].id, imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}`, created_at: res.rows[0].created_at };
    } finally { client.release(); }
};

export const getFormChecks = async (userId, exercise) => {
    const client = await pool.connect();
    try {
        await ensureTables(client);
        const query = `SELECT id, exercise, ai_score, ai_feedback, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image FROM form_checks WHERE user_id = $1 AND exercise = $2 ORDER BY created_at DESC`;
        const res = await client.query(query, [userId, exercise]);
        return res.rows.map(r => ({ id: r.id, exercise: r.exercise, ai_score: r.ai_score, ai_feedback: r.ai_feedback, created_at: r.created_at, hasImage: r.has_image }));
    } finally { client.release(); }
};

export const getFormCheckById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64, exercise, ai_score, ai_feedback, created_at FROM form_checks WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        return { id: res.rows[0].id, imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}`, exercise: res.rows[0].exercise, ai_score: res.rows[0].ai_score, ai_feedback: res.rows[0].ai_feedback, created_at: res.rows[0].created_at };
    } finally { client.release(); }
};

export const saveFormCheck = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO form_checks (user_id, exercise, image_base64, ai_score, ai_feedback) VALUES ($1, $2, $3, $4, $5)`, [userId, data.exercise, data.imageBase64, data.score, data.feedback]);
        await awardPoints(userId, 'form.check', 30);
    } finally { client.release(); }
};

export const getCoachingRelations = async (userId, role) => {
    const client = await pool.connect();
    try {
        const query = role === 'coach' 
            ? `SELECT c.*, u.email as "clientEmail", u.first_name as "clientName" FROM coaching_relations c JOIN users u ON c.client_id = u.id WHERE c.coach_id = $1`
            : `SELECT c.*, u.email as "coachEmail", u.first_name as "coachName" FROM coaching_relations c JOIN users u ON c.coach_id = u.id WHERE c.client_id = $1`;
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const inviteClient = async (userId, email) => {
    const client = await pool.connect();
    try {
        const target = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (target.rows.length === 0) throw new Error("User not found");
        await client.query(`INSERT INTO coaching_relations (coach_id, client_id, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`, [userId, target.rows[0].id]);
    } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, id, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE coaching_relations SET status = $1 WHERE id = $2 AND client_id = $3`, [status, id, userId]); } finally { client.release(); }
};

export const revokeCoachingAccess = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM coaching_relations WHERE id = $1 AND (coach_id = $2 OR client_id = $2)`, [id, userId]); } finally { client.release(); }
};
