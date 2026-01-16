
# Frontend Maintenance & Integrity Guide

**Application:** EmbraceHealth AI  
**Role:** Client-Side Logic & UI State Management

This document serves as the "Production Bible" for frontend updates. Any change to the React components or services must pass this checklist to ensure no feature regression.

---

## 1. UX & State Integrity Checklist
*Before merging any PR, verify these critical user flows.*

### 🟢 Core Capture Flow
- [ ] **Camera Modal:** `CaptureFlow.tsx` must open full screen when triggered.
- [ ] **Mode Switching:** Switching between "Macros", "Pantry", and "Vitals" inside the camera modal updates the UI context.
- [ ] **Analysis Result:** After capture, `AnalysisResultModal.tsx` must open.
    - [ ] **3-Tab View:** For Meals, the tabs "Macros", "Recipe", "Tools" MUST be visible.
    - [ ] **Data Population:** Ensure `nutritionData.recipe` and `nutritionData.kitchenTools` populate the respective tabs.
    - [ ] **Fallback:** If recipe data is missing, the "Recipe" tab must show a graceful empty state, not crash.

### 📅 Meal Planning (FuelSection)
- [ ] **Drag & Drop:** `MealPlanManager.tsx` must support dragging a meal from the library sidebar into a specific day/slot.
- [ ] **Mobile Library:** On mobile, clicking an empty slot must open the Library slide-over.
- [ ] **Medical Planner:** The `MedicalPlannerModal` must generate a plan and *append* it to the list of plans without overwriting existing data.

### 🛒 Grocery Hub
- [ ] **Import Logic:** `GroceryList.tsx` -> "Import" button must allow selecting multiple plans.
- [ ] **Deduplication:** Importing the same plan twice should not duplicate ingredients (backend handles this, frontend visual check).
- [ ] **Export Links:** "Instacart" and "Amazon" buttons must open new tabs with pre-filled query parameters.

### 💪 Body Hub
- [ ] **Tab Switching:** Switching between `3D Scan`, `Body Pics`, `Log`, and `Form AI` must preserve state.
- [ ] **Form Analysis:** 
    - [ ] Uploading a video/image in `FormAnalysis.tsx` must trigger the analysis loader.
    - [ ] Result overlay must show Score & Feedback.
- [ ] **Upload Alignment:** The `BodybuilderOutline` overlay must appear when uploading a progress pic to guide alignment.

### 🩺 Telemedicine & Labs
- [ ] **Dynamic Views:** `TeleMedicineHub.tsx` uses `view` prop to render different product lists. Ensure no "undefined" views.
- [ ] **Shopify Data:** Product cards must load price/image from the backend proxy (`apiService.getShopifyProduct`). Skeleton loaders must appear while fetching.

### 👥 Social & Coaching
- [ ] **Proxy Banner:** When a Coach enters `onProxySelect`, the yellow `CoachProxyBanner` must appear at the top of the app.
- [ ] **Read-Only Mode:** Ensure `CoachProxyUI` components correctly disable "Delete" or "Sensitive" actions when in read-only mode.

---

## 2. Component Hierarchy & Props
*Critical prop-drilling paths that must be maintained.*

- **`App.tsx` -> `DesktopApp/MobileApp`**: Passes global state (`healthStats`, `dashboardPrefs`, `userRole`).
- **`FuelSection`**: Requires `plans`, `savedMeals`, `mealLog` to be passed down. Breaking this breaks the entire Nutrition tab.
- **`AnalysisResultModal`**:
    - Prop `nutritionData` is for single-meal analysis (Unified View).
    - Prop `recipeData` is for multi-recipe suggestions (Pantry Chef).
    - **Rule:** Do not merge these props unless refactoring the entire Pantry Chef flow.

---

## 3. Service Layer Standards (`services/apiService.ts`)
*Rules for communicating with the backend.*

- [ ] **Image Compression:** All image uploads MUST go through `compressImage` before being sent to the backend. Max width 600px, quality 0.5.
- [ ] **Error Handling:** `callApi` wrapper must handle 401 (Logout) and 429 (Quota) gracefully.
- [ ] **Type Safety:** All API returns must be cast to their TypeScript interfaces from `types.ts`.

---

## 4. CSS & Visual Regression
- [ ] **Mobile SafeArea:** Bottom navigation must respect `pb-safe` (safe area inset) for iPhone users.
- [ ] **Z-Index Layering:**
    - `CaptureFlow` (Camera) = z-[100]
    - `AnalysisResultModal` = z-[110]
    - `CoachProxyBanner` = z-[60] (Sticky top)
    - `Navbar` / `MobileNav` = z-40
- [ ] **Animations:** Ensure `animate-fade-in` and `animate-slide-up` classes are present on modals for polish.
