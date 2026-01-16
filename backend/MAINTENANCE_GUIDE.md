
# Backend Maintenance & Integrity Guide

**⚠️ CRITICAL RULE: AWS Lambda 6MB Payload Limit ⚠️**
To prevent `413 Request Entity Too Large` errors, **NEVER** return Base64 image strings in "List" endpoints (endpoints returning arrays of items).

1.  **List Endpoints (GET /collection):** 
    *   MUST return `{ id, ..., hasImage: true }`.
    *   **STRIP** the `image_base64` or `imageUrl` field before sending the response.
    *   Use the helper `processMealDataForList(data)` in `databaseService.mjs`.
2.  **Detail Endpoints (GET /collection/:id):** 
    *   ONLY here is it safe to return the full Base64 string.
3.  **Frontend Logic:** 
    *   The frontend sees `hasImage: true` and renders a "View" button.
    *   Clicking "View" fetches the specific Detail endpoint to load the heavy image data on demand.

---

## 1. Feature Regression Checklist (Production Bible)
*Every code update MUST verify these JSON structures are maintained.*

### 📸 MacrosChef (`POST /analyze-image`)
- [ ] **Meal Name & Macros:** Returns `mealName`, `totalCalories`, `totalProtein`, `totalCarbs`, `totalFat`.
- [ ] **Ingredients:** Returns `ingredients` array (used by Macros Tab).
- [ ] **Recipe Integration:** Returns `recipe` object with `instructions` array and `ingredients` array (used by Recipe Tab).
- [ ] **Kitchen Tools:** Returns `kitchenTools` array of objects `{name, use, essential}` (used by Tools Tab).

### 👨‍🍳 MasterChef (`POST /analyze-restaurant-meal`)
- [ ] **Consistent Structure:** Must return **exact same structure** as MacrosChef, especially `recipe` and `kitchenTools`.
- [ ] **Source Tagging:** Frontend handles `source: 'restaurant'` but backend structure must remain identical for the modal to work.

### 🥫 PantryChef (`POST /get-recipes-from-image`)
- [ ] **Array Return:** Must return an **Array** of recipe objects (not a single object).
- [ ] **Recipe Objects:** Each item must contain `recipeName`, `description`, `ingredients`, `instructions`, `nutrition`.

### 💪 Form AI (`POST /analyze-form`)
- [ ] **Scoring:** Returns `score` (0-100) and `feedback` string.
- [ ] **Boolean:** Returns `isCorrect` boolean.

---

## 2. `backend/index.mjs` (Router Checklist)
*Ensure all the following route patterns exist and match their HTTP methods.*

### 🟢 Core & Auth
- [ ] `GET  /` or `/health`
- [ ] `POST /auth/customer-login`

### 🍎 Nutrition & Meals
- [ ] `GET  /saved-meals` (List - **Strip Images**)
- [ ] `POST /saved-meals`
- [ ] `GET  /saved-meals/:id` (Detail - **Include Image**)
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
- [ ] `GET  /meal-log` (History List - **Strip Images**)
- [ ] `POST /meal-log`
- [ ] `GET  /meal-log/:id` (Detail - **Include Image**)
- [ ] `GET  /nutrition/pantry-log` (List - **Strip Images**)
- [ ] `POST /nutrition/pantry-log`
- [ ] `GET  /nutrition/pantry-log/:id` (Detail - **Include Image**)
- [ ] `GET  /nutrition/restaurant-log` (List - **Strip Images**)
- [ ] `POST /nutrition/restaurant-log`
- [ ] `GET  /nutrition/restaurant-log/:id` (Detail - **Include Image**)

### 💪 Physical & Body
- [x] `GET  /body/photos` (List - **Strip Images**)
- [x] `POST /body/photos`
- [x] `GET  /body/photos/:id` (Detail - **Include Image**)
- [x] `GET  /physical/form-checks` (List - **Strip Images**)
- [x] `POST /physical/form-checks`
- [x] `GET  /physical/form-checks/:id` (Detail - **Include Image**)
- [ ] `GET  /health-metrics`
- [ ] `POST /sync-health`
- [ ] `GET  /body/dashboard-prefs`
- [ ] `POST /body/dashboard-prefs`

### 👥 Social, Rewards & Coaching
- [ ] `GET  /rewards` (Returns points & history)
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
- [ ] `GET /shopify/products/:handle` (Proxies data via `getProductByHandle`)

### 🤖 AI Analysis (Gemini)
- [ ] `POST /analyze-image` (Macros)
- [ ] `POST /analyze-restaurant-meal` (Recipe Reversal)
- [ ] `POST /get-recipes-from-image` (Pantry Chef)
- [ ] `POST /analyze-form` (Exercise Form)

---

## 3. `backend/services/databaseService.mjs` (Export Checklist)
*Ensure these functions are exported. If modifying SQL, ALWAYS check the "Strip Image" logic.*

### Core
- [ ] `findOrCreateUserByEmail`
- [ ] `getShopifyCustomerId`
- [ ] `ensureTables` (Must create: `users`, `rewards_*`, `grocery_*`, `pantry_logs`, `restaurant_logs`, `body_photos`, `form_checks`, `meal_log_entries`, `saved_meals`, `meal_plans`, `health_metrics`, `friendships`)

### Logs & Images (CRITICAL: Check Image Stripping)
- [ ] `getMealLogEntries` -> **MUST** return `has_image` boolean, **NOT** `image_base64`.
- [ ] `getPantryLog` -> **MUST** return `has_image` boolean.
- [ ] `getRestaurantLog` -> **MUST** return `has_image` boolean.
- [x] `getBodyPhotos` -> **MUST** return `has_image` boolean.
- [x] `getFormChecks` -> **MUST** return `has_image` boolean.
- [ ] `getSavedMeals` -> **MUST** return `has_image` boolean.

### Detail Getters (Full Data)
- [ ] `getMealLogEntryById`
- [ ] `getPantryLogEntryById`
- [ ] `getRestaurantLogEntryById`
- [x] `getBodyPhotoById`
- [x] `getFormCheckById`
- [ ] `getSavedMealById`

### Savers/Setters
- [ ] `createMealLogEntry`
- [ ] `savePantryLogEntry`
- [ ] `saveRestaurantLogEntry`
- [x] `uploadBodyPhoto`
- [x] `saveFormCheck`
- [ ] `saveMeal`
- [ ] `deleteMeal`

### Grocery & Plans
- [ ] `getGroceryList`, `addGroceryItem`, `removeGroceryItem`, `updateGroceryListItem`, `clearGroceryList`, `generateGroceryList`
- [ ] `getMealPlans`, `createMealPlan`, `deleteMealPlan`, `addMealToPlanItem`, `removeMealFromPlanItem`

### Social, Health & Rewards
- [ ] `getRewardsSummary`, `awardPoints`
- [ ] `getFriends`, `getFriendRequests`, `sendFriendRequest`, `respondToFriendRequest`, `getSocialProfile`, `updateSocialProfile`
- [ ] `getHealthMetrics`, `syncHealthMetrics`, `getDashboardPrefs`, `saveDashboardPrefs`

---

## 4. Shopify Authentication Rules
*Strict guidelines for `backend/services/shopifyService.mjs`.*

- [ ] **Customer API Usage:** Authentication and customer-facing interactions **MUST** use the Shopify **Customer API (Storefront API)** context.
- [ ] **Admin API Restriction:** **NEVER** attempt to authenticate a customer using the Admin API credentials. The Admin API is for server-side data fetching (like pulling orders for a mapped ID) only.
- [ ] **Credential Safety:** Ensure `SHOPIFY_STOREFRONT_TOKEN` is used for client operations and `SHOPIFY_ADMIN_API_KEY` is strictly reserved for backend order lookups.

---

## 5. Gemini AI Model Standards
*Ensure `backend/index.mjs` uses the correct models for tasks.*

- [ ] **Vision Tasks (Food/Body/Pantry):** Use `gemini-2.5-flash`. Do not use experimental or deprecated models.
- [ ] **Text Tasks (Chat/Reasoning):** Use `gemini-2.5-flash` or `gemini-3-flash-preview`.
- [ ] **Initialization:** Always use `new GoogleGenAI({ apiKey: process.env.API_KEY })`.
