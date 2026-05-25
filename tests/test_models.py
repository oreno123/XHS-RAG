def test_import_models():
    from app.models import XhsSession, Note, Category, ChatMessage, Base
    assert XhsSession.__tablename__ == "xhs_sessions"
    assert Note.__tablename__ == "notes"
    assert Category.__tablename__ == "categories"
    assert ChatMessage.__tablename__ == "chat_messages"
