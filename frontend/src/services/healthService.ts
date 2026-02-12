
import type { HealthStats } from '../types';
import * as apiService from './apiService';

export type PlatformType = 'ios' | 'android' | 'web' | 'fitbit';

// FIX: Added helper functions for PKCE (Proof Key for Code Exchange) generation to satisfy OAuth2 requirements
function generateRandomString(length: number) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
        result += charset[values[i] % charset.length];
    }
    return result;
}

async function sha256(plain: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a: ArrayBuffer) {
    let str = "";
    const bytes = new Uint8Array(a);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export const getPlatform = (): PlatformType => {
    const userAgent = navigator.userAgent || navigator.vendor;
    if (/android/i.test(userAgent)) return 'android';
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
    return 'web';
};

export const connectHealthProvider = async (platform: PlatformType): Promise<boolean> => {
    if (platform === 'fitbit') {
        // FIX: Generated PKCE challenge and verifier to resolve "Expected 1 arguments, but got 0" for apiService.getFitbitAuthUrl
        const verifier = generateRandomString(128);
        const hashed = await sha256(verifier);
        const challenge = base64urlencode(hashed);
        
        // Save verifier locally to be retrieved during the callback/handshake phase
        localStorage.setItem('fitbit_code_verifier', verifier);

        const { url } = await apiService.getFitbitAuthUrl(challenge);
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
