export type LLMConfig = {
    provider: 'ollama' | 'openai' | 'deepseek';
    baseUrl: string;
    apiKey: string;
    model: string;
};

export const DEFAULT_CONFIG: LLMConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    model: 'llama3'
};

export async function generateCompletion(
    messages: { role: string; content: string }[],
    config: LLMConfig
): Promise<string> {
    try {
        let url = '';
        let headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        let body: any = {};

        if (config.provider === 'ollama') {
            // Ollama API
            url = `${config.baseUrl}/api/chat`;
            body = {
                model: config.model,
                messages: messages,
                stream: false
            };
        } else if (config.provider === 'openai' || config.provider === 'deepseek') {
            // OpenAI Compatible API (DeepSeek uses same format)
            url = `${config.baseUrl}/v1/chat/completions`;
            headers['Authorization'] = `Bearer ${config.apiKey}`;
            body = {
                model: config.model,
                messages: messages,
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error: ${response.status} ${err}`);
        }

        const data = await response.json();

        if (config.provider === 'ollama') {
            return data.message?.content || "No response from Ollama";
        } else {
            return data.choices?.[0]?.message?.content || "No response from API";
        }
    } catch (error) {
        console.error("LLM Call Failed:", error);
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             return "连接失败：请检查 Ollama 是否运行，并允许跨域 (OLLAMA_ORIGINS='*')";
        }
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
}
