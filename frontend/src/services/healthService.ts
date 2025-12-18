
import type { HealthStats } from '../types';

export type PlatformType = 'ios' | 'android' | 'web';

export const getPlatform = (): PlatformType => {
    const userAgent = navigator.userAgent || navigator.vendor;
    if (/android/i.test(userAgent)) return 'android';
    // Check for iPad, iPhone, iPod
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
    return 'web';
};

export const connectHealthProvider = async (platform: PlatformType): Promise<boolean> => {
    // Simulate API call to request permissions and link accounts
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`Connected to ${platform === 'ios' ? 'Apple Health' : platform === 'android' ? 'Health Connect' : 'Google Fit'}`);
            resolve(true);
        }, 1500);
    });
};

export const syncHealthData = async (): Promise<HealthStats> => {
    // Simulate fetching data from the connected provider
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                steps: 8432,
                activeCalories: 450,
                cardioScore: 78,
                hrv: 62, // Added simulated HRV
                sleepMinutes: 440, // Added simulated sleep (7.3 hrs)
                lastSynced: new Date().toISOString()
            });
        }, 1200);
    });
};
