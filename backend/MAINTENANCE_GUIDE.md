
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
- [ ] **Recipe Integration:** Returns `recipe` object with `instructions` and `nutrition`.
- [ ] **Kitchen Tools:** Returns `kitchenTools` array of objects `{name, use, essential}`.

### ⌚ Fitbit Integration
- [ ] `POST /auth/fitbit/url`: Returns signed authorization URL.
- [ ] `POST /auth/fitbit/link`: Handles PKCE token exchange.
- [ ] `GET /auth/fitbit/status`: Returns current link state.
- [ ] `POST /sync-health/fitbit`: Pulls and saves device activity.

### 🩺 Clinical Suite
- [ ] `POST /analyze-health-screenshot`: Parses metrics from Apple Health images via Gemini.
- [ ] `GET/PATCH /account/medical-intake`: Persists user medical history JSON.
- [ ] `POST /body/analyze-form`: Computer vision form analysis with score/feedback.

### 🛒 Grocery Hub
- [ ] **Table Structure:** Relies on `grocery_lists` and `grocery_list_items`.
- [ ] `POST /grocery/identify`: AI Vision identifies ingredients from pantry photos.

---

## 2. `backend/index.mjs` (Router Checklist)
*Ensure all the following route patterns exist and match their HTTP methods.*

### 🟢 Core & Auth
- [ ] `POST /auth/customer-login`
- [ ] `POST /auth/fitbit/url`
- [ ] `POST /auth/fitbit/link`
- [ ] `GET  /auth/fitbit/status`
- [ ] `POST /auth/fitbit/disconnect`

### 🛒 Grocery & Nutrition
- [ ] `GET  /grocery/lists`
- [ ] `POST /grocery/identify` (AI Vision)
- [ ] `POST /analyze-image` (Macros Extraction)
- [ ] `POST /get-recipes-from-image` (Pantry Chef)
- [ ] `POST /search-food` (Manual Text Search)

### 💪 Physical & Health
- [ ] `POST /sync-health/fitbit`
- [ ] `POST /analyze-health-screenshot` (Vision Sync)
- [ ] `POST /body/analyze-form` (Form AI)
- [ ] `GET  /body/photos` (Progress Gallery)
- [ ] `GET  /account/medical-intake`

### 👤 Social & Shopify
- [ ] `GET  /social/friends`
- [ ] `GET  /shopify/orders`
- [ ] `GET  /shopify/products/:handle`
