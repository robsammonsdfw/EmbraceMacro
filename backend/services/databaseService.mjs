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
 * Finds a user by their email address or creates a new one if they don't exist.
 * This is used to provision a user in our system after they successfully log in
 * via Shopify's Customer Authentication.
 * @param {string} email - The customer's email address.
 * @returns {Promise<object>} The user record from the database (including the internal ID and email).
 */
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Attempt to insert the user. If their email already exists, do nothing.
        // This prevents race conditions where two simultaneous login attempts could
        // try to create the same user.
        await client.query(
            'INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
            [email]
        );

        // Now, whether the user was just inserted or already existed, we can safely
        // select their record to get their internal ID.
        const res = await client.query(
            'SELECT id, email FROM users WHERE email = $1',
            [email]
        );
        
        await client.query('COMMIT');

        console.log(`Successfully found or created user for email: ${email}`);
        if (res.rows.length === 0) {
            throw new Error('User was not found after upsert operation.');
        }
        return res.rows[0];

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database error in findOrCreateUserByEmail:', err);
        throw new Error('Could not save or retrieve user data from the database.');
    } finally {
        client.release();
    }
};

// You can add more database functions here as your app grows.
// For example:
// export const getSavedMeals = async (userId) => { ... }
// export const saveMeal = async (userId, mealData) => { ... }