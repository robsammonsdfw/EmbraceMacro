
# Backend Maintenance & Integrity Guide

## 1. ⚠️ THE GOLDEN RULE: AWS 6MB LIMIT ⚠️
AWS Lambda and API Gateway have a strict **6MB payload limit**.
**NEVER** return Base64 image strings in any "List" endpoint (endpoints returning arrays `[]`).

*   **Bad (GET /meal-log):** `[{ id: 1, imageBase64: "..." }]` -> This WILL crash the app.
*   **Good (GET /meal-log):** `[{ id: 1, hasImage: true }]`
*   **Detail Pattern:** The client fetches the heavy image data ONLY when viewing a single item via `GET /path/:id`.

---

## 2. Definitive Route Registry (V1.0 PARITY)
*Every update MUST preserve the following endpoint registry. If a route is missing from `index.mjs`, it's a regression.*

### 🔐 Auth & Wearable
- `POST /auth/customer-login`
- `GET  /auth/fitbit/status`
- `POST /auth/fitbit/url`
- `POST /auth/fitbit/link`
- `POST /auth/fitbit/disconnect`
- `POST /sync-health/fitbit`

### 🥗 Nutrition & Kitchen AI
- `GET  /meal-plans`
- `POST /meal-plans`
- `POST /meal-plans/:id/items`
- `DELETE /meal-plans/items/:id`
- `GET  /saved-meals` (Strip Base64!)
- `GET  /saved-meals/:id` (Include Base64!)
- `POST /saved-meals`
- `GET  /meal-log` (Strip Base64!)
- `GET  /meal-log/:id` (Include Base64!)
- `POST /analyze-image` (Macros Extraction)
- `POST /get-recipes-from-image` (Pantry Chef)
- `POST /search-food` (Manual Search)

### 🛒 Grocery & Commerce
- `GET  /grocery/lists`
- `POST /grocery/lists`
- `DELETE /grocery/lists/:id`
- `GET  /grocery/lists/:id/items`
- `POST /grocery/lists/:id/items`
- `PATCH /grocery/items/:id`
- `DELETE /grocery/items/:id`
- `POST /grocery/lists/:id/clear`
- `POST /grocery/lists/:id/import`
- `POST /grocery/identify` (Vision)
- `GET  /shopify/orders`
- `GET  /shopify/products/:handle`

### 💪 Physical & Form AI
- `GET  /health-metrics`
- `POST /sync-health` (Manual/Apple)
- `POST /analyze-health-screenshot` (Vision Sync)
- `GET  /body/photos` (Strip Base64!)
- `POST /body/photos`
- `GET  /body/photos/:id` (Include Base64!)
- `GET  /body/form-checks`
- `POST /body/analyze-form` (Vision Coach)

### 🧠 Mental & Readiness
- `GET  /mental/assessments`
- `GET  /mental/assessment-state`
- `POST /mental/assessment/:id`
- `POST /mental/readiness`
- `POST /mental/passive-pulse`

### 👥 Social & Coaching
- `GET  /social/friends`
- `GET  /social/profile`
- `PATCH /social/profile`
- `GET  /social/requests`
- `POST /social/request`
- `POST /social/request/respond`
- `GET  /coaching/relations`

### 📚 Content
- `GET  /content/pulse`
- `POST /content/pulse/:id/action`

---

## 3. Database & Service Integrity
- Always use `processMealDataForList` or similar stripping logic in `databaseService.mjs` for all `GET /list` type queries.
- Ensure `shopifyService.mjs` handles both Admin (Orders) and Storefront (Products) contexts with separate tokens.
