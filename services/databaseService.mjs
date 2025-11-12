import pg from 'pg';

// The pg Client automatically uses environment variables for connection details.
// Make sure you have set these in your Lambda configuration:
// PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false // Required for connecting to many cloud-hosted DBs like RDS
    }
});

/**
 * Finds a user by their Shopify shop name or creates a new one if they don't exist.
 * Saves or updates their permanent Shopify access token.
 * @param {string} shop - The shop name (e.g., 'my-store.myshopify.com').
 * @param {string} accessToken - The permanent access token from Shopify.
 * @returns {Promise<object>} The user record from the database (including the internal ID).
 */
export const findOrCreateUser = async (shop, accessToken) => {
    const client = await pool.connect();
    try {
        // Use an "upsert" query: INSERT if not exists, UPDATE if it does.
        const query = `
            INSERT INTO users (shop, shopify_access_token)
            VALUES ($1, $2)
            ON CONFLICT (shop) 
            DO UPDATE SET shopify_access_token = EXCLUDED.shopify_access_token
            RETURNING id, shop;
        `;
        const values = [shop, accessToken];
        const res = await client.query(query, values);

        console.log(`Successfully upserted user for shop: ${shop}`);
        return res.rows[0];

    } catch (err) {
        console.error('Database error in findOrCreateUser:', err);
        throw new Error('Could not save user data to the database.');
    } finally {
        client.release();
    }
};

// You can add more database functions here as your app grows.
// For example:
// export const getSavedMeals = async (userId) => { ... }
// export const saveMeal = async (userId, mealData) => { ... }
