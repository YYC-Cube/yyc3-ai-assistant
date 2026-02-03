import { LLMConfig } from './llm';
import { Message } from '@/hooks/useAI';

export interface CloudState {
    config: LLMConfig;
    messages: Message[];
}

export interface SyncResponse {
    success: boolean;
    timestamp: number;
    data?: CloudState;
    message?: string;
    errorType?: 'network' | 'cors' | 'server' | 'mixed-content' | 'unknown';
}

const DEFAULT_SERVER_URL = "http://8.152.195.33:7007"; 

// Export this helper so hooks can use it to stop intervals
export function isMixedContent(targetUrl?: string): boolean {
    if (!targetUrl) return false;
    if (typeof window === 'undefined') return false;
    return window.location.protocol === 'https:' && targetUrl.toLowerCase().startsWith('http:');
}

export async function syncPush(url: string, userId: string, data: CloudState): Promise<SyncResponse> {
    const targetUrl = url || DEFAULT_SERVER_URL;
    
    if (isMixedContent(targetUrl)) {
        // Silent return for push
        return { success: false, timestamp: 0, message: "Mixed Content", errorType: 'mixed-content' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); 

    try {
        const response = await fetch(`${targetUrl.replace(/\/$/, '')}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                payload: data,
                timestamp: Date.now()
            }),
            signal: controller.signal,
            mode: 'cors'
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            return { 
                success: false, 
                timestamp: 0, 
                message: `Server Error: ${response.status}`,
                errorType: 'server'
            };
        }
        return await response.json();
    } catch (e: any) {
        clearTimeout(timeoutId);
        // Only log actual network errors, not "Failed to fetch" which is expected in some envs
        if (!String(e).includes('Failed to fetch')) {
            console.warn("[Cloud Push]", e);
        }
        return { success: false, message: String(e), timestamp: 0, errorType: 'network' };
    }
}

export async function syncPull(url: string, userId: string): Promise<SyncResponse> {
    const targetUrl = url || DEFAULT_SERVER_URL;

    if (isMixedContent(targetUrl)) {
        // Silent return for pull
        return { success: false, timestamp: 0, message: "Mixed Content", errorType: 'mixed-content' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(`${targetUrl.replace(/\/$/, '')}/api/sync?userId=${userId}`, {
            signal: controller.signal,
            mode: 'cors'
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            return { 
                success: false, 
                timestamp: 0, 
                message: `Server Error: ${response.status}`,
                errorType: 'server'
            };
        }
        return await response.json();
    } catch (e: any) {
        clearTimeout(timeoutId);
        if (!String(e).includes('Failed to fetch')) {
             console.warn("[Cloud Pull]", e);
        }
        return { success: false, message: String(e), timestamp: 0, errorType: 'network' };
    }
}
