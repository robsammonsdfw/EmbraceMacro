
# Backend Maintenance & Integrity Guide

## 1. ⚠️ THE GOLDEN RULE: AWS 6MB LIMIT ⚠️
AWS Lambda and API Gateway have a strict **6MB payload limit**.
**NEVER** return Base64 image strings in any "List" endpoint (endpoints returning arrays `[]`).

*   **Bad (GET /meal-log):** `[{ id: 1, imageBase64: "..." }, { id: 2, imageBase64: "..." }]` -> This WILL crash the app once the user has >5 meals.
*   **Good (GET /meal-log):** `[{ id: 1, hasImage: true }, { id: 2, hasImage: true }]`
*   **Detail Pattern:** The client fetches the heavy image data ONLY when viewing a single item via `GET /meal-log/:id`.

---

## 2. Router Inventory (`index.mjs`)
*Every update MUST preserve the following endpoint registry.*

### 🔐 Auth & Identity
- `POST /auth/customer-login`
- `POST /auth/fitbit/url`
- `POST /auth/fitbit/link`
- `GET  /auth/fitbit/status`
- `POST /auth/fitbit/disconnect`

### 📊 Health & Vitals
- `GET  /health-metrics`
- `POST /sync-health`
- `POST /sync-health/fitbit`
- `POST /analyze-health-screenshot` (Vision Sync)

### 🍱 Nutrition & Planning
- `GET  /meal-plans`
- `POST /meal-plans`
- `POST /meal-plans/:id/items`
- `DELETE /meal-plans/items/:id`
- `GET  /saved-meals` (Strip Base64!)
- `GET  /saved-meals/:id` (Include Base64!)
- `POST /saved-meals`
- `GET  /meal-log` (Strip Base64!)
- `GET  /meal-log/:id` (Include Base64!)

### ⚙️ User Config
- `GET  /body/dashboard-prefs`
- `POST /body/dashboard-prefs`
- `GET  /social/profile`
- `PATCH /social/profile`

### 🤖 AI Engines
- `POST /analyze-image` (Macros Extraction)
- `POST /get-recipes-from-image` (Pantry Chef)
- `POST /search-food` (Manual Search)

### 🛒 Commerce & Grocery
- `GET  /shopify/orders`
- `GET  /shopify/products/:handle`
- `GET  /grocery/lists`
- `PATCH /grocery/items/:id`
- `POST /grocery/lists/generate`

---

## 3. Database Integrity
*Ensure these tables are maintained in `databaseService.mjs`:*
- `users`: Core profile and dashboard preferences.
- `meal_log_entries`: Vision history.
- `saved_meals`: User library.
- `meal_plans` & `meal_plan_items`: Scheduling.
- `health_metrics`: Persisted wearable data.
- `rewards_ledger`: Points system.
