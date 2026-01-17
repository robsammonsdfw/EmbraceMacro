
export interface IntakeQuestion {
    id: string;
    text: string;
    type: 'text' | 'choice' | 'multiselect' | 'date' | 'number' | 'scale';
    options?: string[];
    section: string;
    subtext?: string; // For additional instructions like "0=Never, 4=Severe"
}

// Grouping helper to ensure consistent section names
export const SECTIONS = {
    GENERAL: 'General Information',
    PHARMACY: 'Pharmacy & Goals',
    HISTORY: 'Medical History',
    LIFESTYLE: 'Lifestyle & Social',
    WOMENS: "Women's Health",
    MENS: "Men's Health",
    MEDS: 'Medications & Supplements',
    FAMILY: 'Family History',
    ENVIRONMENT: 'Environment & Exposures',
    MSQ: 'Toxicity Questionnaire (MSQ)',
    SYMPTOMS: 'Symptom Review'
};

export const MEDICAL_INTAKE_QUESTIONS: IntakeQuestion[] = [
    // --- 1. GENERAL INFORMATION (Page 1) ---
    { id: 'gen_firstname', text: 'First Name', type: 'text', section: SECTIONS.GENERAL },
    { id: 'gen_lastname', text: 'Last Name', type: 'text', section: SECTIONS.GENERAL },
    { id: 'gen_dob', text: 'Date of Birth', type: 'date', section: SECTIONS.GENERAL },
    { id: 'gen_gender', text: 'Gender', type: 'choice', options: ['Male', 'Female'], section: SECTIONS.GENERAL },
    { id: 'gen_height', text: 'Height (e.g., 5\'9")', type: 'text', section: SECTIONS.GENERAL },
    { id: 'gen_weight', text: 'Current Weight (lbs)', type: 'number', section: SECTIONS.GENERAL },
    { id: 'gen_occupation', text: 'Occupation', type: 'text', section: SECTIONS.GENERAL },
    { id: 'gen_address', text: 'Home Address', type: 'text', section: SECTIONS.GENERAL },
    { id: 'gen_emergency_contact', text: 'Emergency Contact Name & Phone', type: 'text', section: SECTIONS.GENERAL },
    { id: 'gen_physician', text: 'Primary Care Physician', type: 'text', section: SECTIONS.GENERAL },

    // --- 2. PHARMACY & GOALS (Page 2) ---
    { id: 'pharm_name', text: 'Primary Pharmacy Name', type: 'text', section: SECTIONS.PHARMACY },
    { id: 'pharm_phone', text: 'Pharmacy Phone Number', type: 'text', section: SECTIONS.PHARMACY },
    { id: 'goal_expectations', text: 'What are your expectations and goals for this visit?', type: 'text', section: SECTIONS.PHARMACY },
    { id: 'health_last_well', text: 'When was the last time you felt well?', type: 'text', section: SECTIONS.PHARMACY },
    { id: 'health_trigger', text: 'Did something trigger your change in health?', type: 'text', section: SECTIONS.PHARMACY },
    { id: 'health_better', text: 'What makes you feel better?', type: 'text', section: SECTIONS.PHARMACY },
    { id: 'health_worse', text: 'What makes you feel worse?', type: 'text', section: SECTIONS.PHARMACY },
    { id: 'allergies', text: 'List any Allergies (Medication/Food/Environment) and Reactions:', type: 'text', section: SECTIONS.PHARMACY },

    // --- 3. MEDICAL HISTORY (Page 3-4) ---
    { id: 'hist_gi', text: 'Gastrointestinal Conditions', type: 'multiselect', section: SECTIONS.HISTORY, options: ['IBS', 'IBD', 'Crohns', 'Ulcerative Colitis', 'GERD/Reflux', 'Celiac', 'Ulcers', 'None'] },
    { id: 'hist_cardio', text: 'Cardiovascular Conditions', type: 'multiselect', section: SECTIONS.HISTORY, options: ['Heart Attack', 'Stroke', 'High BP', 'High Cholesterol', 'Arrhythmia', 'Murmur', 'None'] },
    { id: 'hist_metabolic', text: 'Metabolic/Endocrine Conditions', type: 'multiselect', section: SECTIONS.HISTORY, options: ['Type 1 Diabetes', 'Type 2 Diabetes', 'Hypoglycemia', 'Metabolic Syndrome', 'Hypothyroid', 'Hyperthyroid', 'PCOS', 'Weight Gain', 'Infertility', 'None'] },
    { id: 'hist_immune', text: 'Inflammatory/Autoimmune', type: 'multiselect', section: SECTIONS.HISTORY, options: ['Chronic Fatigue', 'Rheumatoid Arthritis', 'Lupus', 'Immune Deficiency', 'Food Allergies', 'Environmental Allergies', 'None'] },
    { id: 'hist_resp', text: 'Respiratory Diseases', type: 'multiselect', section: SECTIONS.HISTORY, options: ['Asthma', 'Bronchitis', 'Emphysema', 'Pneumonia', 'Sleep Apnea', 'None'] },
    { id: 'hist_skin', text: 'Skin Diseases', type: 'multiselect', section: SECTIONS.HISTORY, options: ['Eczema', 'Psoriasis', 'Acne', 'Melanoma', 'Skin Cancer', 'None'] },
    { id: 'hist_neuro', text: 'Neurologic/Mood', type: 'multiselect', section: SECTIONS.HISTORY, options: ['Depression', 'Anxiety', 'Bipolar', 'Schizophrenia', 'Headaches', 'Migraines', 'ADD/ADHD', 'Autism', 'Memory Problems', 'Seizures', 'None'] },
    { id: 'hist_surgery', text: 'List any surgeries and years performed:', type: 'text', section: SECTIONS.HISTORY },
    { id: 'hist_hospital', text: 'List any hospitalizations (Date & Reason):', type: 'text', section: SECTIONS.HISTORY },

    // --- 4. WOMEN'S HEALTH (Page 5) ---
    { id: 'fem_menses_freq', text: 'Menses Frequency', type: 'text', section: SECTIONS.WOMENS },
    { id: 'fem_menses_pain', text: 'Do you experience painful periods?', type: 'choice', options: ['Yes', 'No'], section: SECTIONS.WOMENS },
    { id: 'fem_contraception', text: 'Use of Contraception?', type: 'multiselect', options: ['None', 'Condom', 'Pill', 'IUD', 'Patch', 'Ring', 'Partner Vasectomy'], section: SECTIONS.WOMENS },
    { id: 'fem_conditions', text: 'Women\'s Disorders/Imbalances', type: 'multiselect', options: ['Fibrocystic Breasts', 'Endometriosis', 'Fibroids', 'Infertility', 'PMS', 'Heavy Periods', 'None'], section: SECTIONS.WOMENS },
    { id: 'fem_menopause', text: 'Are you in menopause?', type: 'choice', options: ['Yes', 'No', 'Peri-menopause'], section: SECTIONS.WOMENS },
    { id: 'fem_symptoms', text: 'Hormonal Symptoms', type: 'multiselect', options: ['Hot Flashes', 'Mood Swings', 'Vaginal Dryness', 'Low Libido', 'Weight Gain', 'None'], section: SECTIONS.WOMENS },
    { id: 'fem_preg', text: 'Number of Pregnancies', type: 'number', section: SECTIONS.WOMENS },

    // --- 5. MEN'S HEALTH (Page 5) ---
    { id: 'male_psa', text: 'Have you had a PSA test?', type: 'choice', options: ['Yes', 'No'], section: SECTIONS.MENS },
    { id: 'male_prostate', text: 'Prostate History', type: 'multiselect', options: ['Enlargement', 'Infection', 'None'], section: SECTIONS.MENS },
    { id: 'male_symptoms', text: 'Symptoms', type: 'multiselect', options: ['Low Libido', 'Impotence', 'ED', 'Urgency', 'Hesitancy', 'None'], section: SECTIONS.MENS },
    { id: 'male_nocturia', text: 'Times waking at night to urinate?', type: 'number', section: SECTIONS.MENS },

    // --- 6. MEDS & SUPPS (Page 5-6) ---
    { id: 'meds_list', text: 'List current medications (Name, Dosage, Frequency):', type: 'text', section: SECTIONS.MEDS },
    { id: 'supps_list', text: 'List current supplements/vitamins:', type: 'text', section: SECTIONS.MEDS },
    { id: 'meds_antibiotics', text: 'How often have you taken antibiotics?', type: 'choice', options: ['<5 times', '>5 times', 'Frequent use in childhood'], section: SECTIONS.MEDS },
    { id: 'meds_nsaids', text: 'Prolonged use of NSAIDs (Advil, Motrin)?', type: 'choice', options: ['Yes', 'No'], section: SECTIONS.MEDS },

    // --- 7. FAMILY HISTORY (Page 7) ---
    // Simplified grid approach
    { id: 'fam_mother', text: 'Mother: List any significant conditions (Cancer, Heart, Diabetes, etc.)', type: 'text', section: SECTIONS.FAMILY },
    { id: 'fam_father', text: 'Father: List any significant conditions', type: 'text', section: SECTIONS.FAMILY },
    { id: 'fam_siblings', text: 'Siblings: List any significant conditions', type: 'text', section: SECTIONS.FAMILY },
    { id: 'fam_grandparents', text: 'Grandparents: List any significant conditions', type: 'text', section: SECTIONS.FAMILY },

    // --- 8. LIFESTYLE (Page 8-10) ---
    { id: 'life_diet', text: 'Are you on a special diet?', type: 'multiselect', options: ['None', 'Vegan', 'Vegetarian', 'Keto', 'Gluten-Free', 'Dairy-Free', 'Low Sodium', 'Low Carb'], section: SECTIONS.LIFESTYLE },
    { id: 'life_cravings', text: 'Do you crave any foods?', type: 'text', section: SECTIONS.LIFESTYLE },
    { id: 'life_alcohol', text: 'Alcohol consumption per week?', type: 'choice', options: ['None', '1-3 drinks', '4-6 drinks', '7-10 drinks', '>10 drinks'], section: SECTIONS.LIFESTYLE },
    { id: 'life_smoke', text: 'Do you smoke?', type: 'choice', options: ['Never', 'Past smoker', 'Current smoker'], section: SECTIONS.LIFESTYLE },
    { id: 'life_exercise', text: 'Do you exercise regularly?', type: 'choice', options: ['Yes', 'No'], section: SECTIONS.LIFESTYLE },
    { id: 'life_exercise_type', text: 'What type of exercise?', type: 'text', section: SECTIONS.LIFESTYLE },
    { id: 'life_stress', text: 'Rate your stress (1-10)', type: 'number', section: SECTIONS.LIFESTYLE },
    { id: 'life_sleep', text: 'Average hours of sleep?', type: 'number', section: SECTIONS.LIFESTYLE },
    { id: 'life_sleep_trouble', text: 'Trouble falling or staying asleep?', type: 'choice', options: ['None', 'Falling asleep', 'Staying asleep', 'Both'], section: SECTIONS.LIFESTYLE },

    // --- 9. ENVIRONMENT (Page 11) ---
    { id: 'env_sensitivities', text: 'Known food reactions/sensitivities?', type: 'choice', options: ['Yes', 'No'], section: SECTIONS.ENVIRONMENT },
    { id: 'env_react_list', text: 'Check adverse reactions to:', type: 'multiselect', options: ['MSG', 'Aspartame', 'Caffeine', 'Bananas', 'Garlic', 'Onion', 'Cheese', 'Citrus', 'Chocolate', 'Alcohol', 'Preservatives', 'None'], section: SECTIONS.ENVIRONMENT },
    { id: 'env_exposures', text: 'Exposure to toxins?', type: 'multiselect', options: ['Mold', 'Chemicals', 'Radiation', 'Herbicides', 'Pesticides', 'Heavy Metals', 'None'], section: SECTIONS.ENVIRONMENT },

    // --- 10. MSQ (Page 12) --- 
    // Simplified into groups for UI sanity, using scale type
    { id: 'msq_head', text: 'Head Symptoms (Headaches, Faintness, Dizziness, Insomnia)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_eyes', text: 'Eye Symptoms (Watery, Swollen, Blurred, Dark Circles)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_ears', text: 'Ear Symptoms (Itchy, Earaches, Drainage, Ringing)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_nose', text: 'Nose Symptoms (Stuffy, Sinus, Hay Fever, Sneezing)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_mouth', text: 'Mouth/Throat (Coughing, Gagging, Sore Throat)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_skin', text: 'Skin (Acne, Hives, Rashes, Hair Loss, Flushing)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_heart', text: 'Heart (Irregular beat, Rapid beat, Chest pain)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_lungs', text: 'Lungs (Congestion, Asthma, Shortness of breath)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_digestive', text: 'Digestive (Nausea, Diarrhea, Constipation, Bloating, Heartburn)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_energy', text: 'Energy (Fatigue, Lethargy, Hyperactivity)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_mind', text: 'Mind (Poor memory, Confusion, Concentration, Coordination)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },
    { id: 'msq_emotions', text: 'Emotions (Mood swings, Anxiety, Fear, Anger)', type: 'scale', subtext: '0=Never, 4=Severe', section: SECTIONS.MSQ },

    // --- 11. SYMPTOM REVIEW (Page 13-14) ---
    { id: 'sym_general', text: 'General Symptoms', type: 'multiselect', options: ['Cold Hands/Feet', 'Cold Intolerance', 'Low Body Temp', 'Daytime Sleepiness', 'Night Waking', 'Fatigue', 'None'], section: SECTIONS.SYMPTOMS },
    { id: 'sym_head', text: 'Head/Eyes/Ears', type: 'multiselect', options: ['Conjunctivitis', 'Distorted Smell', 'Distorted Taste', 'Ear Fullness', 'Ringing in Ears', 'Vision Problems', 'Migraine', 'None'], section: SECTIONS.SYMPTOMS },
    { id: 'sym_digestion', text: 'Digestion', type: 'multiselect', options: ['Bad Breath', 'Bleeding Gums', 'Bloating', 'Heartburn', 'Gas', 'Indigestion', 'Nausea', 'Diarrhea', 'Constipation', 'None'], section: SECTIONS.SYMPTOMS },
    { id: 'sym_eating', text: 'Eating', type: 'multiselect', options: ['Binge Eating', 'Bulimia', 'Can\'t Gain Weight', 'Can\'t Lose Weight', 'Poor Appetite', 'Salt Cravings', 'Carb Cravings', 'None'], section: SECTIONS.SYMPTOMS },
    { id: 'sym_skin', text: 'Skin Problems', type: 'multiselect', options: ['Acne', 'Cellulite', 'Dark Circles', 'Easy Bruising', 'Eczema', 'Hives', 'Oily Skin', 'Dry Skin', 'None'], section: SECTIONS.SYMPTOMS },
    { id: 'sym_respiratory', text: 'Respiratory', type: 'multiselect', options: ['Bad Breath', 'Cough', 'Hoarseness', 'Sore Throat', 'Hay Fever', 'Nasal Stuffiness', 'Sinus Infection', 'None'], section: SECTIONS.SYMPTOMS },
    { id: 'sym_cardio', text: 'Cardiovascular', type: 'multiselect', options: ['Angina/Chest Pain', 'Breathlessness', 'Heart Murmur', 'Irregular Pulse', 'Palpitations', 'Phlebitis', 'Varicose Veins', 'None'], section: SECTIONS.SYMPTOMS },
    { id: 'sym_urinary', text: 'Urinary', type: 'multiselect', options: ['Bed Wetting', 'Hesitancy', 'Infection', 'Kidney Disease', 'Leaking', 'Pain/Burning', 'Prostate Infection', 'Urgency', 'None'], section: SECTIONS.SYMPTOMS },
];
