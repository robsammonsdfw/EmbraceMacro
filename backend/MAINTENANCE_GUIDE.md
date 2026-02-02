
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

### 🛒 Grocery Hub (Fixed Infrastructure)
- [ ] **Table Structure:** Relies on `grocery_lists` (parent) and `grocery_list_items` (children).
- [ ] **Functions:** Must use `getGroceryLists` (plural) and `createGroceryList` to handle multiple lists correctly.
- [ ] **Stub Prevention:** Ensure `index.mjs` is NOT hardcoded to return `[{id:1}]`. It must query the DB.

### 👤 User Intake & Journey
- [ ] **Storage:** "Active Journey" is stored in `dashboard_prefs.selectedJourney`.
- [ ] **Questionnaire:** Additional health answers are stored in `users.intake_data` JSONB column.

### 🌐 Social Hub & Referrals
- [ ] **Bulk Invite:** `POST /social/bulk-invite` processes contact lists.
- [ ] **Privacy Logic:** Checks `privacy_mode` before auto-friending.
- [ ] **Referral Rewards:** Awards 50 pts on invite, 450 pts on join.
- [ ] **Token Logic:** `invitations` table stores unique tokens redeemed via `POST /auth/customer-login`.

---

## 2. `backend/index.mjs` (Router Checklist)
*Ensure all the following route patterns exist and match their HTTP methods.*

### 🟢 Core & Auth
- [ ] `GET  /` or `/health`
- [ ] `POST /auth/customer-login`
- [ ] `GET /account/intake` (New)
- [ ] `POST /account/intake` (New)

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

... [Rest of existing checklist remains valid] ...
