
import type { HealthStats } from '../types';

export type PlatformType = 'ios' | 'android' | 'web' | 'fitbit';

export const getPlatform = (): PlatformType => {
    const userAgent = navigator.userAgent || navigator.vendor;
    if (/android/i.test(userAgent)) return 'android';
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
    return 'web';
};

export const connectHealthProvider = async (platform: PlatformType): Promise<boolean> => {
    if (platform === 'fitbit') {
        // Simulate a popup or redirect logic
        console.log("Initializing Fitbit OAuth flow...");
    }
    
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`Connected to ${platform}`);
            resolve(true);
        }, 1500);
    });
};

export const syncHealthData = async (source: 'apple' | 'fitbit' = 'apple'): Promise<Partial<HealthStats>> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (source === 'apple') {
                // APPLE HEALTH SOURCE OF TRUTH
                // Focus: Clinical Vitals, Body Composition, Mindfulness, Hydration
                resolve({
                    bloodPressureSystolic: 120,
                    bloodPressureDiastolic: 80,
                    bodyFatPercentage: 22.5,
                    bmi: 24.1,
                    weightLbs: 175.5,
                    mindfulnessMinutes: 15,
                    waterFlOz: 32, // Often logged via apps writing to HealthKit
                    vo2Max: 45 // Apple Watch Cardio Fitness
                });
            } else {
                // FITBIT SOURCE OF TRUTH
                // Focus: Daily Activity, Sleep, Continuous Heart Rate
                resolve({
                    steps: 8432,
                    activeCalories: 450,
                    restingCalories: 1600,
                    distanceMiles: 3.2,
                    flightsClimbed: 12,
                    heartRate: 72,
                    restingHeartRate: 60,
                    hrv: 55,
                    sleepMinutes: 450,
                    sleepScore: 85,
                    activeZoneMinutes: 45,
                    spo2: 98
                });
            }
        }, 2000);
    });
};
