def test_parse_category_response():
    from app.services.classifier import ClassifierService
    svc = ClassifierService.__new__(ClassifierService)
    assert svc._parse_category_name("Python") == "Python"
    assert svc._parse_category_name("前端开发") == "前端开发"
    assert svc._parse_category_name("分类：美食探店") == "美食探店"
    assert svc._parse_category_name("这个笔记属于【Python入门】分类") == "Python入门"


def test_build_classify_prompt():
    from app.services.classifier import ClassifierService
    svc = ClassifierService.__new__(ClassifierService)
    prompt = svc._build_prompt("Python入门教程", "这篇讲的是...", ["Python", "编程"], ["Python", "前端"])
    assert "Python入门教程" in prompt
    assert "Python" in prompt
    assert "前端" in prompt
