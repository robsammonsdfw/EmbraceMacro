
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

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

const processMealDataForClient = (mealData) => {
    const dataForClient = { ...mealData };
    if (dataForClient.imageBase64) {
        dataForClient.imageUrl = `data:image/jpeg;base64,${dataForClient.imageBase64}`;
        delete dataForClient.imageBase64;
    }
    return dataForClient;
};

// Fix findOrCreateUserByEmail signature (ensuring it matches the single-argument call)
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [email]);
        const res = await client.query(`SELECT id, email, privacy_mode, bio FROM users WHERE email = $1`, [email]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

// --- Social & Friends (Database Driven) ---

export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email, privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateSocialProfile = async (userId, data) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE users SET privacy_mode = COALESCE($1, privacy_mode), bio = COALESCE($2, bio) WHERE id = $3 RETURNING id`, [data.privacyMode, data.bio, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT u.id as "friendId", u.email, u.privacy_mode, f.status, u.bio
            FROM friendships f
            JOIN users u ON (u.id = CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END)
            WHERE (f.requester_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => ({
            ...row,
            firstName: row.email.split('@')[0].split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
        }));
    } finally { client.release(); }
};

export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT f.id, u.email, u.id as "requesterId"
            FROM friendships f
            JOIN users u ON f.requester_