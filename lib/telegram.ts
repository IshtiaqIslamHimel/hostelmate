// lib/telegram.ts – server only
export async function sendTelegram(chat_id: string | number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' }
  if (!chat_id) return { ok: false, error: 'no chat_id' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(chat_id), text, parse_mode: 'HTML', disable_web_page_preview: true })
    })
    const j = await res.json()
    if (!j.ok) return { ok: false, error: j.description || 'telegram error' }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
