
import type { HealthStats } from '../types';

export type PlatformType = 'ios' | 'android' | 'web' | 'fitbit';

export const getPlatform = (): PlatformType => {
    const userAgent = navigator.userAgent || navigator.vendor;
    if (/android/i.test(userAgent)) return 'android';
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
    return 'web';
};

export const connectHealthProvider = async (platform: PlatformType): Promise<boolean> => {
    // These will eventually trigger real OAuth redirect flows
    if (platform === 'fitbit') {
        console.log("Redirecting to Fitbit OAuth...");
    }
    if (platform === 'ios') {
        console.log("Checking Apple Health Bridge...");
    }
    
    return true; // Simplified for UI navigation, real logic would await the redirect/bridge
};

export const syncHealthData = async (source: 'apple' | 'fitbit' = 'apple'): Promise<Partial<HealthStats>> => {
    // NO DUMMY DATA.
    // In a browser context, we cannot directly access Apple Health without a Native Bridge (Swift/Kotlin).
    // We return an empty object or throw if not handled by Vision Sync.
    console.warn(`Direct ${source} sync is pending API credential configuration. Please use Vision Sync.`);
    return {};
};
