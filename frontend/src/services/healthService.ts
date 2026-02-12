
import type { HealthStats } from '../types';
import * as apiService from './apiService';

export type PlatformType = 'ios' | 'android' | 'web' | 'fitbit';

export const getPlatform = (): PlatformType => {
    const userAgent = navigator.userAgent || navigator.vendor;
    if (/android/i.test(userAgent)) return 'android';
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
    return 'web';
};

export const connectHealthProvider = async (platform: PlatformType): Promise<boolean> => {
    if (platform === 'fitbit') {
        const { url } = await apiService.getFitbitAuthUrl();
        // Redirect the user to Fitbit's authorization page
        window.location.href = url;
        return true;
    }
    
    if (platform === 'ios') {
        console.log("Checking Apple Health Bridge...");
        // Native Bridge call would go here
    }
    
    return true; 
};

export const syncHealthData = async (source: 'apple' | 'fitbit' = 'apple'): Promise<Partial<HealthStats>> => {
    if (source === 'fitbit') {
        return await apiService.syncWithFitbit();
    }
    
    console.warn(`Direct ${source} sync is pending native implementation. Please use Vision Sync.`);
    return {};
};
