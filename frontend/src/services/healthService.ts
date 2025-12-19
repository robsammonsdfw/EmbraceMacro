
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
                // Typical Apple Health daily snapshot
                resolve({
                    steps: 1642,
                    activeCalories: 65.3,
                    restingCalories: 1414,
                    distanceMiles: 0.69,
                    flightsClimbed: 4,
                    heartRate: 72,
                    hrv: 62,
                    sleepMinutes: 440
                });
            } else {
                // Simulate Fitbit having MORE steps/HR but potentially LESS of other metrics
                // This will trigger the "GREATEST" logic in the database
                resolve({
                    steps: 5800, // Significantly higher than Apple
                    activeCalories: 145.5,
                    restingCalories: 1550,
                    distanceMiles: 2.1,
                    flightsClimbed: 2, // Lower than Apple, so Apple's '4' should persist via GREATEST
                    heartRate: 85, // Peak HR or current
                    hrv: 68,
                    sleepMinutes: 420
                });
            }
        }, 1500);
    });
};
