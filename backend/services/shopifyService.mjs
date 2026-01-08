
import * as db from './databaseService.mjs';

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL; // e.g., my-store.myshopify.com
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_KEY;

export const fetchCustomerOrders = async (userId) => {
    const shopifyCustomerId = await db.getShopifyCustomerId(userId);

    if (!shopifyCustomerId) {
        return []; 
    }

    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
        console.error("Shopify env vars missing");
        throw new Error("Server configuration error");
    }

    try {
        const response = await fetch(`https://${SHOPIFY_STORE_URL}/admin/api/2024-01/customers/${shopifyCustomerId}/orders.json?status=any`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
            }
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Shopify API Error:", err);
            throw new Error(`Shopify API error: ${response.status}`);
        }

        const data = await response.json();
        
        return data.orders.map(order => ({
            id: order.id.toString(),
            orderNumber: order.order_number,
            date: order.created_at,
            total: order.total_price,
            status: order.fulfillment_status ? order.fulfillment_status.toUpperCase() : 'UNFULFILLED',
            paymentStatus: order.financial_status ? order.financial_status.toUpperCase() : 'PENDING',
            items: order.line_items.map(item => ({
                title: item.title,
                quantity: item.quantity
            }))
        }));

    } catch (error) {
        console.error("Error fetching Shopify orders:", error);
        throw error;
    }
};
