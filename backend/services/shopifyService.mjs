
import * as db from './databaseService.mjs';

// Updated to match the specific environment variables from your configuration
const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_URL;

// STRICT: Use the Admin API Key for server-side operations (Orders, Customers)
// The Storefront token is for client-side interactions only.
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_KEY;

export const fetchCustomerOrders = async (userId) => {
    // 1. Validate Credentials
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_TOKEN) {
        const errorMsg = "Server configuration error: Missing Shopify Admin Credentials (SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_KEY)";
        console.error(errorMsg, { 
            hasDomain: !!SHOPIFY_DOMAIN, 
            hasToken: !!SHOPIFY_ADMIN_TOKEN 
        });
        throw new Error(errorMsg);
    }

    // 2. Get the Shopify Customer ID associated with this user
    const shopifyCustomerId = await db.getShopifyCustomerId(userId);

    if (!shopifyCustomerId) {
        // If the user hasn't been linked to a Shopify Customer ID yet, return empty list.
        return []; 
    }

    try {
        // 3. Call Shopify Admin API to get orders
        // Note: Admin API version 2024-01
        const url = `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/customers/${shopifyCustomerId}/orders.json?status=any`;
        
        console.log(`Fetching orders from: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN // Must use Admin Token here
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Shopify API Error (${response.status}):`, errText);
            
            if (response.status === 401) {
                throw new Error("Shopify Unauthorized (401). Check SHOPIFY_ADMIN_API_KEY permissions.");
            }
            throw new Error(`Shopify API Failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // 4. Map the data
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
