import json
import os
import urllib.request

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("ScholarHaab RAG")


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is not configured")
    return value


def post_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def supabase_rpc(function_name: str, payload: dict) -> dict:
    url = env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    return post_json(
        f"{url}/rest/v1/rpc/{function_name}",
        payload,
        {
            "Authorization": f"Bearer {key}",
            "apikey": key,
        },
    )


@mcp.tool()
def get_embedding(text: str) -> list[float]:
    key = env("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    payload = post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent",
        {
            "content": {"parts": [{"text": text[:8000]}]},
            "output_dimensionality": 384,
        },
        {"x-goog-api-key": key},
    )
    return payload["embedding"]["values"]


@mcp.tool()
def search_documents(query: str, limit: int = 5) -> list[dict]:
    rows = supabase_rpc(
        "search_documents_keyword",
        {"query_text": query, "match_count": max(1, min(limit, 8)), "filter": {}},
    )
    return rows if isinstance(rows, list) else []


@mcp.tool()
def ask_rag(question: str) -> dict:
    rows = search_documents(question, 5)
    context = "\n\n".join(
        f"[S{index + 1}] {row.get('source_title') or row.get('metadata', {}).get('source_file')}\n{row.get('content', '')[:1800]}"
        for index, row in enumerate(rows)
    )
    key = env("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    payload = post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                "Use the retrieved ScholarHaab context to answer the question. "
                                "Cite source IDs when useful.\n\n"
                                f"Context:\n{context}\n\nQuestion: {question}"
                            )
                        }
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.12, "maxOutputTokens": 1200},
        },
        {"x-goog-api-key": key},
    )
    text = "".join(
        part.get("text", "")
        for part in payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    )
    return {"answer": text, "sources": rows}


if __name__ == "__main__":
    mcp.run()
