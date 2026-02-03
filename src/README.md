# YYC³ AI Assistant (言语云魔方) 项目文档

## 1. 项目简介
YYC³ 是一个基于“去界面化 (Zero UI)”和“无边界 (Borderless)”设计理念构建的现代 AI 助手原型。它摒弃了传统的按钮和菜单，采用手势、语音和 3D 视觉反馈作为核心交互手段，旨在探索未来数字生命的交互形态。

**核心特性：**
*   **全息视觉核心**：3D 动态魔方 (`CubeVisual`)，根据 AI 状态（聆听、思考、说话）实时反馈。
*   **无按钮设计**：完全依赖长按、滑动和点击手势。
*   **多模型支持**：内置支持本地部署的 Ollama，以及 OpenAI、DeepSeek、Moonshot 等云端大模型。
*   **沉浸式体验**：动态背景流光、玻璃拟态 UI、语音合成反馈。

## 2. 技术栈
*   **前端框架**：React + TypeScript
*   **样式库**：Tailwind CSS v4
*   **动画引擎**：Motion (Framer Motion)
*   **图标库**：Lucide React
*   **AI 交互**：Web Speech API (语音识别/合成) + Fetch API (LLM 连接)

## 3. 快速开始

### 3.1 环境准备
确保您的开发环境已安装 Node.js (v18+)。

### 3.2 启动项目
```bash
npm install
npm run dev
```

### 3.3 配置本地大模型 (Ollama)
本项目默认使用本地 Ollama 以保护隐私并降低延迟。
1.  下载并安装 [Ollama](https://ollama.com)。
2.  拉取模型（例如 Llama3）：
    ```bash
    ollama pull llama3
    ```
3.  **重要：配置 CORS**
    由于浏览器安全限制，必须允许 Web 端跨域访问 Ollama。
    *   **Mac/Linux**:
        ```bash
        OLLAMA_ORIGINS="*" ollama serve
        ```
    *   **Windows**:
        在环境变量中添加 `OLLAMA_ORIGINS` 值为 `*`，然后重启 Ollama。

## 4. 操作指南

### 4.1 核心手势
| 动作 | 触发区域 | 功能 |
| :--- | :--- | :--- |
| **长按 (0.6秒)** | 屏幕任意空白处 | **激活语音聆听** (松开手指结束或等待静默) |
| **点击** | 中央魔方 | 切换 聆听 / 待机 状态 |
| **上滑** | 屏幕底部向上 | 打开 **历史记录** (对话记忆) |
| **下滑** | 任意面板打开时 | 关闭当前面板 |
| **左滑** | 屏幕右侧向左 | 打开 **设置面板** (配置 API) |

### 4.2 设置说明
通过左滑手势打开设置面板，您可以：
1.  **切换引擎**：选择 Ollama (本地)、DeepSeek、OpenAI 或 Moonshot。
2.  **修改参数**：自定义 API Key、Base URL 和 模型名称。
3.  **人格设定**：修改 System Prompt 来改变 AI 的语气和性格。

## 5. 故障排查
*   **无法录音**：请检查浏览器是否已授予麦克风权限。注意：Web Speech API 在某些非 Chrome/Safari 浏览器上可能不兼容。
*   **AI 无回复 (Ollama)**：请确保 Ollama 正在运行，且已正确设置 `OLLAMA_ORIGINS="*"`。
*   **API 连接断开**：检查网络连接或 API Key 是否过期。原型机在连接失败时会进入“演示模式”，返回模拟数据。
