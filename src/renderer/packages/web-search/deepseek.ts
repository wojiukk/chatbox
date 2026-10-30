import type { SearchResult } from '@shared/types'
import WebSearch, { type ParseLinkResult } from './base'

/**
 * DeepSeek 官方 Search / Fetch API（2026-10 上线，自研搜索引擎）。
 *
 * - 搜索：POST https://api.deepseek.com/v1/tools/search
 * - 抓取：POST https://api.deepseek.com/v1/tools/fetch（直接返回 Markdown 正文，
 *   所以 supportsParseLink = true，可支持「阅读网页」工具）
 *
 * 计费按成功请求：$0.75 / 1000 次；空结果与失败不计费。
 * 文档：https://api-docs.deepseek.com/guides/search/
 */

const DEEPSEEK_API_BASE = 'https://api.deepseek.com'
/** 每次搜索取多少条结果（1–50，官方默认 10） */
const SEARCH_RESULT_COUNT = 10

interface DeepSeekSearchResultItem {
  title?: string
  url?: string
  snippet?: string
  summary?: string
}

interface DeepSeekSearchResponse {
  results?: DeepSeekSearchResultItem[]
}

interface DeepSeekFetchResponse {
  title?: string
  content?: string
}

export class DeepSeekSearch extends WebSearch {
  private apiKey: string

  override supportsParseLink = true

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult> {
    try {
      const response = (await this.fetch(`${DEEPSEEK_API_BASE}/v1/tools/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: {
          query,
          count: SEARCH_RESULT_COUNT,
          // 不返回正文：summary（600–800 字）已经足够喂给模型，
          // 需要整页正文时走 parseLink（/v1/tools/fetch）。
          need_content: false,
        },
        responseType: 'json',
        signal,
      })) as DeepSeekSearchResponse

      const items = (response?.results ?? [])
        .filter((item): item is DeepSeekSearchResultItem & { url: string } => Boolean(item?.url))
        .map((item) => ({
          title: item.title?.trim() || item.url,
          link: item.url,
          snippet: item.summary?.trim() || item.snippet?.trim() || '',
        }))

      return { items }
    } catch (error) {
      console.error('DeepSeek search error:', error)
      throw error
    }
  }

  async parseLink(url: string, signal?: AbortSignal): Promise<ParseLinkResult> {
    const response = (await this.fetch(`${DEEPSEEK_API_BASE}/v1/tools/fetch`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: { url },
      responseType: 'json',
      signal,
    })) as DeepSeekFetchResponse

    return {
      url,
      title: response?.title?.trim() || url,
      content: response?.content || '',
    }
  }
}
