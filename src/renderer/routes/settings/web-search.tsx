import { Flex, Select, Text } from '@mantine/core'
import type { Settings } from '@shared/types'
import { IconCheck, IconX } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { ofetch } from 'ofetch'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { CheckedFieldRow } from '@/components/settings/CheckedFieldRow'
import { SettingRow, SettingsPage, SettingsSection } from '@/components/settings/SettingsLayout'
import { PROVIDERS_WITH_PARSE_LINK } from '@/packages/web-search'
import { BochaSearch } from '@/packages/web-search/bocha'
import { ENABLED_WEB_SEARCH_PROVIDERS, type WebSearchProviderValue } from '@/packages/web-search/constants'
import { QUERIT_SEARCH_URL } from '@/packages/web-search/querit'
import { SearxngSearch } from '@/packages/web-search/searxng'
import { useSettingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/settings/web-search')({
  component: RouteComponent,
})

type WebSearchSettings = Settings['extension']['webSearch']

const QUERIT_MAX_RESULTS = Array.from({ length: 10 }, (_, index) => String(index + 1))

async function checkTavily(apiKey: string) {
  await ofetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: { query: 'Chatbox', search_depth: 'basic', include_domains: [], exclude_domains: [] },
  })
}

// 极简版：DeepSeek 官方的 Search API，用来验证 key 是否可用（按成功请求计费，这里只发 1 条）
async function checkDeepSeek(apiKey: string) {
  await ofetch('https://api.deepseek.com/v1/tools/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: { query: 'Chatbox', count: 1, need_content: false },
  })
}

async function checkQuerit(apiKey: string) {
  await ofetch(QUERIT_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: { query: 'Chatbox' },
  })
}

function ProvidedTools({ provider }: { provider: WebSearchProviderValue }) {
  const { t } = useTranslation()
  const tools = [
    { label: t('Web Search'), supported: true },
    { label: t('Read Webpage'), supported: PROVIDERS_WITH_PARSE_LINK.has(provider) },
  ]
  return (
    <Flex gap="sm" wrap="wrap" align="center" mt={2}>
      <Text fz={12} lh="18px" c="chatbox-tertiary">
        {t('Provided tools')}
      </Text>
      {tools.map(({ label, supported }) => (
        <Flex key={label} align="center" gap={4}>
          {supported ? (
            <IconCheck size={14} className="text-chatbox-tint-success" />
          ) : (
            <IconX size={14} className="text-chatbox-tint-tertiary" />
          )}
          <Text fz={12} lh="18px" c={supported ? 'chatbox-secondary' : 'chatbox-tertiary'}>
            {label}
          </Text>
        </Flex>
      ))}
    </Flex>
  )
}

export function RouteComponent() {
  const { t } = useTranslation()
  const setSettings = useSettingsStore((state) => state.setSettings)
  const extension = useSettingsStore((state) => state.extension)
  const webSearch = extension.webSearch
  const provider = webSearch.provider

  const updateWebSearch = (patch: Partial<WebSearchSettings>) =>
    setSettings({ extension: { ...extension, webSearch: { ...webSearch, ...patch } } })

  // 极简版：历史配置里的 build-in / bing / bocha 等不在开放列表里，进页面就迁到 Tavily，
  // 否则执行侧会一路回落到 Tavily 而设置页还显示旧选项。
  useEffect(() => {
    if (!ENABLED_WEB_SEARCH_PROVIDERS.some((p) => p.value === provider)) {
      updateWebSearch({ provider: 'tavily' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SettingsPage title={t('Web Search')} description={t('The search service used when a model searches the web.')}>
      <SettingsSection title={t('Search Provider')}>
        <SettingRow
          id="search-provider"
          label={t('Search Provider')}
          status={<ProvidedTools provider={provider} />}
          controlLayout="block"
          control={(fieldId) => (
            <AdaptiveSelect
              id={fieldId}
              comboboxProps={{ withinPortal: true, withArrow: true }}
              aria-label={t('Search Provider') ?? undefined}
              data={ENABLED_WEB_SEARCH_PROVIDERS.map((p) => ({ value: p.value, label: p.label }))}
              value={provider}
              onChange={(value) => value && updateWebSearch({ provider: value as WebSearchProviderValue })}
            />
          )}
        />
        {provider === 'tavily' && (
          <CheckedFieldRow
            key="tavily"
            id="tavily-api-key"
            label={t('Tavily API Key')}
            secret
            value={webSearch.tavilyApiKey}
            onChange={(tavilyApiKey) => updateWebSearch({ tavilyApiKey })}
            check={checkTavily}
            failureMessage={t('API key invalid!')}
            getKeyUrl="https://app.tavily.com?utm_source=chatbox"
          />
        )}
        {provider === 'deepseek' && (
          <CheckedFieldRow
            key="deepseek"
            id="deepseek-api-key"
            label="DeepSeek API Key"
            description="Per 1000 successful searches: $0.75. Empty results and failures are not billed. Leave blank to reuse the key configured under Model Provider → DeepSeek."
            secret
            value={webSearch.deepseekApiKey}
            onChange={(deepseekApiKey) => updateWebSearch({ deepseekApiKey })}
            placeholder="sk-..."
            check={checkDeepSeek}
            failureMessage={t('API key invalid!')}
            getKeyUrl="https://platform.deepseek.com/api_keys"
          />
        )}
        {provider === 'bocha' && (
          <CheckedFieldRow
            key="bocha"
            id="bocha-api-key"
            label={t('BoCha API Key')}
            secret
            value={webSearch.bochaApiKey}
            onChange={(bochaApiKey) => updateWebSearch({ bochaApiKey })}
            check={async (apiKey) => {
              await new BochaSearch(apiKey).search('Chatbox')
            }}
            failureMessage={t('API key invalid!')}
            getKeyUrl="https://open.bochaai.com"
          />
        )}
        {provider === 'querit' && (
          <CheckedFieldRow
            key="querit"
            id="querit-api-key"
            label={t('Querit API Key')}
            secret
            value={webSearch.queritApiKey}
            onChange={(queritApiKey) => updateWebSearch({ queritApiKey })}
            placeholder={t('Enter your Querit API Key') ?? undefined}
            check={checkQuerit}
            failureMessage={t('API key invalid!')}
            getKeyUrl="https://www.querit.ai"
          />
        )}
        {provider === 'searxng' && (
          <CheckedFieldRow
            key="searxng"
            id="searxng-url"
            label={t('SearXNG Instance URL')}
            description={t('The SearXNG instance must enable JSON output format in search settings.')}
            value={webSearch.searxngBaseUrl}
            onChange={(searxngBaseUrl) => updateWebSearch({ searxngBaseUrl })}
            placeholder="https://searx.example.com"
            check={async (url) => {
              await new SearxngSearch(url).search('Chatbox')
            }}
            failureMessage={t('Connection failed!')}
          />
        )}
      </SettingsSection>

      {provider === 'querit' && (
        <SettingsSection title={t('Querit Search Options')}>
          <SettingRow
            id="querit-max-results"
            label={t('Max Results')}
            description={t('Maximum number of results to return.')}
            control={(fieldId) => (
              <Select
                id={fieldId}
                w={120}
                comboboxProps={{ withinPortal: true, withArrow: true }}
                aria-label={t('Max Results') ?? undefined}
                data={QUERIT_MAX_RESULTS}
                value={String(webSearch.queritMaxResults || 5)}
                onChange={(value) => value && updateWebSearch({ queritMaxResults: Number.parseInt(value, 10) })}
              />
            )}
          />
          <SettingRow
            id="querit-time-range"
            label={t('Time Range')}
            description={t('Time range of the search. For example, the last month.')}
            control={(fieldId) => (
              <Select
                id={fieldId}
                w={120}
                comboboxProps={{ withinPortal: true, withArrow: true }}
                aria-label={t('Time Range') ?? undefined}
                data={[
                  { value: 'none', label: 'None' },
                  { value: 'd1', label: 'Day' },
                  { value: 'w1', label: 'Week' },
                  { value: 'm1', label: 'Month' },
                  { value: 'y1', label: 'Year' },
                ]}
                value={webSearch.queritTimeRange || 'none'}
                onChange={(value) => value && updateWebSearch({ queritTimeRange: value })}
              />
            )}
          />
        </SettingsSection>
      )}
    </SettingsPage>
  )
}
