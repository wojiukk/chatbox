import { cachified } from '@epic-web/cachified'
import type { SearchResultItem } from '@shared/types'
import { ModelProviderEnum } from '@shared/types'
import { truncate } from 'lodash'
import platform from '@/platform'
import { getExtensionSettings, getLanguage, getLicenseKey } from '@/stores/settingActions'
import { settingsStore } from '@/stores/settingsStore'
import { ChatboxAIAPIError } from '../../../shared/models/errors'
import type WebSearch from './base'
import { BingSearch } from './bing'
import { BingNewsSearch } from './bing-news'
import { BochaSearch } from './bocha'
import { ChatboxSearch } from './chatbox-search'
import { ENABLED_WEB_SEARCH_PROVIDERS } from './constants'
import { DeepSeekSearch } from './deepseek'
import { QueritSearch } from './querit'
import { normalizeSearxngBaseUrl, SearxngSearch } from './searxng'
import { TavilySearch } from './tavily'

const MAX_CONTEXT_ITEMS = 10
/** 每条结果喂给模型的摘要长度。DeepSeek 的 summary 是 600–800 字（官方说明供模型阅读），
 *  截到 150 字等于白拿，所以对它单独放宽。 */
const SNIPPET_LENGTH_DEFAULT = 150
const SNIPPET_LENGTH_DEEPSEEK = 400

/** 实际生效的搜索提供方（不在开放列表里的历史配置回落到 tavily）。 */
function getEffectiveSearchProvider(): string {
  const configured = getExtensionSettings().webSearch.provider
  return ENABLED_WEB_SEARCH_PROVIDERS.some((p) => p.value === configured) ? configured : 'tavily'
}

/**
 * DeepSeek 搜索用的 API Key：优先「联网搜索」里单独填的，
 * 没填则复用「模型提供方 → DeepSeek」里已配置的 key。
 */
function getDeepSeekSearchApiKey(): string {
  const state = settingsStore.getState()
  const dedicated = state.extension?.webSearch?.deepseekApiKey?.trim()
  if (dedicated) return dedicated
  return state.providers?.[ModelProviderEnum.DeepSeek]?.apiKey?.trim() ?? ''
}

// 根据配置的搜索提供方来选择搜索服务
function getSearchProviders() {
  const settings = getExtensionSettings()
  const licenseKey = getLicenseKey()

  const selectedProviders: WebSearch[] = []
  // 极简版：只允许 Tavily / DeepSeek。历史配置里的 build-in / bing 等一律按 Tavily 执行，
  // 避免没有 license 时抛 chatbox_search_license_key_required。
  const provider = getEffectiveSearchProvider()
  const language = getLanguage()

  switch (provider) {
    case 'build-in':
      if (!licenseKey) {
        throw ChatboxAIAPIError.fromCodeName(
          'chatbox_search_license_key_required',
          'chatbox_search_license_key_required'
        )
      }
      selectedProviders.push(new ChatboxSearch(licenseKey))
      break
    case 'bing':
      selectedProviders.push(new BingSearch())
      if (language !== 'zh-Hans' && platform.type !== 'mobile') {
        selectedProviders.push(new BingNewsSearch()) // 国内和移动端容易被重定向到 Bing 首页
      }
      break
    case 'tavily':
      if (!settings.webSearch.tavilyApiKey) {
        throw ChatboxAIAPIError.fromCodeName('tavily_api_key_required', 'tavily_api_key_required')
      }
      selectedProviders.push(new TavilySearch(settings.webSearch.tavilyApiKey))
      break
    case 'deepseek': {
      const apiKey = getDeepSeekSearchApiKey()
      if (!apiKey) {
        throw ChatboxAIAPIError.fromCodeName(
          'deepseek_api_key_required',
          'deepseek_api_key_required'
        )
      }
      selectedProviders.push(new DeepSeekSearch(apiKey))
      break
    }
    case 'bocha':
      if (!settings.webSearch.bochaApiKey) {
        throw ChatboxAIAPIError.fromCodeName('bocha_api_key_required', 'bocha_api_key_required')
      }
      selectedProviders.push(new BochaSearch(settings.webSearch.bochaApiKey))
      break
    case 'querit':
      if (!settings.webSearch.queritApiKey) {
        throw ChatboxAIAPIError.fromCodeName('querit_api_key_required', 'querit_api_key_required')
      }
      selectedProviders.push(
        new QueritSearch(
          settings.webSearch.queritApiKey,
          settings.webSearch.queritMaxResults,
          settings.webSearch.queritTimeRange
        )
      )
      break
    case 'searxng': {
      const searxngBaseUrl = normalizeSearxngBaseUrl(settings.webSearch.searxngBaseUrl ?? '')
      if (!searxngBaseUrl) {
        throw ChatboxAIAPIError.fromCodeName('searxng_base_url_required', 'searxng_base_url_required')
      }
      selectedProviders.push(new SearxngSearch(searxngBaseUrl))
      break
    }
    default:
      throw new Error(`Unsupported search provider: ${provider}`)
  }

  return selectedProviders
}

async function _searchRelatedResults(query: string, signal?: AbortSignal) {
  const providers = getSearchProviders()
  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const result = await provider.search(query, signal)
        console.debug(`web search result for "${query}":`, result.items)
        return { result }
      } catch (err) {
        console.error(err)
        return { error: err }
      }
    })
  )

  const successfulResults = results.flatMap((entry) => (entry.result ? [entry.result] : []))
  if (successfulResults.length === 0) {
    throw results[0]?.error ?? new Error('Web search failed')
  }

  const items: SearchResultItem[] = []

  // add items in turn
  let i = 0
  let hasMore = false
  do {
    hasMore = false
    for (const result of successfulResults) {
      const item = result.items[i]
      if (item) {
        hasMore = true
        items.push(item)
      } else {
      }
    }
    i++
  } while (hasMore && items.length < MAX_CONTEXT_ITEMS)

  console.debug('web search items', items)

  const snippetLength =
    getEffectiveSearchProvider() === 'deepseek' ? SNIPPET_LENGTH_DEEPSEEK : SNIPPET_LENGTH_DEFAULT
  return items.map((item) => ({
    title: item.title,
    snippet: truncate(item.snippet, { length: snippetLength }),
    link: item.link,
  }))
}

export async function testWebSearchConnection(signal?: AbortSignal): Promise<void> {
  await _searchRelatedResults('Chatbox', signal)
}

const cache = new Map()

export const webSearchExecutor = async (
  { query }: { query: string },
  { abortSignal }: { abortSignal?: AbortSignal }
) => {
  const webSearch = getExtensionSettings().webSearch
  const provider = getEffectiveSearchProvider()
  const cacheIdentity =
    provider === 'searxng' ? `${provider}:${normalizeSearxngBaseUrl(webSearch.searxngBaseUrl ?? '')}` : provider
  const searchResults = await cachified({
    cache,
    key: `search-context:${cacheIdentity}:${query}`,
    ttl: 1000 * 60 * 5,
    getFreshValue: () => _searchRelatedResults(query, abortSignal),
  })
  return { query, searchResults }
}

/**
 * Single source of truth: which configured providers offer the parse_link tool.
 * Keep in sync with the provider classes' `supportsParseLink` flags.
 */
export const PROVIDERS_WITH_PARSE_LINK: ReadonlySet<string> = new Set(['build-in', 'tavily', 'deepseek'])

/**
 * Returns the first configured search provider that supports parseLink.
 * Throws the underlying provider error (e.g. missing API key) — caller decides how to handle.
 */
export function getParseLinkProvider(): WebSearch | null {
  const providers = getSearchProviders()
  return providers.find((p) => p.supportsParseLink) ?? null
}

export type { SearchResultItem }
