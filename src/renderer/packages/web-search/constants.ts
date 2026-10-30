export const WEB_SEARCH_PROVIDERS = [
  { value: 'build-in', label: 'Chatbox AI' },
  { value: 'bing', label: 'Bing Search' },
  { value: 'tavily', label: 'Tavily' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'bocha', label: 'BoCha' },
  { value: 'querit', label: 'Querit' },
  { value: 'searxng', label: 'SearXNG' },
] as const

export type WebSearchProviderValue = (typeof WEB_SEARCH_PROVIDERS)[number]['value']

/**
 * 极简版：实际开放的搜索提供方，只有 Tavily 与 DeepSeek。
 * 保留上面的完整列表与类型定义，其它 provider 的代码仍可编译，只是不再暴露给用户
 * （设置页下拉与输入框 Work Mode 里的选择列表都读这个常量）。
 */
export const ENABLED_WEB_SEARCH_PROVIDERS = WEB_SEARCH_PROVIDERS.filter(
  (p) => p.value === 'tavily' || p.value === 'deepseek'
)
