"""XHS RAG - Push notification service (Server酱 / 企业微信 / 飞书)"""
import httpx
from datetime import datetime, timedelta
from loguru import logger
from app.config import settings


async def push_weekly_summary(stats: dict, categories: list, top_notes: list, ai_summary: str):
    """Push weekly summary to all configured channels."""
    title, body = _build_message(stats, categories, top_notes, ai_summary)
    results = {}

    wechat_work_key = settings.wechat_work_key
    if wechat_work_key:
        results["wechat_work"] = await _push_wechat_work(wechat_work_key, title, body, categories, top_notes, ai_summary)

    feishu_url = settings.feishu_webhook_url
    if feishu_url:
        results["feishu"] = await _push_feishu(feishu_url, title, body, stats)

    if not results:
        logger.warning("No push channel configured")
        return {"status": "no_channel"}

    return results


def _build_message(stats: dict, categories: list, top_notes: list, ai_summary: str) -> tuple:
    now = datetime.now()
    week_ago = now - timedelta(days=7)
    date_range = f"{week_ago.strftime('%m.%d')} — {now.strftime('%m.%d')}"

    title = f"本周收藏回顾 ({date_range})"
    lines = [
        f"## {title}",
        "",
        f"**{stats.get('total_notes', 0)}** 篇笔记 | **{stats.get('total_categories', 0)}** 个分类",
        "",
    ]

    if categories:
        lines.append("### 收藏分布")
        for cat in categories[:6]:
            bar = "█" * max(1, cat["count"]) + "░" * max(0, 8 - cat["count"])
            lines.append(f"- {cat['name']} {bar} {cat['count']}")
        lines.append("")

    if top_notes:
        lines.append("### 本周精选")
        medals = ["🥇", "🥈", "🥉"]
        for i, note in enumerate(top_notes):
            medal = medals[i] if i < 3 else f"{i+1}."
            lines.append(f"{medal} **{note['title']}**")
            if note.get("summary"):
                lines.append(f"   {note['summary']}")
        lines.append("")

    if ai_summary:
        lines.append(f"> {ai_summary}")

    lines.append("")
    lines.append("— XHS 知识库")

    return title, "\n".join(lines)


async def _push_serverchan(key: str, title: str, body: str) -> dict:
    url = f"https://sctapi.ftqq.com/{key}.send"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, data={"title": title, "desp": body})
            data = resp.json()
            if data.get("code") == 0:
                logger.info("Server酱 push success")
                return {"status": "ok"}
            else:
                logger.error(f"Server酱 push failed: {data}")
                return {"status": "failed", "error": data.get("message", "")}
    except Exception as e:
        logger.error(f"Server酱 push error: {e}")
        return {"status": "error", "error": str(e)}


async def _push_wechat_work(key: str, title: str, body: str, categories: list, top_notes: list, ai_summary: str) -> dict:
    url = f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={key}"
    # Build markdown card for WeChat Work
    lines = [f"## {title}", ""]
    lines.append(f"> **{categories[0]['count'] + (categories[1]['count'] if len(categories) > 1 else 0)}** 篇新收藏" if categories else "")
    if categories:
        lines.append("")
        for cat in categories[:6]:
            lines.append(f"**{cat['name']}** {cat['count']}篇")
    if top_notes:
        lines.append("")
        medals = ["🥇", "🥈", "🥉"]
        for i, note in enumerate(top_notes):
            medal = medals[i] if i < 3 else f"{i+1}."
            lines.append(f"{medal} {note['title']}")
    if ai_summary:
        lines.append(f"\n> {ai_summary}")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={
                "msgtype": "markdown",
                "markdown": {"content": "\n".join(lines)},
            })
            data = resp.json()
            if data.get("errcode") == 0:
                logger.info("WeChat Work push success")
                return {"status": "ok"}
            else:
                logger.error(f"WeChat Work push failed: {data}")
                return {"status": "failed", "error": data.get("errmsg", "")}
    except Exception as e:
        logger.error(f"WeChat Work push error: {e}")
        return {"status": "error", "error": str(e)}


async def _push_feishu(webhook_url: str, title: str, body: str, stats: dict) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json={
                "msg_type": "interactive",
                "card": {
                    "header": {
                        "title": {"content": title, "tag": "plain_text"},
                        "template": "red",
                    },
                    "elements": [
                        {"tag": "markdown", "content": body},
                    ],
                },
            })
            data = resp.json()
            if data.get("code") == 0 or data.get("StatusCode") == 0:
                logger.info("Feishu push success")
                return {"status": "ok"}
            else:
                logger.error(f"Feishu push failed: {data}")
                return {"status": "failed", "error": str(data)}
    except Exception as e:
        logger.error(f"Feishu push error: {e}")
        return {"status": "error", "error": str(e)}
