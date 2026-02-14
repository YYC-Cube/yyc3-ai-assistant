import { useState, useEffect, useCallback } from 'react';
import { generateCompletion, DEFAULT_CONFIG, LLMConfig, MessageContent } from '@/utils/llm';
import { retrieveContext, getEmbedding, MemoryEntry } from '@/utils/rag';
import { useConfigStore } from '@/stores/config-store';
import { useAuthStore } from '@/stores/auth-store';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    images?: string[]; // Base64
}

export type ProcessingState = 'idle' | 'processing';

interface CommandActions {
    openSettings: () => void;
    openHistory: () => void;
    closePanel: () => void;
    setThemeRed: () => void;
    setThemeCyan: () => void;
}

export function useAI(actions: CommandActions) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [memories, setMemories] = useState<MemoryEntry[]>([]);
    const [processingState, setProcessingState] = useState<ProcessingState>('idle');
    
    // 从 Zustand Store 获取配置 / Get config from Zustand Store
    const { activeConfig, loadConfigs, applyLocalConfig } = useConfigStore();
    const { user } = useAuthStore();

    // 配置兼容层：对外暴露与旧接口一致的 config 和 updateConfig
    // Compatibility layer: expose config & updateConfig matching old interface
    const config = activeConfig;

    const updateConfig = useCallback((newConfig: LLMConfig) => {
        applyLocalConfig(newConfig);
    }, [applyLocalConfig]);

    // 1. 初始化：加载本地数据 + 同步 PG 配置
    // Init: Load local data + sync PG configs
    useEffect(() => {
        // 加载历史消息 / Load message history
        const savedHistory = localStorage.getItem('yyc_history');
        if (savedHistory) {
            try { setMessages(JSON.parse(savedHistory)); } catch (e) { console.error(e); }
        }
        const savedMemories = localStorage.getItem('yyc_memories');
        if (savedMemories) {
            try { setMemories(JSON.parse(savedMemories)); } catch (e) { console.error(e); }
        }

        // 从 PG 加载配置（通过 Zustand Store） / Load configs from PG (via Zustand Store)
        loadConfigs();
    }, []);

    // 持久化消息到 localStorage / Persist messages to localStorage
    useEffect(() => {
        localStorage.setItem('yyc_history', JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('yyc_memories', JSON.stringify(memories));
    }, [memories]);

    // 2. Command Parsing
    const parseAndExecuteCommands = (text: string): string => {
        const cmdRegex = /\[\[CMD:(.*?)\]\]/g;
        let match;
        while ((match = cmdRegex.exec(text)) !== null) {
            const cmd = match[1];
            console.log("[AI Command]", cmd);
            switch (cmd) {
                case 'OPEN_SETTINGS': actions.openSettings(); break;
                case 'OPEN_HISTORY': actions.openHistory(); break;
                case 'CLOSE_PANEL': actions.closePanel(); break;
                case 'THEME_RED': actions.setThemeRed(); break;
                case 'THEME_CYAN': actions.setThemeCyan(); break;
            }
        }
        return text.replace(cmdRegex, '').trim();
    };

    // 3. Memory Archiving
    const archiveMemory = async (msg: Message) => {
        if (!msg.content || msg.content.length < 5) return;
        
        const embedding = await getEmbedding(msg.content, config);
        if (embedding) {
            const newMem: MemoryEntry = {
                id: msg.id,
                content: msg.content,
                role: msg.role,
                timestamp: Date.now(),
                embedding
            };
            setMemories(prev => [...prev.slice(-49), newMem]); 
        }
    };

    // 4. Interaction Logic
    const sendMessage = useCallback(async (text: string, images?: string[]): Promise<string> => {
        if (!text.trim() && (!images || images.length === 0)) return "";

        const newUserMsg: Message = { 
            id: Date.now().toString(), 
            role: 'user', 
            content: text,
            images 
        };
        
        setMessages(prev => [...prev, newUserMsg]);
        setProcessingState('processing');

        archiveMemory(newUserMsg);

        try {
            // A. Retrieve Context via RAG
            let systemContext = "";
            if (text.length > 5 && config.provider !== 'moonshot') { 
                 const ragContext = await retrieveContext(text, memories, config);
                 if (ragContext) {
                     systemContext = `\n${ragContext}\n(请参考上述记忆回答用户，但不要明确提及"根据记忆")`;
                 }
            }

            // B. Construct Messages Payload
            const contextMessages: MessageContent[] = messages.slice(-5).map(m => ({ 
                role: m.role, 
                content: m.content,
                images: m.images 
            }));
            
            contextMessages.push({ role: 'user', content: text + systemContext, images });

            // C. Call API
            const rawResponse = await generateCompletion(contextMessages, config);
            
            // D. Parse & Update
            const cleanResponse = parseAndExecuteCommands(rawResponse);
            const newAiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: cleanResponse };
            
            setMessages(prev => [...prev, newAiMsg]);
            setProcessingState('idle');

            archiveMemory(newAiMsg);

            return cleanResponse; 
        } catch (error) {
            setProcessingState('idle');
            const errorMsg = "系统连接中断，请检查神经回路配置。";
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: errorMsg }]);
            return errorMsg;
        }
    }, [messages, memories, config, actions]); 

    return {
        messages,
        config,
        updateConfig,
        processingState,
        sendMessage,
        setMessages
    };
}
