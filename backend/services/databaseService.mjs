import pg from 'pg';

// The pg Pool automatically uses environment variables for connection details
// (PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT)
const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false // Required for connecting to many cloud-hosted DBs
    }
});

/**
 * Finds a user by their email or creates a new one if they don't exist.
 * This function assumes your 'users' table has an 'email' column with a UNIQUE constraint.
 * @param {string} email - The customer's email address.
 * @returns {Promise<object>} The user record from the database (including the internal ID and email).
 */
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        // We use a single "upsert" approach to be efficient and safe.
        // 1. First, we try to INSERT the email.
        // 2. If the email already exists, the "ON CONFLICT (email) DO NOTHING"
        //    clause gracefully handles it without throwing an error.
        
        const insertQuery = `
            INSERT INTO users (email) 
            VALUES ($1) 
            ON CONFLICT (email) 
            DO NOTHING;
        `;
        await client.query(insertQuery, [email]);

        // 3. Now that we're certain the user exists (either just created or already there),
        //    we SELECT their record to get their unique 'id' and 'email'.
        const selectQuery = `
            SELECT id, email 
            FROM users 
            WHERE email = $1;
        `;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
            // This case should be extremely rare but is included for robustness.
            throw new Error("Failed to find or create user after insert operation.");
        }

        console.log(`[Database] Successfully found or created user: ${email}`);
        return res.rows[0];

    } catch (err) {
        console.error('Database error in findOrCreateUserByEmail:', err);
        throw new Error('Could not save or retrieve user data from the database.');
    } finally {
        // Ensure the database client is always released back to the pool.
        client.release();
    }
};
