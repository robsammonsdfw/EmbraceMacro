
import * as db from './databaseService.mjs';

// Updated to match the specific environment variables from your configuration
const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_URL;

// STRICT: Use the Admin API Key for server-side operations (Orders, Customers)
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_KEY;

// STRICT: Use the Storefront Access Token for client-facing operations (Products)
const SHOPIFY_STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;

// 1. Backend Order Fetching (Admin Context)
export const fetchCustomerOrders = async (userId) => {
    // Validate Credentials
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_TOKEN) {
        const errorMsg = "Server configuration error: Missing Shopify Admin Credentials (SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_KEY)";
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    // Get the Shopify Customer ID associated with this user
    const shopifyCustomerId = await db.getShopifyCustomerId(userId);

    if (!shopifyCustomerId) {
        return []; 
    }

    try {
        // Admin API version 2024-01
        const url = `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/customers/${shopifyCustomerId}/orders.json?status=any`;
        
        console.log(`Fetching orders from: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN // Admin Token
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

// 2. Product Fetching (Storefront Context)
export const getProductByHandle = async (handle) => {
    if (!SHOPIFY_DOMAIN || !SHOPIFY_STOREFRONT_TOKEN) {
        const errorMsg = "Server configuration error: Missing Shopify Storefront Credentials (SHOPIFY_STOREFRONT_TOKEN)";
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    const query = `
    query getProduct($handle: String!) {
      product(handle: $handle) {
        id
        title
        description
        onlineStoreUrl
        featuredImage {
          url
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
    `;

    try {
        const url = `https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN // Storefront Token
            },
            body: JSON.stringify({
                query,
                variables: { handle }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Shopify Storefront API Error (${response.status}):`, errText);
            throw new Error(`Shopify API Failed: ${response.status}`);
        }

        const json = await response.json();
        
        if (json.errors) {
            console.error("GraphQL Errors:", json.errors);
            throw new Error("Shopify GraphQL Error");
        }

        const product = json.data?.product;
        
        if (!product) {
            return null; // Product not found
        }

        // Format for frontend
        return {
            id: product.id,
            title: product.title,
            description: product.description,
            price: product.priceRange?.minVariantPrice?.amount || "0.00",
            currency: product.priceRange?.minVariantPrice?.currencyCode || "USD",
            imageUrl: product.featuredImage?.url,
            url: product.onlineStoreUrl
        };

    } catch (error) {
        console.error("Error fetching product by handle:", error);
        throw error;
    }
};
