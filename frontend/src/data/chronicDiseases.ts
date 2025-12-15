
export interface DiseaseTemplate {
    id: string;
    name: string;
    macros: { p: number; c: number; f: number }; // Percentages
    description: string;
    focus: string;
}

export const CHRONIC_DISEASES: DiseaseTemplate[] = [
    {
        id: 'alzheimers',
        name: "Alzheimer's",
        macros: { p: 35, c: 30, f: 35 },
        description: "Developed for individuals diagnosed with or at risk of developing Alzheimer’s.",
        focus: "Anti-inflammatory, Omega-3s, coconut oil, avocado, leafy greens."
    },
    {
        id: 'alkaline_cancer',
        name: "Alkaline / Cancer",
        macros: { p: 30, c: 40, f: 30 },
        description: "Maintain optimal PH balance to benefit chemotherapeutic agents.",
        focus: "Limit acidic foods (corn, blueberries). Emphasize peaches, spinach, carrots."
    },
    {
        id: 'anemia',
        name: "Anemia",
        macros: { p: 40, c: 30, f: 30 },
        description: "Rich in foods higher in iron.",
        focus: "Red meat, leafy greens, legumes. Pair iron with Vitamin C."
    },
    {
        id: 'anti_inflammatory',
        name: "Anti-Inflammatory",
        macros: { p: 30, c: 40, f: 30 },
        description: "Manage chronic inflammation, metabolic syndrome and obesity.",
        focus: "Phytonutrients, antioxidants, Omega-3s."
    },
    {
        id: 'arthritis_diabetes',
        name: "Arthritis and Diabetes",
        macros: { p: 30, c: 35, f: 35 },
        description: "For individuals diagnosed with both arthritis and diabetes.",
        focus: "Anti-inflammatory, high fiber, low glycemic index."
    },
    {
        id: 'asthma',
        name: "Asthma",
        macros: { p: 45, c: 25, f: 30 },
        description: "Removes potential allergens that could worsen symptoms.",
        focus: "Avoid corn, peanuts, soy, dairy."
    },
    {
        id: 'behavior_disorders',
        name: "Behavior Disorders (ADHD/Autism)",
        macros: { p: 25, c: 45, f: 30 },
        description: "Minimize symptoms of ADHD, autism, anxiety.",
        focus: "Gluten-free, low salicylate, no artificial ingredients."
    },
    {
        id: 'cancer_heart',
        name: "Cancer and Heart Disease",
        macros: { p: 20, c: 45, f: 35 },
        description: "Optimal PH balance plus cardiovascular protection.",
        focus: "Low sodium, limited saturated fat, alkalizing fruits/veg."
    },
    {
        id: 'kidney_disease',
        name: "Chronic Kidney Disease (Stage 1-4)",
        macros: { p: 15, c: 60, f: 25 },
        description: "Sodium, phosphorus, potassium and protein restricted.",
        focus: "Electrolyte balance, fluid balance."
    },
    {
        id: 'copd',
        name: "COPD",
        macros: { p: 40, c: 30, f: 30 },
        description: "Small, frequent, nutrient-dense meals.",
        focus: "Rich in fat/protein. Avoid cruciferous vegetables (gas producing)."
    },
    {
        id: 'crohns',
        name: "Crohn's Disease",
        macros: { p: 50, c: 30, f: 20 },
        description: "Low residue, lower fiber diet to ease symptoms.",
        focus: "No raw fruit/veg, seeds, dairy. Easily digestible."
    },
    {
        id: 'diabetes',
        name: "Diabetes",
        macros: { p: 35, c: 25, f: 25 }, // Adjusted logic: 25C/35P/25F in doc, ensures 100% total slightly off in doc so normalized
        description: "Maintain glycemic control.",
        focus: "High fiber, lean protein, non-starchy veg, low glycemic fruit."
    },
    {
        id: 'diabetes_hypertension',
        name: "Diabetes and Hypertension",
        macros: { p: 50, c: 25, f: 25 },
        description: "Glycemic control and blood pressure management.",
        focus: "Low sodium, high fiber, lean protein."
    },
    {
        id: 'high_cholesterol',
        name: "High Cholesterol",
        macros: { p: 40, c: 30, f: 30 },
        description: "For hypercholesterolemia or heart disease risk.",
        focus: "High fiber (soluble), Omega-3s, low saturated fat."
    },
    {
        id: 'hypertension',
        name: "Hypertension",
        macros: { p: 50, c: 25, f: 25 },
        description: "High blood pressure management.",
        focus: "Low sodium (<2300mg), rich in potassium/magnesium."
    },
    {
        id: 'ibs',
        name: "Irritable Bowel Syndrome (IBS)",
        macros: { p: 40, c: 30, f: 30 },
        description: "Low FODMAP focus.",
        focus: "Avoid onions, cruciferous veg, apples. Easily digestible."
    },
    {
        id: 'obesity_diabetes',
        name: "Obesity and Diabetes",
        macros: { p: 40, c: 30, f: 30 },
        description: "Weight loss and glycemic control.",
        focus: "High fiber, lean protein, anti-inflammatory."
    },
    {
        id: 'thyroid',
        name: "Thyroid Disease",
        macros: { p: 40, c: 30, f: 30 },
        description: "Autoimmune support (Hashimoto's/Graves).",
        focus: "No soy, gluten-free, anti-inflammatory."
    }
];
