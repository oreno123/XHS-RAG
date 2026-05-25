from unittest.mock import MagicMock, patch


def test_build_note_content():
    from app.services.rag import RAGService
    svc = RAGService.__new__(RAGService)
    note_data = {
        "note_id": "abc123",
        "title": "Python教程",
        "content": "这是正文内容",
        "tags": ["Python", "编程"],
    }
    content = svc._build_note_content(note_data)
    assert "Python教程" in content
    assert "这是正文内容" in content
    assert "Python" in content


def test_build_note_content_short():
    from app.services.rag import RAGService
    svc = RAGService.__new__(RAGService)
    note_data = {
        "note_id": "abc",
        "title": "短",
        "content": "",
        "tags": [],
    }
    content = svc._build_note_content(note_data)
    assert content == ""
