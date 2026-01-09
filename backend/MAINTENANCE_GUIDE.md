
# Backend Maintenance & Integrity Guide

**CRITICAL RULE: AWS Lambda 6MB Payload Limit**
To prevent `413 Request Entity Too Large` errors, **NEVER** return Base64 image strings in "List" endpoints (endpoints returning arrays of items).
1.  **List Endpoints (GET /collection):** MUST return `{ id, ..., hasImage: true }`. Strip the `image_base64` or `imageUrl` field.
2.  **Detail Endpoints (GET /collection/:id):** ONLY here should you return the full Base64 string.
3.  **Frontend Logic:** The frontend sees `hasImage: true` and renders a "View" button, which fetches the detail endpoint on demand.

---

## 1. `backend/index.mjs` (Router Checklist)
*Ensure all the following route patterns exist and match their HTTP methods.*

### 🟢 Core & Auth
- [ ] `GET  /` or `/health`
- [ ] `POST /auth/customer-login`

### 🍎 Nutrition & Meals
- [ ] `GET  /saved-meals` (List - Strip Images)
- [ ] `POST /saved-meals`
- [ ] `GET  /saved-meals/:id` (Detail - Include Image)
- [ ] `DELETE /saved-meals/:id`
- [ ] `GET  /meal-plans`
- [ ] `POST /meal-plans`
- [ ] `POST /meal-plans/:id/items`
- [ ] `DELETE /meal-plans/items/:id`

### 🛒 Grocery List
- [ ] `GET  /grocery/lists`
- [ ] `POST /grocery/lists`
- [ ] `GET  /grocery/lists/:id/items`
- [ ] `POST /grocery/lists/:id/items`
- [ ] `PATCH /grocery/items/:id` (Toggle check)
- [ ] `DELETE /grocery/items/:id`
- [ ] `POST /grocery/lists/:id/import` (Import from plan)
- [ ] `POST /grocery/lists/:id/clear` (Clear checked/all)
- [ ] `POST /grocery/identify` (AI Vision)

### 📸 Logs (Specific Features)
- [ ] `GET  /meal-log` (History List - Strip Images)
- [ ] `POST /meal-log`
- [ ] `GET  /meal-log/:id` (Detail - Include Image)
- [ ] `GET  /nutrition/pantry-log` (List - Strip Images)
- [ ] `POST /nutrition/pantry-log`
- [ ] `GET  /nutrition/pantry-log/:id` (Detail - Include Image)
- [ ] `GET  /nutrition/restaurant-log` (List - Strip Images)
- [ ] `POST /nutrition/restaurant-log`
- [ ] `GET  /nutrition/restaurant-log/:id` (Detail - Include Image)

### 💪 Physical & Body
- [ ] `GET  /body/photos` (List - Strip Images)
- [ ] `POST /body/photos`
- [ ] `GET  /body/photos/:id` (Detail - Include Image)
- [ ] `GET  /physical/form-checks` (List - Strip Images)
- [ ] `POST /physical/form-checks`
- [ ] `GET  /physical/form-checks/:id` (Detail - Include Image)
- [ ] `GET  /health-metrics`
- [ ] `POST /sync-health`
- [ ] `GET  /body/dashboard-prefs`
- [ ] `POST /body/dashboard-prefs`

### 👥 Social & Coaching
- [ ] `GET  /social/friends`
- [ ] `GET  /social/requests`
- [ ] `POST /social/requests` (Send)
- [ ] `POST /social/requests/:id` (Respond)
- [ ] `GET  /social/profile`
- [ ] `PATCH /social/profile`
- [ ] `GET  /coaching/relations`
- [ ] `POST /coaching/invites`

### 🛍️ Shopify & Orders
- [ ] `GET /shopify/orders` (Proxies data via `fetchCustomerOrders`)

### 🤖 AI Analysis (Gemini)
- [ ] `POST /analyze-image` (Macros)
- [ ] `POST /analyze-restaurant-meal` (Recipe Reversal)
- [ ] `POST /get-recipes-from-image` (Pantry Chef)
- [ ] `POST /analyze-form` (Exercise Form)

---

## 2. `backend/services/databaseService.mjs` (Export Checklist)
*Ensure these functions are exported. If modifying SQL, check the "Strip Image" logic.*

### Core
- [ ] `findOrCreateUserByEmail`
- [ ] `getShopifyCustomerId`
- [ ] `ensureTables` (Must create: `users`, `rewards_*`, `grocery_*`, `pantry_logs`, `restaurant_logs`, `body_photos`, `form_checks`, `meal_log_entries`, `saved_meals`, `meal_plans`, `health_metrics`, `friendships`)

### Logs & Images (CRITICAL: Check Image Stripping)
- [ ] `getMealLogEntries` -> **MUST** return `has_image` boolean, **NOT** `image_base64`.
- [ ] `getPantryLog` -> **MUST** return `has_image` boolean.
- [ ] `getRestaurantLog` -> **MUST** return `has_image` boolean.
- [ ] `getBodyPhotos` -> **MUST** return `has_image` boolean.
- [ ] `getFormChecks` -> **MUST** return `has_image` boolean.
- [ ] `getSavedMeals` -> **MUST** return `has_image` boolean.

### Detail Getters (Full Data)
- [ ] `getMealLogEntryById`
- [ ] `getPantryLogEntryById`
- [ ] `getRestaurantLogEntryById`
- [ ] `getBodyPhotoById`
- [ ] `getFormCheckById`
- [ ] `getSavedMealById`

### Savers/Setters
- [ ] `createMealLogEntry`
- [ ] `savePantryLogEntry`
- [ ] `saveRestaurantLogEntry`
- [ ] `uploadBodyPhoto`
- [ ] `saveFormCheck`
- [ ] `saveMeal`
- [ ] `deleteMeal`

### Grocery & Plans
- [ ] `getGroceryList`, `addGroceryItem`, `removeGroceryItem`, `updateGroceryListItem`, `clearGroceryList`, `generateGroceryList`
- [ ] `getMealPlans`, `createMealPlan`, `deleteMealPlan`, `addMealToPlanItem`, `removeMealFromPlanItem`

### Social & Health
- [ ] `getFriends`, `getFriendRequests`, `sendFriendRequest`, `respondToFriendRequest`, `getSocialProfile`, `updateSocialProfile`
- [ ] `getHealthMetrics`, `syncHealthMetrics`, `getDashboardPrefs`, `saveDashboardPrefs`

---

## 3. Shopify Authentication Rules
*Strict guidelines for `backend/services/shopifyService.mjs`.*

- [ ] **Customer API Usage:** Authentication and customer-facing interactions **MUST** use the Shopify **Customer API (Storefront API)** context.
- [ ] **Admin API Restriction:** **NEVER** attempt to authenticate a customer using the Admin API credentials. The Admin API is for server-side data fetching (like pulling orders for a mapped ID) only.
- [ ] **Credential Safety:** Ensure `SHOPIFY_STOREFRONT_TOKEN` is used for client operations and `SHOPIFY_ADMIN_API_KEY` is strictly reserved for backend order lookups.
