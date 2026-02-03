import { LLMConfig } from './llm';

// Simple cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

// Memory Entry Interface
export interface MemoryEntry {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    embedding?: number[]; 
    timestamp: number;
}

// 1. Get Embedding
export async function getEmbedding(text: string, config: LLMConfig): Promise<number[] | null> {
    try {
        let url = '';
        let headers: Record<string, string> = { 'Content-Type': 'application/json' };
        let body: any = {};

        if (config.provider === 'ollama') {
            url = `${config.baseUrl.replace(/\/$/, '')}/api/embeddings`;
            body = { model: config.model, prompt: text }; // Ollama uses 'prompt'
        } else if (config.provider === 'openai' || config.provider === 'deepseek') {
            let baseUrl = config.baseUrl.replace(/\/$/, '');
            if (!baseUrl.endsWith('/v1')) baseUrl += '/v1';
            url = `${baseUrl}/embeddings`;
            headers['Authorization'] = `Bearer ${config.apiKey}`;
            body = { input: text, model: 'text-embedding-3-small' }; // Default to a common embedding model
        } else {
            return null; 
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();
        
        if (config.provider === 'ollama') {
            return data.embedding;
        } else {
            return data.data?.[0]?.embedding || null;
        }
    } catch (e) {
        // Silently fail for embeddings to prevent log spam during "Failed to fetch" scenarios
        // Only log if it's NOT a mixed content / network error which we expect in some envs
        const errStr = String(e);
        if (!errStr.includes('Failed to fetch') && !errStr.includes('NetworkError')) {
             console.warn("[RAG] Embedding failed:", e);
        }
        return null;
    }
}

// 2. Retrieve Context
export async function retrieveContext(
    query: string, 
    memories: MemoryEntry[], 
    config: LLMConfig,
    topK: number = 3
): Promise<string> {
    // If no memories or not enough data, return empty
    if (memories.length < 5) return "";

    // Generate embedding for query
    const queryEmbedding = await getEmbedding(query, config);
    if (!queryEmbedding) return "";

    // Calculate similarities
    const scoredMemories = memories
        .filter(m => m.embedding) // Only those with embeddings
        .map(m => ({
            ...m,
            score: cosineSimilarity(queryEmbedding, m.embedding!)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    if (scoredMemories.length === 0) return "";

    console.log(`[RAG] Found ${scoredMemories.length} relevant memories.`);

    const contextText = scoredMemories
        .map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.role}: ${m.content}`)
        .join('\n');

    return `\n\nRelevant Context from Memory:\n${contextText}\n\n`;
}
