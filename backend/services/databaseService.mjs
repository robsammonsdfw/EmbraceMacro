export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, checked FROM grocery_list_items WHERE grocery_list_id = $1 ORDER BY name`, [listId]);
        return res.rows;
    } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name, proxyId) => {
    const targetId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_list_items (grocery_list_id, name, user_id) VALUES ($1, $2, $3) RETURNING id, name, checked`, [listId, name, targetId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING id, name, checked`, [checked, itemId]);
        return res.rows[0];
    } finally { client.release(); }
};