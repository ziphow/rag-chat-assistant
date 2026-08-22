"""模型额度管理器：按优先级列表以"固化切换"方式自动替换已无额度的模型。"""
import logging
import os
from typing import Callable, List

from langchain.chat_models import init_chat_model

logger = logging.getLogger(__name__)

_QUOTA_MARKERS = (
    "quota", "ratelimit", "rate limit", "throttl",
    "insufficient", "used up", "exceed", "限额", "额度", "免费", "配额",
)


def is_quota_error(exc: BaseException) -> bool:
    """判断异常是否为额度/配额不足，是则允许切换候选模型。"""
    try:
        import openai
        if isinstance(exc, openai.RateLimitError):
            return True
        from openai import APIStatusError
        if isinstance(exc, APIStatusError) and exc.status_code == 429:
            return True
    except Exception:
        pass
    low = f"{getattr(exc, 'message', '')} {getattr(exc, 'type', '')} {exc}".lower()
    return any(marker in low for marker in _QUOTA_MARKERS)


class ModelQuotaManager:
    """一个分类（对话/标题）对应一个实例。优先级列表来自环境变量，耗尽即固化切换。"""

    def __init__(self, priority_var: str, candidates_default: List[str],
                 build_llm: Callable[[str], object]):
        raw = (os.getenv(priority_var) or "").strip()
        self._candidates = [m.strip() for m in raw.split(",") if m.strip()] if raw \
            else list(candidates_default)
        if not self._candidates:
            self._candidates = list(candidates_default)
        self._build_llm = build_llm
        self._unavailable = set()
        self._cursor = 0

    @property
    def current_model(self) -> str:
        return self._candidates[self._cursor]

    def current_llm(self):
        return self._build_llm(self.current_model)

    def remaining_count(self) -> int:
        return len(self._candidates) - self._cursor

    def mark_current_unavailable(self) -> bool:
        """剔除当前模型并固化切到下一个可用候选。成功返回 True，全部耗尽返回 False。"""
        if self._cursor >= len(self._candidates):
            return False
        self._unavailable.add(self._candidates[self._cursor])
        nxt = self._cursor + 1
        while nxt < len(self._candidates) and self._candidates[nxt] in self._unavailable:
            nxt += 1
        if nxt < len(self._candidates):
            self._cursor = nxt
            logger.warning("模型额度用尽，已固化切换到：%s", self._candidates[nxt])
            return True
        self._cursor = len(self._candidates)
        logger.error("优先级列表 %s 中的模型均已耗尽", self._candidates)
        return False