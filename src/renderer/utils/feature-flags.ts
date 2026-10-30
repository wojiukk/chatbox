import platform from '@/platform'

export const featureFlags = {
  // 极简版：关掉 MCP 与知识库（设置导航会跟着自动隐藏，见 settingsNav.tsx）
  mcp: false,
  knowledgeBase: false,
  // 极简版：只留桌面端，手机端不显示 Skills / 智能体（记忆页仍会以 Memory 出现）
  skills: platform.isDesktopLike,
  agentMode: platform.isDesktopLike,
  // 极简版：关掉 Chatbox AI 厂商账号体系（登录页、Pro 模型目录）
  chatboxAi: false,
}
