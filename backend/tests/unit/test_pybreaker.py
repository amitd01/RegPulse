"""Tests for the LLM circuit breaker (G-10 / slice 10b).

Verifies the pybreaker wrapper around Anthropic-primary calls trips after
3 consecutive failures and short-circuits to OpenAI on subsequent calls
until reset_timeout elapses.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import anthropic
import openai
import pybreaker
import pytest

from app.services.llm_service import ANTHROPIC_BREAKER, LLMService


@pytest.fixture(autouse=True)
def _reset_breaker():
    """Reset the singleton breaker between tests."""
    ANTHROPIC_BREAKER.close()
    yield
    ANTHROPIC_BREAKER.close()


def _make_service() -> LLMService:
    return LLMService(
        anthropic_client=AsyncMock(spec=anthropic.AsyncAnthropic),
        openai_client=AsyncMock(spec=openai.AsyncOpenAI),
    )


class TestBreakerConfiguration:
    def test_breaker_thresholds(self):
        assert ANTHROPIC_BREAKER.fail_max == 3
        assert ANTHROPIC_BREAKER.reset_timeout == 60
        assert ANTHROPIC_BREAKER.name == "anthropic-primary"

    def test_breaker_starts_closed(self):
        assert ANTHROPIC_BREAKER.current_state == "closed"
        assert ANTHROPIC_BREAKER.fail_counter == 0

    def test_breaker_excludes_programming_errors(self):
        # ValueError/TypeError/AttributeError should NOT count toward the fail
        # counter — those are bugs, not provider outages
        for exc in (ValueError("bug"), TypeError("bug"), AttributeError("bug")):

            def _raise(e=exc):
                raise e

            try:
                ANTHROPIC_BREAKER.call(_raise)
            except type(exc):
                pass
        assert ANTHROPIC_BREAKER.fail_counter == 0


class TestBreakerTripping:
    def test_three_anthropic_failures_open_breaker(self):
        def _raise():
            raise anthropic.APIConnectionError(request=None)  # type: ignore[arg-type]

        for _ in range(3):
            with pytest.raises((anthropic.APIConnectionError, pybreaker.CircuitBreakerError)):
                ANTHROPIC_BREAKER.call(_raise)

        assert ANTHROPIC_BREAKER.current_state == "open"
        assert ANTHROPIC_BREAKER.fail_counter == 3

    def test_open_breaker_raises_circuit_breaker_error(self):
        def _raise():
            raise anthropic.APITimeoutError(request=None)  # type: ignore[arg-type]

        # Trip the breaker (3 consecutive failures)
        for _ in range(3):
            with pytest.raises((anthropic.APITimeoutError, pybreaker.CircuitBreakerError)):
                ANTHROPIC_BREAKER.call(_raise)

        # Next call should be short-circuited (no provider call made)
        with pytest.raises(pybreaker.CircuitBreakerError):
            ANTHROPIC_BREAKER.call(lambda: "should not run")


class TestBreakerRecovery:
    def test_successful_call_resets_counter(self):
        def _raise():
            raise anthropic.APIConnectionError(request=None)  # type: ignore[arg-type]

        # Two failures (under threshold)
        for _ in range(2):
            with pytest.raises(anthropic.APIConnectionError):
                ANTHROPIC_BREAKER.call(_raise)
        assert ANTHROPIC_BREAKER.fail_counter == 2

        # Successful call resets the counter
        result = ANTHROPIC_BREAKER.call(lambda: "ok")
        assert result == "ok"
        assert ANTHROPIC_BREAKER.fail_counter == 0
        assert ANTHROPIC_BREAKER.current_state == "closed"
