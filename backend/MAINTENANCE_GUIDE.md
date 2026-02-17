# Backend Maintenance & Integrity Guide

## 1. ⚠️ THE GOLDEN RULE: AWS 6MB LIMIT ⚠️
AWS Lambda and API Gateway have a strict **6MB payload limit**.
**NEVER** return Base64 image strings in any "List" endpoint (endpoints returning arrays `[]`).

*   **Bad (GET /meal-log):** `[{ id: 1, imageBase64: "..." }]` -> This WILL crash the app.
*   **Good (GET /meal-log):** `[{ id: 1, hasImage: true }]`
*   **Detail Pattern:** The client fetches the heavy image data ONLY when viewing a single item via `GET /path/:id`.

---

## 2. Definitive Route Registry (V1.1 CORE)
*Every update MUST preserve the following endpoint registry. These are the routes required by the frontend.*

### 🔐 Auth & Wearable
- `POST /auth/customer-login`
- `GET  /auth/fitbit/status`
- `POST /auth/fitbit/url`
- `POST /auth/fitbit/link`
- `POST /auth/fitbit/disconnect`
- `POST /sync-health/fitbit`

### 🥗 Nutrition Logs & Kitchen AI
- `GET  /nutrition/pantry-log` (History)
- `POST /nutrition/pantry-log` (Upload)
- `GET  /nutrition/pantry-log/:id` (Details/Image)
- `GET  /nutrition/restaurant-log` (History)
- `POST /nutrition/restaurant-log` (Upload)
- `GET  /nutrition/restaurant-log/:id` (Details/Image)
- `GET  /meal-plans`
- `POST /meal-plans`
- `POST /meal-plans/:id/items`
- `DELETE /meal-plans/items/:id`
- `GET  /meal-log` (Strip Base64!)
- `GET  /meal-log/:id` (Include Base64!)
- `POST /analyze-image` (Macros Extraction)
- `POST /get-recipes-from-image` (Pantry Chef)
- `POST /search-food` (Manual Search)

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

### 🧠 Mental & Labs
- `GET  /mental/assessments`
- `GET  /mental/assessment-state`
- `POST /mental/readiness`
- `GET  /labs/results` (via HealthReports)

---

## 3. Database & Service Integrity
- Always use `processMealDataForList` or similar stripping logic in `databaseService.mjs` for all `GET /list` type queries.
- Ensure `shopifyService.mjs` is configured with Admin tokens for Orders and Storefront tokens for Products.
