"""XHS RAG - Spider_XHS wrapper service"""
import asyncio
import json
from typing import Optional
from loguru import logger


class XhsService:
    """Wraps Spider_XHS API calls with rate limiting and parsing."""

    def __init__(self, cookie: str):
        self.cookie = cookie
        self._api = None
        self._interval = 3.0

    @property
    def api(self):
        if self._api is None:
            from spider_xhs.apis.xhs_pc_apis import XHS_Apis
            self._api = XHS_Apis()
        return self._api

    async def _delay(self):
        await asyncio.sleep(self._interval)

    def verify_cookie(self) -> dict:
        """Verify cookie by fetching self info. Returns user info dict or raises."""
        success, msg, data = self.api.get_user_self_info(self.cookie)
        if not success:
            raise ValueError(f"Cookie verification failed: {msg}")
        return data.get("data", {})

    def get_collect_notes(self) -> list[dict]:
        """Fetch all collected/favorited notes. Returns raw note list."""
        user_data = self.verify_cookie()
        user_id = user_data.get("user_id", "")
        if not user_id:
            raise ValueError("Cannot get user_id from cookie")
        user_url = f"https://www.xiaohongshu.com/user/profile/{user_id}?xsec_source=pc_user"
        success, msg, notes = self.api.get_user_all_collect_note_info(user_url, self.cookie)
        if not success:
            raise ValueError(f"Failed to fetch collect notes: {msg}")
        return notes

    def get_note_detail(self, note_url: str) -> dict:
        """Fetch full note detail by URL."""
        success, msg, data = self.api.get_note_info(note_url, self.cookie)
        if not success:
            raise ValueError(f"Failed to fetch note detail: {msg}")
        items = data.get("data", {}).get("items", [])
        if not items:
            raise ValueError("Note detail returned empty items")
        return items[0].get("note_card", items[0])

    def parse_collect_notes(self, raw_notes: list) -> list[dict]:
        """Parse raw collect notes into our Note format."""
        result = []
        for note in raw_notes:
            note_card = note.get("note_card", note)
            note_id = note_card.get("note_id", "")
            title = note_card.get("display_title", "") or note_card.get("title", "")
            user_info = note_card.get("user", {})
            cover_info = note_card.get("cover", {})
            tag_list = note_card.get("tag_list", [])
            interact = note_card.get("interact_info", {})
            result.append({
                "note_id": note_id,
                "title": title,
                "author": user_info.get("nickname", ""),
                "author_avatar": user_info.get("avatar", ""),
                "cover_url": cover_info.get("url", "") or cover_info.get("url_default", ""),
                "note_type": note_card.get("type", "normal"),
                "tags": [t.get("name", "") for t in tag_list if t.get("name")],
                "like_count": self._safe_int(interact.get("liked_count", "0")),
                "collect_count": self._safe_int(interact.get("collected_count", "0")),
                "comment_count": self._safe_int(interact.get("comment_count", "0")),
            })
        return result

    def parse_note_detail(self, note_id: str, raw_detail: dict) -> dict:
        """Parse raw note detail into our format."""
        title = raw_detail.get("title", "")
        desc = raw_detail.get("desc", "")
        note_type = raw_detail.get("type", "normal")
        user_info = raw_detail.get("user", {})
        tag_list = raw_detail.get("tag_list", [])
        interact = raw_detail.get("interact_info", {})
        images = []
        for img in raw_detail.get("image_list", []):
            url = img.get("url_default", "") or img.get("url", "")
            if url:
                images.append(url)
        video_url = ""
        video_info = raw_detail.get("video", {})
        if video_info:
            media = video_info.get("media_stream", {})
            h264 = media.get("h264", [])
            if h264:
                video_url = h264[0].get("master_url", "")
        return {
            "note_id": note_id,
            "title": title,
            "content": desc,
            "author": user_info.get("nickname", ""),
            "author_avatar": user_info.get("avatar", ""),
            "images": images,
            "video_url": video_url,
            "note_type": note_type,
            "tags": [t.get("name", "") for t in tag_list if t.get("name")],
            "like_count": self._safe_int(interact.get("liked_count", "0")),
            "collect_count": self._safe_int(interact.get("collected_count", "0")),
            "comment_count": self._safe_int(interact.get("comment_count", "0")),
        }

    def build_note_url(self, note_id: str, xsec_token: str = "") -> str:
        base = f"https://www.xiaohongshu.com/explore/{note_id}"
        if xsec_token:
            base += f"?xsec_token={xsec_token}&xsec_source=pc_user"
        return base

    @staticmethod
    def _safe_int(val) -> int:
        try:
            return int(val)
        except (ValueError, TypeError):
            return 0
