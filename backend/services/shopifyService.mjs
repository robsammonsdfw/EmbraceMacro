
import * as db from './databaseService.mjs';

// Updated to match the specific environment variables from your screenshot
const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_URL;
// Priority to Admin key, but falling back to Storefront token variable if that's what is available
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_KEY || process.env.SHOPIFY_STOREFRONT_TOKEN;

export const fetchCustomerOrders = async (userId) => {
    // 1. Validate Credentials
    if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
        const errorMsg = "Server configuration error: Missing Shopify Credentials (SHOPIFY_STORE_DOMAIN or Token)";
        console.error(errorMsg, { 
            hasDomain: !!SHOPIFY_DOMAIN, 
            hasToken: !!SHOPIFY_TOKEN 
        });
        throw new Error(errorMsg);
    }

    // 2. Get the Shopify Customer ID associated with this user
    const shopifyCustomerId = await db.getShopifyCustomerId(userId);

    if (!shopifyCustomerId) {
        // If the user hasn't been linked to a Shopify Customer ID yet, return empty list.
        // We do not return mock data here to ensure accuracy.
        return []; 
    }

    try {
        // 3. Call Shopify Admin API to get orders
        // Note: This requires an Admin API Access Token (shpat_...), not a public Storefront token.
        const url = `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/customers/${shopifyCustomerId}/orders.json?status=any`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': SHOPIFY_TOKEN
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Shopify API Error (${response.status}):`, errText);
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
        // Throw the real error so the frontend knows something went wrong
        throw error;
    }
};
