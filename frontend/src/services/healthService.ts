
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
        alert("Redirecting to Fitbit for authorization... (Simulation)");
        // Simulate a popup or redirect
        window.open('https://www.fitbit.com/login', '_blank', 'width=500,height=600');
    }
    
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`Connected to ${platform}`);
            resolve(true);
        }, 2000);
    });
};

export const syncHealthData = async (source: 'apple' | 'fitbit' = 'apple'): Promise<Partial<HealthStats>> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (source === 'apple') {
                // CALIBRATED to user's screenshots
                resolve({
                    steps: 1642,
                    activeCalories: 65.3,
                    restingCalories: 1414,
                    distanceMiles: 0.69,
                    flightsClimbed: 4,
                    heartRate: 73, // From Heart screenshot
                    restingHeartRate: 64,
                    hrv: 62,
                    sleepMinutes: 440,
                    sleepScore: 84,
                    vo2Max: 42.5,
                    mindfulnessMinutes: 10,
                    waterFlOz: 24,
                    // Specific Values from User Screenshots:
                    bloodPressureSystolic: 149, // From Heart screenshot
                    bloodPressureDiastolic: 92, // From Heart screenshot
                    bodyFatPercentage: 25.8, // From Body Measurements screenshot
                    bmi: 31.3, // From Body Measurements screenshot
                    weightLbs: 231.7 // From Body Measurements screenshot
                });
            } else {
                // Fitbit specific metrics
                resolve({
                    steps: 5800, 
                    activeCalories: 145.5,
                    restingCalories: 1550,
                    distanceMiles: 2.1,
                    flightsClimbed: 2, 
                    heartRate: 85, 
                    restingHeartRate: 61,
                    hrv: 68,
                    sleepMinutes: 420,
                    sleepScore: 78,
                    activeZoneMinutes: 22,
                    spo2: 97.5,
                    waterFlOz: 48,
                    weightLbs: 240
                });
            }
        }, 1500);
    });
};
