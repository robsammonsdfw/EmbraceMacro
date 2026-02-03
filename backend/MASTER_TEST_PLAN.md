
# Master Regression Test Plan
**Application:** EmbraceHealth AI
**Version:** 1.0 (Baseline)

Use this checklist to validate system integrity after any code update.

---

## 1. Core System & Auth
- [ ] **Login:** User can log in via Email/Password (simulated or real).
- [ ] **JWT Session:** Token persists on refresh; user stays logged in.
- [ ] **Navigation:** 
    - [ ] Sidebar works on Desktop.
    - [ ] Bottom Bar works on Mobile.
    - [ ] Mobile Menu (Hamburger) opens full sidebar.
- [ ] **Hub Switching:** "Switch App" button returns to the Main Hub (Central Intelligence).
- [ ] **Logout:** Clears token and redirects to Login.

---

## 2. Dashboard (Command Center)
- [ ] **Greeting:** Displays correct time-of-day greeting (Morning/Evening) and User Name.
- [ ] **Health Wallet Pill:** Displays total points and cash value equivalent.
- [ ] **Digital Twin:** 
    - [ ] Renders 3 rings (Calories, Protein, Activity).
    - [ ] Updates dynamically based on daily logs.
- [ ] **Quick Actions Row:** All 5 buttons (Photo, Scan, Pantry, Recipe, Upload) open the Capture Flow.
- [ ] **Vitals Strip:**
    - [ ] Displays selected widgets (Steps, Calories, etc.).
    - [ ] "Sync Apple/Fitbit" buttons trigger sync simulation.
- [ ] **Community Feed:** Shows recent activity from friends (or placeholder if empty).

---

## 3. ChefGPT / Capture Flow
- [ ] **MacrosChef (Photo):** Takes/Uploads photo -> Returns Nutrition Info (Cals/Macros) -> Save to History.
- [ ] **Barcode Engine:** Opens Scanner -> Scans Code -> Returns Product Info (OpenFoodFacts) -> Save.
- [ ] **PantryChef:** Takes Photo of ingredients -> Returns 3 Recipe Suggestions -> Save Recipe.
- [ ] **MasterChef:** Takes Photo of cooked meal -> Returns Reconstruction Recipe -> Save.
- [ ] **Manual Search:** Text input -> Returns Nutrition Info -> Save.
- [ ] **Restaurant Locator:** "MasterChef" mode auto-detects geolocation -> Lists nearby restaurants.

---

## 4. Meal Planning & Library
- [ ] **Library List:** Displays saved meals with images/icons.
- [ ] **Filtering:** Search bar works; "High Protein" / "Low Carb" filters update list.
- [ ] **Meal Detail Modal:** Clicking a meal shows full macros/ingredients.
- [ ] **Planning Drag & Drop:** Can drag a meal from Library sidebar to a specific Plan Slot (Breakfast/Lunch/etc).
- [ ] **Medical AI Planner:** 
    - [ ] Modal opens.
    - [ ] Disease selection works (Diabetes, etc.).
    - [ ] "Generate Plan" creates entries in the schedule.
- [ ] **Add to Plan Modal:** "Log Meal" button allows manual entry of Day/Slot/Portion.

---

## 5. Grocery Hub
- [ ] **List Management:** Create new list, Delete list, Switch active list.
- [ ] **Manual Add:** Type item name -> Adds to list.
- [ ] **Camera Add:** Snap photo of items/receipt -> AI identifies items -> Adds to list.
- [ ] **Import:** Select Meal Plan -> Imports ingredients automatically.
- [ ] **Export:** "Instacart" and "AmazonFresh" buttons open external links with query params.
- [ ] **Interactions:** Check off items, "Clear Checked", "Purge List".

---

## 6. History (Timeline)
- [ ] **Timeline View:** Logs grouped by Date.
- [ ] **Entry Actions:** 
    - [ ] "Plan" button opens AddToPlan modal.
    - [ ] "Save" button saves to Library.
    - [ ] "Photo" button opens Image Viewer modal.

---

## 7. Recipe & Cook Mode
- [ ] **Recipe Card:** Displays ingredients and instructions.
- [ ] **Cook Mode:** Opens full-screen modal.
    - [ ] Next/Prev steps work.
    - [ ] Font size (A+/A-) toggles work.
    - [ ] Ingredient sidebar is visible.

---

## 8. Body Hub (Physical Intelligence)
- [ ] **Metrics Display:** Shows current biometrics (Weight, HRV, Sleep).
- [ ] **Widget Config:** "Dashboard Widgets" button allows selecting top 3 metrics.
- [ ] **Readiness Score:** Calculates score based on Sleep + HRV inputs.
- [ ] **Log Biometrics:** Form allows updating Sleep/HRV manually.
- [ ] **AI Form Check:** 
    - [ ] Camera opens.
    - [ ] Analyzes movement (simulated/vision API).
    - [ ] Returns Score + Feedback overlay.
- [ ] **Prism Scan:** Button links to external 3D scan URL.

---

## 9. Social Hub
- [ ] **Privacy Toggle:** Switch between Public/Private profile.
- [ ] **Friend List:** Displays accepted friends.
- [ ] **Invite:** Send request via email.
- [ ] **Requests:** Accept/Reject incoming friend requests.

---

## 10. Professional Suite (Coaching)
- [ ] **Mode Switching:** Tabs for "My Practice" (Coach) vs "My Care Team" (Patient).
- [ ] **Coach Actions:**
    - [ ] Invite Client by email.
    - [ ] View Roster.
    - [ ] Revoke Client access.
- [ ] **Client Actions:**
    - [ ] Accept/Decline Coach requests.
    - [ ] View authorized coaches.
- [ ] **Proxy Mode:**
    - [ ] Coach can "Enter" a client's profile.
    - [ ] Yellow "Proxy Mode Active" banner appears.
    - [ ] Actions taken (logging meals) are attributed to proxy.

---

## 11. Assessments & Labs
- [ ] **Assessment Hub:** Lists available tests.
- [ ] **Daily Pulse:** Can submit mood/status.
- [ ] **Test Runner:** Multi-step questionnaire UI works (Next/Finish).
- [ ] **Passive Pulse:** Dashboard prompts ("Did you eat enough protein?") submit successfully.
- [ ] **Labs:** View dummy lab results (CMP, Lipid Panel).

---

## 12. Settings & Goals
- [ ] **Goal Wizard:** 
    - [ ] Inputs for Age/Gender/Activity.
    - [ ] Unit toggle (Metric/Imperial).
    - [ ] Calculates TDEE & Protein Goal.
    - [ ] Saves to Dashboard preferences.

---

## 13. Backend / API Integrity
- [ ] **Social Endpoints:** `/social/*` responding.
- [ ] **Coaching Endpoints:** `/coaching/*` responding.
- [ ] **Body Endpoints:** `/body/*` and `/analyze-form` responding.
- [ ] **Grocery Analysis:** `/analyze-image-grocery` responding.
- [ ] **Restaurant Search:** `/search-restaurants` responding (Maps Grounding).
- [ ] **Assessments:** `/assessments/*` responding.
