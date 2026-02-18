
# Backend Maintenance & Integrity Guide

## 1. ⚠️ THE GOLDEN RULE: AWS 6MB LIMIT ⚠️
AWS Lambda and API Gateway have a strict **6MB payload limit**.
**NEVER** return Base64 image strings in any "List" endpoint (endpoints returning arrays `[]`).

*   **Bad (GET /meal-log):** `[{ id: 1, imageBase64: "..." }]` -> This WILL crash the app.
*   **Good (GET /meal-log):** `[{ id: 1, hasImage: true }]`
*   **Detail Pattern:** The client fetches the heavy image data ONLY when viewing a single item via `GET /path/:id`.

---

## 2. Definitive Route Registry (V1.2 CORE)
*Every update MUST preserve the following endpoint registry.*

### 🔐 Auth & Wearable
- `POST /auth/customer-login`
- `GET  /auth/fitbit/status`
- `POST /auth/fitbit/url`
- `POST /auth/fitbit/link`
- `POST /auth/fitbit/disconnect`
- `POST /sync-health/fitbit` (Restored)

### 🥗 Nutrition Logs & Kitchen AI
- `GET  /meal-log` (Strip Base64!)
- `GET  /meal-log/:id` (Include Base64!)
- `GET  /nutrition/pantry-log`
- `POST /nutrition/pantry-log`
- `GET  /nutrition/restaurant-log`
- `POST /nutrition/restaurant-log`
- `GET  /saved-meals`
- `POST /saved-meals`
- `DELETE /saved-meals/:id`
- `GET  /meal-plans`
- `POST /meal-plans`
- `POST /meal-plans/:id/items`
- `DELETE /meal-plans/items/:id`
- `POST /analyze-image` (Macros Extraction)
- `POST /get-recipes-from-image` (Pantry Chef)

### 📊 Health & Preferences
- `GET  /health-metrics`
- `POST /sync-health`
- `POST /analyze-health-screenshot` (Vision Sync)
- `GET  /body/dashboard-prefs`
- `POST /body/dashboard-prefs`
- `GET  /rewards`

### 👥 Social & Coaching
- `GET  /social/profile`
- `PATCH /social/profile`
- `GET  /social/friends`
- `GET  /social/requests`
- `POST /social/request`
- `POST /social/request/respond`
- `GET  /coaching/relations`

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

---

## 3. Database & Service Integrity
- Always use `processMealDataForList` or similar stripping logic in `databaseService.mjs` for all `GET /list` type queries.
- Ensure `shopifyService.mjs` is configured with Admin tokens for Orders and Storefront tokens for Products.
- Gemini SDK: Always check `candidates[0].content.parts` for `inlineData` in image generation tasks.
