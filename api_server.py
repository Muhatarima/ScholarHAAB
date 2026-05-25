from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import AsyncIterator

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(__file__))
from tutor_engine import answer


app = FastAPI(title="ScholarHAAB Tutor API")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "https://scholarhaaab.com,https://scholorhaab.vercel.app").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    subject: str | None = None
    level: str | None = None
    user_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    topics_needed: list[str]
    repeated: bool
    source: str | None
    tokens_used: int
    from_cache: bool


def _normalize_payload(message: str, subject: str | None, level: str | None, user_id: str | None) -> ChatRequest:
    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="message is required")
    return ChatRequest(message=message.strip(), subject=subject, level=level, user_id=user_id)


async def _apply_optional_delay(delay_ms: str | None) -> None:
    if not delay_ms:
        return
    try:
        value = int(delay_ms)
    except ValueError as error:
        raise HTTPException(status_code=400, detail="invalid delay header") from error
    if value > 0:
        await asyncio.sleep(value / 1000)


async def _run_tutor(payload: ChatRequest) -> dict:
    return await asyncio.to_thread(
        answer,
        user_input=payload.message,
        subject=payload.subject,
        level=payload.level,
        user_id=payload.user_id,
    )


@app.post("/api/qbank/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    x_tutor_test_delay_ms: str | None = Header(default=None, alias="x-tutor-test-delay-ms"),
) -> ChatResponse:
    payload = _normalize_payload(req.message, req.subject, req.level, req.user_id)
    await _apply_optional_delay(x_tutor_test_delay_ms)
    try:
        result = await _run_tutor(payload)
        return ChatResponse(**result)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


async def _stream_answer(payload: ChatRequest, delay_ms: str | None) -> AsyncIterator[str]:
    await _apply_optional_delay(delay_ms)
    result = await _run_tutor(payload)
    words = result["answer"].split(" ")
    for word in words:
        yield f"data: {word} \n\n"
        await asyncio.sleep(0.03)

    meta = {key: value for key, value in result.items() if key != "answer"}
    yield f"data: [META]{json.dumps(meta, ensure_ascii=False)}\n\n"
    yield "data: [DONE]\n\n"


@app.get("/api/qbank/chat/stream")
async def chat_stream_get(
    message: str = Query(...),
    subject: str | None = Query(default=None),
    level: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    x_tutor_test_delay_ms: str | None = Header(default=None, alias="x-tutor-test-delay-ms"),
) -> StreamingResponse:
    payload = _normalize_payload(message, subject, level, user_id)
    return StreamingResponse(
        _stream_answer(payload, x_tutor_test_delay_ms),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    )


@app.post("/api/qbank/chat/stream")
async def chat_stream_post(
    req: ChatRequest,
    x_tutor_test_delay_ms: str | None = Header(default=None, alias="x-tutor-test-delay-ms"),
) -> StreamingResponse:
    payload = _normalize_payload(req.message, req.subject, req.level, req.user_id)
    return StreamingResponse(
        _stream_answer(payload, x_tutor_test_delay_ms),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        workers=4,
        loop="uvloop" if os.name != "nt" else "asyncio",
        timeout_keep_alive=30,
    )
