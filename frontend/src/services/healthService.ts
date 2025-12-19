
import type { HealthStats } from '../types';

export type PlatformType = 'ios' | 'android' | 'web';

export const getPlatform = (): PlatformType => {
    const userAgent = navigator.userAgent || navigator.vendor;
    if (/android/i.test(userAgent)) return 'android';
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
    return 'web';
};

export const connectHealthProvider = async (platform: PlatformType): Promise<boolean> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`Connected to ${platform === 'ios' ? 'Apple Health' : platform === 'android' ? 'Health Connect' : 'Google Fit'}`);
            resolve(true);
        }, 1500);
    });
};

export const syncHealthData = async (): Promise<HealthStats> => {
    // Simulate fetching real data matching the user's provided Apple Health activity screenshot
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                steps: 1642,
                activeCalories: 65.3,
                restingCalories: 1414,
                distanceMiles: 0.69,
                flightsClimbed: 4,
                cardioScore: 78,
                hrv: 62,
                sleepMinutes: 440,
                lastSynced: new Date().toISOString()
            });
        }, 1200);
    });
};
