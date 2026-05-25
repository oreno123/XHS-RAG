def test_parse_collect_notes():
    from app.services.xhs import XhsService
    service = XhsService.__new__(XhsService)
    raw_notes = [
        {
            "note_id": "abc123",
            "title": "Python 入门教程",
            "user": {"nickname": "测试作者", "avatar": "https://avatar.url"},
            "cover": {"url": "https://cover.url"},
            "type": "normal",
            "tag_list": [{"name": "Python"}, {"name": "编程"}],
            "interact_info": {"liked_count": "100", "collected_count": "50", "comment_count": "20"},
        }
    ]
    result = service.parse_collect_notes(raw_notes)
    assert len(result) == 1
    assert result[0]["note_id"] == "abc123"
    assert result[0]["title"] == "Python 入门教程"
    assert result[0]["author"] == "测试作者"
    assert result[0]["tags"] == ["Python", "编程"]
    assert result[0]["like_count"] == 100


def test_parse_note_detail():
    from app.services.xhs import XhsService
    service = XhsService.__new__(XhsService)
    raw_detail = {
        "title": "测试笔记",
        "desc": "这是正文内容",
        "type": "normal",
        "image_list": [{"url_default": "https://img1.url"}, {"url_default": "https://img2.url"}],
        "video": {"media_stream": {"h264": [{"master_url": "https://video.url"}]}},
        "tag_list": [{"name": "测试"}],
        "user": {"nickname": "作者", "avatar": "https://avatar.url"},
        "interact_info": {"liked_count": "10", "collected_count": "5", "comment_count": "2"},
    }
    result = service.parse_note_detail("abc123", raw_detail)
    assert result["note_id"] == "abc123"
    assert result["content"] == "这是正文内容"
    assert len(result["images"]) == 2
    assert result["video_url"] == "https://video.url"
    assert result["note_type"] == "normal"
