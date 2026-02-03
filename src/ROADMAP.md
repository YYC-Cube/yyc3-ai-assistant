# YYC³ Project Roadmap

## 🎯 Vision
构建一个去界面化 (Zero UI)、高沉浸感、具备物理交互特性的数字生命体。

## 🗺️ Phased Plan (分阶段计划)

### Phase 1-5 (Completed)
- 架构、视觉、记忆、TTS、云同步已全部就绪。

### Phase 6: 无边界设计 (Current - Completed)
- [x] **Zero UI 重构**: 移除了顶部 HUD 和所有常驻按钮。
- [x] **Orbital Menu (轨道菜单)**: 双指点击或双击屏幕，在点击处召唤环形菜单。
- [x] **Gesture Navigation**: 全屏手势系统。
- [x] **Immersive Settings**: 设置面板改为悬浮的玻璃拟态窗口。

### Phase 7: 智能中心与模块化 (In Progress)
**目标**: 构建 Intelligent Center，实现功能模块的可视化管理。
- [x] **Design System**: 建立了 `utils/design-system.ts` 统一视觉规范。
- [x] **Intelligent Center**: 完成了全息仪表盘视图。
- [x] **Task Pod (Case 1)**: 完成了“无边界待办”模块。
    - 语音添加任务。
    - 手势左滑删除，右滑完成。
    - 全局注视感知 (Simulated Gaze) 实现。
- [x] **Global Gaze**: 实现了 `useGaze` hook，支持光标驻留触发交互。

---

## 📝 Change Log (Phase 7)
- **Features**:
  - 新增 **智能中心 (Hub)**：双击唤起菜单后点击网格图标进入。
  - 新增 **任务舱 (Task Pod)**：在智能中心点击 "Tasks" 进入，支持语音添加和手势管理。
  - 新增 **注视感知**：长时间注视任务卡片会触发高亮反馈。
