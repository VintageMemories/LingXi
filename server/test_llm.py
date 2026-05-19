import httpx
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

llm = ChatOpenAI(
    model="deepseek-chat",
    api_key="sk-6e997c205fc942ecb3028d462a68f27b",
    base_url="https://api.deepseek.com",
    temperature=0.7,
    request_timeout=httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=5.0),
    http_client=httpx.Client(verify=False),
)

try:
    response = llm.invoke([
        SystemMessage(content="你是一个助手"),
        HumanMessage(content="你好"),
    ])
    print("成功:", response.content)
except Exception as e:
    import traceback
    traceback.print_exc()