
export interface IntakeQuestion {
    id: string;
    text: string;
    type: 'text' | 'choice' | 'multiselect' | 'date' | 'number';
    options?: string[];
    section: string;
}

export const MEDICAL_INTAKE_QUESTIONS: IntakeQuestion[] = [
    // General Information
    { id: 'dob', text: 'What is your Date of Birth?', type: 'date', section: 'General' },
    { id: 'gender', text: 'What is your gender?', type: 'choice', options: ['Male', 'Female'], section: 'General' },
    { id: 'occupation', text: 'What is your current occupation?', type: 'text', section: 'General' },
    { id: 'primary_goal', text: 'What is your primary health goal for this visit?', type: 'text', section: 'Medical Questionnaire' },
    
    // Health Concerns
    { id: 'last_felt_well', text: 'When was the last time you felt truly well?', type: 'text', section: 'Health Concerns' },
    { id: 'triggers', text: 'Did something specific trigger your change in health?', type: 'text', section: 'Health Concerns' },
    { id: 'makes_better', text: 'What makes you feel better?', type: 'text', section: 'Health Concerns' },
    { id: 'makes_worse', text: 'What makes you feel worse?', type: 'text', section: 'Health Concerns' },

    // Allergies
    { id: 'allergies', text: 'Do you have any known allergies (Medication, Food, Environmental)?', type: 'text', section: 'Allergies' },

    // Medical History - Gastrointestinal
    { id: 'history_gi', text: 'Select any Gastrointestinal conditions you have:', type: 'multiselect', options: ['IBS', 'Crohns', 'GERD (Reflux)', 'Celiac Disease', 'Ulcerative Colitis', 'None'], section: 'Medical History' },
    
    // Medical History - Cardiovascular
    { id: 'history_cardio', text: 'Select any Cardiovascular conditions:', type: 'multiselect', options: ['Heart Attack', 'Stroke', 'High Blood Pressure', 'High Cholesterol', 'Arrhythmia', 'None'], section: 'Medical History' },

    // Medical History - Metabolic
    { id: 'history_metabolic', text: 'Select any Metabolic/Endocrine conditions:', type: 'multiselect', options: ['Type 1 Diabetes', 'Type 2 Diabetes', 'Hypothyroidism', 'PCOS', 'Weight Gain', 'None'], section: 'Medical History' },

    // Medical History - Other
    { id: 'history_immune', text: 'Select any Autoimmune/Inflammatory conditions:', type: 'multiselect', options: ['Chronic Fatigue', 'Lupus', 'Rheumatoid Arthritis', 'Eczema', 'Asthma', 'None'], section: 'Medical History' },

    // Lifestyle
    { id: 'diet_type', text: 'Are you on a special diet?', type: 'multiselect', options: ['None', 'Vegan', 'Keto', 'Gluten-Free', 'Dairy-Free', 'Low Sodium'], section: 'Social History' },
    { id: 'sleep_hours', text: 'Average hours of sleep per night?', type: 'number', section: 'Social History' },
    { id: 'stress_level', text: 'Rate your daily stress level (1-10):', type: 'number', section: 'Social History' },
    { id: 'alcohol', text: 'How many alcoholic drinks per week?', type: 'choice', options: ['None', '1-3', '4-6', '7-10', '>10'], section: 'Social History' },
    { id: 'smoking', text: 'Do you currently smoke?', type: 'choice', options: ['Yes', 'No'], section: 'Social History' },
    
    // Symptom Review
    { id: 'symptoms_gen', text: 'General Symptoms (Select all that apply):', type: 'multiselect', options: ['Fatigue', 'Cold Intolerance', 'Heat Intolerance', 'Insomnia', 'None'], section: 'Review of Systems' },
    { id: 'symptoms_digestion', text: 'Digestion Symptoms:', type: 'multiselect', options: ['Bloating', 'Constipation', 'Diarrhea', 'Heartburn', 'None'], section: 'Review of Systems' },
];
