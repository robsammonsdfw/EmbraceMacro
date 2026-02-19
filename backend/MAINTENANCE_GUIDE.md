# Backend Maintenance & Integrity Guide (V1.4 CORE)

## 1. ⚠️ THE GOLDEN RULE: AWS 6MB LIMIT ⚠️
AWS Lambda and API Gateway have a strict **6MB payload limit**.
**NEVER** return Base64 image strings in any "List" endpoint (endpoints returning arrays `[]`).

* **Bad (GET /meal-log):** `[{ id: 1, imageBase64: "..." }]` -> This WILL crash the app.
* **Worse:** Renaming `imageBase64` to `imageUrl` but keeping the massive base64 string.
* **Good (GET /meal-log):** `[{ id: 1, hasImage: true }]` (Delete the heavy string entirely).
* **Detail Pattern:** The client fetches the heavy image data ONLY when viewing a single item via `GET /path/:id`.

---

## 2. Definitive Route Registry
*Every update MUST preserve the following endpoint registry. DO NOT truncate or omit.*

### 🔐 Auth & Wearable
- `POST /auth/customer-login`
- `GET  /auth/fitbit/status`
- `POST /auth/fitbit/url`
- `POST /auth/fitbit/link`
- `POST /auth/fitbit/disconnect`
- `POST /sync-health/fitbit`

### 🥗 Nutrition Logs & Kitchen AI
- `GET  /meal-log` (Strip Base64!)
- `GET  /meal-log/:id` (Include Base64!)
- `GET  /nutrition/pantry-log`
- `POST /nutrition/pantry-log`
- `GET  /nutrition/restaurant-log`
- `POST /nutrition/restaurant-log`
- `GET  /saved-meals` (Strip Base64!)
- `POST /saved-meals`
- `DELETE /saved-meals/:id`
- `GET  /meal-plans`
- `POST /meal-plans`
- `POST /meal-plans/:id/items`
- `DELETE /meal-plans/items/:id`

### 📊 Health, Body & Preferences
- `GET  /health-metrics`
- `POST /sync-health`
- `POST /body/form-check`
- `GET  /body/form-check/:id`
- `GET  /body/dashboard-prefs`
- `POST /body/dashboard-prefs`
- `GET  /rewards`

### 🧠 Mental & Readiness
- `GET  /mental/assessments`
- `GET  /mental/assessment-state`
- `POST /mental/readiness`

### 👥 Social & Coaching
- `GET  /social/profile`
- `PATCH /social/profile`
- `GET  /social/friends`
- `GET  /social/requests`
- `POST /social/request`
- `POST /social/request/respond`
- `POST /social/bulk-invite`
- `GET  /social/restaurant-activity`
- `GET  /coaching/relations`
- `POST /coaching/invite`
- `POST /coaching/respond`
- `DELETE /coaching/relation/:id`

### 🛒 Grocery System
- `GET  /grocery/lists`
- `POST /grocery/lists`
- `DELETE /grocery/lists/:id`
- `GET  /grocery/lists/:id/items`
- `POST /grocery/lists/:id/items`
- `PATCH /grocery/items/:id`
- `DELETE /grocery/items/:id`
- `POST /grocery/lists/:id/import`
- `POST /grocery/lists/:id/clear`

### 🛍️ Shopify & AI Tools
- `GET  /shopify/orders`
- `GET  /shopify/products/:handle`
- `POST /analyze-image`
- `POST /analyze-restaurant-meal`
- `POST /get-recipes-from-image`

---

## 3. Database & Service Integrity Rules
- **No Hallucinated Tables:** Ensure columns like `fitbit_access_token` and tables like `mental_readiness` are explicitly queried correctly.
- **Path Sanitization:** The router (`index.mjs`) MUST include `/default` stripping logic for AWS API Gateway: `if (path.startsWith('/default')) path = path.replace('/default', '');`
- **Shopify Config:** `shopifyService.mjs` uses `SHOPIFY_ADMIN_API_KEY` for orders and `SHOPIFY_STOREFRONT_TOKEN` for products.