import { httpRequest } from '../util/Http'
import type { HttpRequestConfig } from '../util/Http'
import PQueue from 'p-queue'
import type { WebhookWeComConfig } from '../interface/Config'
import { flushQueue } from './Queue'

/**
 * 企业微信群机器人 Webhook。
 *
 * 官方文档：https://developer.work.weixin.qq.com/document/path/91770
 *   POST https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=<KEY>
 *   Body: { "msgtype": "markdown", "markdown": { "content": "..." } }
 *
 * 约束：
 *   - markdown 内容上限 4096 字节，text 上限 2048 字节（超出会被企微截断/拒绝）
 *   - 单个机器人 20 条/分钟，因此队列限流比其它通道更保守
 *   - 机器人 key 本身即凭证，禁止写入日志或仓库
 */

// 企微 markdown 上限 4096 字节，text 上限 2048 字节。留出余量避免临界值被拒。
const MARKDOWN_BYTE_LIMIT = 4000
const TEXT_BYTE_LIMIT = 2000

// 企微限制 20 条/分钟，即平均 3 秒一条。这里按 5 秒一条放行，留出安全余量。
const weComQueue = new PQueue({
    interval: 5000,
    intervalCap: 1,
    carryoverConcurrencyCount: true
})

/**
 * 按 UTF-8 字节数截断，避免多字节字符被切半导致乱码。
 */
function truncateByBytes(text: string, maxBytes: number): string {
    const buf = Buffer.from(text, 'utf8')
    if (buf.length <= maxBytes) return text

    // 保留 maxBytes 字节。若截断点落在多字节字符中间会产生乱码，
    // 因此当被丢弃的首个字节是 UTF-8 续节(10xxxxxx)时，回退到该字符的起始边界。
    let end = Math.min(maxBytes, buf.length)
    if (end < buf.length) {
        while (end > 0 && (buf[end]! & 0xc0) === 0x80) end--
    }
    return buf.subarray(0, end).toString('utf8')
}

/**
 * 将内部摘要文本转成企业微信 markdown。
 *
 * 企微 markdown 只支持有限子集（标题/加粗/链接/行内代码/引用/字体颜色），
 * 不支持表格、分割线、列表，因此这里用引用块逐行排版，最稳妥。
 */
function buildMarkdownContent(title: string, content: string): string {
    const lines = content.split(/\r?\n/)
    const body = lines.map(line => (line.trim() ? `> ${line}` : '>')).join('\n')
    return truncateByBytes(`**${title}**\n${body}`, MARKDOWN_BYTE_LIMIT)
}

export async function sendWeCom(config: WebhookWeComConfig, content: string): Promise<void> {
    if (!config?.enabled || !config?.webhookKey) return

    const title = config.title || 'Microsoft-Rewards-Script'
    const msgType = config.msgType === 'text' ? 'text' : 'markdown'

    const request: HttpRequestConfig = {
        method: 'POST',
        url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send',
        params: { key: config.webhookKey },
        headers: { 'Content-Type': 'application/json' },
        data:
            msgType === 'text'
                ? { msgtype: 'text', text: { content: truncateByBytes(`${title}\n${content}`, TEXT_BYTE_LIMIT) } }
                : { msgtype: 'markdown', markdown: { content: buildMarkdownContent(title, content) } },
        timeout: 10000
    }

    await weComQueue.add(async () => {
        try {
            const response = await httpRequest<{ errcode?: number; errmsg?: string }>(request)
            const errcode = response?.data?.errcode

            // 企业微信对业务错误仍返回 HTTP 200，必须检查 errcode 才知道是否真的送达
            if (typeof errcode === 'number' && errcode !== 0) {
                console.warn(`[WeCom] 推送失败 | errcode=${errcode} | errmsg=${response?.data?.errmsg ?? 'unknown'}`)
            }
        } catch (err) {
            const status = (err as { response?: { status?: number } })?.response?.status
            if (status === 429) return
            console.warn(`[WeCom] 推送请求异常，已跳过（不影响任务运行）`)
        }
    })
}

export function flushWeComQueue(timeoutMs = 5000): Promise<void> {
    return flushQueue(weComQueue, timeoutMs)
}
