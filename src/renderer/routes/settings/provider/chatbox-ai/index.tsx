import { createFileRoute, redirect } from '@tanstack/react-router'
import { featureFlags } from '@/utils/feature-flags'
import { ChatboxAISettings } from './-components/ChatboxAISettings'

export const Route = createFileRoute('/settings/provider/chatbox-ai/')({
  component: RouteComponent,
  beforeLoad: () => {
    // 极简版：Chatbox AI 关闭时，直接输 URL 也会被弹回「模型提供方」
    if (!featureFlags.chatboxAi) {
      throw redirect({ to: '/settings/provider' })
    }
  },
})

export function RouteComponent() {
  return <ChatboxAISettings padded />
}
