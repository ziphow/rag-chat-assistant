"""
让 langchain-openai 透传 Qwen 等第三方兼容模型的思考内容（reasoning_content）。

背景：langchain-openai 只针对 ChatGPT 的官方字段。而阿里云百炼 / DashScope
通过 OpenAI 兼容协议返回的 thinking 内容走非标准字段 delta.reasoning_content，
被 openai SDK 以 extra 字段保留（extra="allow"），但在 langchain-openai 的
_convertedelta_to_message_chunk 中被丢弃。

做法：monkeypatch 该模块级函数，复制原始逻辑后，把 delta 里的 reasoning_content
追加写入 AIMessageChunk.additional_kwargs["reasoning_content"]，供上层按流式增量读取。
"""
import langchain_openai.chat_models.base as _base  # noqa: N812

_ORIG_CONVERT_DELTA = _base._convert_delta_to_message_chunk  # type: ignore[attr-defined]


def _convert_delta_to_message_chunk(_dict, default_class):
    chunk = _ORIG_CONVERT_DELTA(_dict, default_class)
    reasoning = _dict.get("reasoning_content")
    if reasoning and getattr(chunk, "additional_kwargs", None) is not None:
        # 每个 chunk 的 reasoning_content 是增量文本，直接覆盖记录当前增量
        chunk.additional_kwargs["reasoning_content"] = reasoning
    return chunk


_base._convert_delta_to_message_chunk = _convert_delta_to_message_chunk  # type: ignore[attr-defined]