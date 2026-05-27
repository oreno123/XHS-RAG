"""XHS RAG - Spider_XHS wrapper service"""
import asyncio
import json
import sys
import os
from typing import Optional
from loguru import logger

# Add spider_xhs to sys.path so its internal imports work
_spider_xhs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "spider_xhs")
if _spider_xhs_dir not in sys.path:
    sys.path.insert(0, _spider_xhs_dir)


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
        import requests as http_req
        cookies = dict(pair.split('=', 1) for pair in self.cookie.split('; ') if '=' in pair)
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://www.xiaohongshu.com/',
            'Origin': 'https://www.xiaohongshu.com',
            'Content-Type': 'application/json',
        }
        # Try /api/sns/web/v2/user/me
        try:
            r = http_req.get('https://edith.xiaohongshu.com/api/sns/web/v2/user/me',
                             headers=headers, cookies=cookies, timeout=10)
            data = r.json()
            logger.info(f"user/me response: {data}")
            if data.get('success') and data.get('data'):
                user_info = data['data'].get('user_info', data['data'])
                if user_info.get('user_id'):
                    return {'user_id': str(user_info['user_id']),
                            'nickname': user_info.get('nickname', ''),
                            'image': user_info.get('image', '')}
        except Exception as e:
            logger.warning(f"user/me failed: {e}")
        # Fallback to spider_xhs
        try:
            success, msg, resp_data = self.api.get_user_self_info(self.cookie)
            if success and resp_data:
                return resp_data.get('data', {})
        except Exception as e:
            logger.warning(f"spider_xhs verify failed: {e}")
        raise ValueError("Cannot verify cookie: all methods failed")

    def _http_headers(self):
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://www.xiaohongshu.com/',
            'Origin': 'https://www.xiaohongshu.com',
            'Content-Type': 'application/json',
        }

    def _http_cookies(self):
        return dict(pair.split('=', 1) for pair in self.cookie.split('; ') if '=' in pair)

    def get_collect_notes(self) -> list[dict]:
        """Fetch collected notes list. Details fetched later during build."""
        user_data = self.verify_cookie()
        user_id = user_data.get("user_id", "")
        if not user_id:
            raise ValueError("Cannot get user_id from cookie")
        user_url = f"https://www.xiaohongshu.com/user/profile/{user_id}?xsec_source=pc_user"
        success, msg, notes = self.api.get_user_all_collect_note_info(user_url, self.cookie)
        if not success:
            raise ValueError(f"Failed to fetch collect notes: {msg}")
        logger.info(f"Fetched {len(notes)} collected notes")
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
        """Parse raw collect notes into our Note format with full content."""
        result = []
        for note in raw_notes:
            note_card = note.get("note_card", note)
            note_id = note_card.get("note_id", "")
            title = note_card.get("display_title", "") or note_card.get("title", "")
            user_info = note_card.get("user", {})
            cover_info = note_card.get("cover", {})
            tag_list = note_card.get("tag_list", [])
            interact = note_card.get("interact_info", {})

            # Extract images from collect list
            images = []
            for img in note_card.get("image_list", []):
                url = img.get("url_default", "") or img.get("url", "")
                if url:
                    images.append(url)

            # Extract video
            video_url = ""
            video_info = note_card.get("video", {})
            if video_info:
                media = video_info.get("media_stream", {})
                h264 = media.get("h264", [])
                if h264:
                    video_url = h264[0].get("master_url", "")

            # Extract xsec_token for later use
            xsec_token = note_card.get("xsec_token", "")

            result.append({
                "note_id": note_id,
                "title": title,
                "content": note_card.get("desc", ""),
                "author": user_info.get("nickname", ""),
                "author_avatar": user_info.get("avatar", ""),
                "cover_url": cover_info.get("url", "") or cover_info.get("url_default", ""),
                "images": images,
                "video_url": video_url,
                "note_type": note_card.get("type", "normal"),
                "tags": [t.get("name", "") for t in tag_list if t.get("name")],
                "like_count": self._safe_int(interact.get("liked_count", "0")),
                "collect_count": self._safe_int(interact.get("collected_count", "0")),
                "comment_count": self._safe_int(interact.get("comment_count", "0")),
                "xsec_token": xsec_token,
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
            media = video_info.get("media", {}).get("stream", {})
            h264 = media.get("h264", [])
            if h264:
                video_url = h264[0].get("master_url", "")
            # Fallback: consumer.origin_video_key -> CDN URL
            if not video_url:
                origin_key = video_info.get("consumer", {}).get("origin_video_key", "")
                if origin_key:
                    video_url = f"https://sns-video-bd.xhscdn.com/{origin_key}"
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
