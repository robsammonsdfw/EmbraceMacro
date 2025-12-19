
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

/**
 * Health Metrics Logic
 * Aggregates data from multiple sources (Apple/Fitbit).
 * Keeps the GREATEST value for each metric as per requirement.
 */
export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO health_metrics (
                user_id, steps, active_calories, resting_calories, 
                distance_miles, flights_climbed, heart_rate, hrv, sleep_minutes, last_synced
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                steps = GREATEST(health_metrics.steps, EXCLUDED.steps),
                active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
                resting_calories = GREATEST(health_metrics.resting_calories, EXCLUDED.resting_calories),
                distance_miles = GREATEST(health_metrics.distance_miles, EXCLUDED.distance_miles),
                flights_climbed = GREATEST(health_metrics.flights_climbed, EXCLUDED.flights_climbed),
                heart_rate = EXCLUDED.heart_rate, -- HR is usually latest
                hrv = EXCLUDED.hrv,
                sleep_minutes = GREATEST(health_metrics.sleep_minutes, EXCLUDED.sleep_minutes),
                last_synced = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const res = await client.query(query, [
            userId, stats.steps, stats.activeCalories, stats.restingCalories,
            stats.distanceMiles, stats.flightsClimbed, stats.heartRate, 
            stats.hrv || 0, stats.sleepMinutes || 0
        ]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || null;
    } finally {
        client.release();
    }
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
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    // Minimal mock for points awarding
    console.log(`Awarding ${points} points to ${userId} for ${eventType}`);
};

export const getRewardsSummary = async (userId) => {
    return { points_total: 0, points_available: 0, tier: 'Bronze', history: [] };
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
        return { 
            id: row.id,
            ...row.meal_data,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at
        };
    } finally {
        client.release();
    }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `SELECT * FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC;`;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => ({
            id: row.id,
            ...row.meal_data,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at
        }));
    } finally {
        client.release();
    }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const query = `SELECT * FROM meal_log_entries WHERE id = $1 AND user_id = $2;`;
        const res = await client.query(query, [id, userId]);
        if (res.rows[0]) {
            const row = res.rows[0];
            return {
                id: row.id,
                ...row.meal_data,
                imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
                createdAt: row.created_at
            };
        }
        return null;
    } finally {
        client.release();
    }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `SELECT * FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC;`;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => ({ id: row.id, ...processMealDataForClient(row.meal_data) }));
    } finally {
        client.release();
    }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const query = `SELECT * FROM saved_meals WHERE id = $1 AND user_id = $2;`;
        const res = await client.query(query, [id, userId]);
        return res.rows[0] ? { id: res.rows[0].id, ...processMealDataForClient(res.rows[0].meal_data) } : null;
    } finally {
        client.release();
    }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const query = `INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id, meal_data;`;
        const res = await client.query(query, [userId, processMealDataForSave(mealData)]);
        return { id: res.rows[0].id, ...processMealDataForClient(res.rows[0].meal_data) };
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

export const updateMealVisibility = async (userId, mealId, visibility) => {
    // Mock
};

export const getMealPlans = async (userId) => {
    return [];
};

export const createMealPlan = async (userId, name) => {
    return { id: Math.random(), name, items: [] };
};

export const deleteMealPlan = async (userId, planId) => {
    // Delete logic
};

export const addMealToPlanItem = async (userId, planId, savedMealId, metadata) => {
    // Link logic
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    // Remove link logic
};

export const updatePlanVisibility = async (userId, planId, visibility) => {
    // Mock
};

export const getGroceryLists = async (userId) => {
    return [];
};

export const getGroceryListItems = async (userId, listId) => {
    return [];
};

export const createGroceryList = async (userId, name) => {
    return { id: Math.random(), name, is_active: false };
};

export const setActiveGroceryList = async (userId, listId) => {
    // Update active state
};

export const deleteGroceryList = async (userId, listId) => {
    // Delete logic
};

export const updateGroceryListItem = async (userId, itemId, checked) => {
    // Toggle check
};

export const addGroceryItem = async (userId, listId, name) => {
    return { id: Math.random(), name, checked: false };
};

export const removeGroceryItem = async (userId, itemId) => {
    // Remove logic
};

export const clearGroceryListItems = async (userId, listId, type) => {
    // Clear logic
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    return [];
};

export const getSocialProfile = async (userId) => {
    return { privacyMode: 'private' };
};

export const updateSocialProfile = async (userId, updates) => {
    return { ...updates };
};

export const getFriends = async (userId) => {
    return [];
};

export const getFriendRequests = async (userId) => {
    return [];
};

export const sendFriendRequest = async (userId, email) => {
    // Request logic
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    // Respond logic
};

export const getAssessments = async () => {
    return [];
};

export const submitAssessment = async (userId, assessmentId, responses) => {
    // Submit logic
};

export const getPartnerBlueprint = async (userId) => {
    return { preferences: {} };
};

export const savePartnerBlueprint = async (userId, blueprint) => {
    // Save logic
};

export const getMatches = async (userId) => {
    return [];
};
