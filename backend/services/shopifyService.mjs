
import * as db from './databaseService.mjs';

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL; // e.g. your-store.myshopify.com
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_KEY;

export const fetchCustomerOrders = async (userId) => {
    // 1. Get the Shopify Customer ID associated with this local user
    const shopifyCustomerId = await db.getShopifyCustomerId(userId);

    if (!shopifyCustomerId) {
        console.log(`No Shopify ID found for user ${userId}`);
        return []; 
    }

    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
        console.error("Shopify env vars missing");
        throw new Error("Server configuration error: Missing Shopify Credentials");
    }

    try {
        // 2. Call Shopify Admin API to get orders for this specific customer
        const url = `https://${SHOPIFY_STORE_URL}/admin/api/2024-01/customers/${shopifyCustomerId}/orders.json?status=any`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Shopify API Error:", response.status, errText);
            throw new Error(`Shopify API error: ${response.status}`);
        }

        const data = await response.json();
        
        // 3. Map the data to a clean format for the frontend
        return data.orders.map(order => ({
            id: order.id.toString(),
            orderNumber: order.order_number,
            date: order.created_at,
            total: order.total_price,
            status: order.fulfillment_status ? order.fulfillment_status.toUpperCase() : 'UNFULFILLED',
            paymentStatus: order.financial_status ? order.financial_status.toUpperCase() : 'PENDING',
            items: order.line_items.map(item => ({
                title: item.title,
                quantity: item.quantity,
                price: item.price
            }))
        }));

    } catch (error) {
        console.error("Error fetching Shopify orders:", error);
        throw error;
    }
};
