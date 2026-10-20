import pytest

from feed.telemetry import build_resource


def test_resource_carries_revision_when_git_sha_is_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GIT_SHA", "abc1234")
    attributes = build_resource("feed", "0.1.0").attributes
    assert attributes["service.name"] == "feed"
    assert attributes["service.version"] == "0.1.0"
    assert attributes["vcs.ref.head.revision"] == "abc1234"


@pytest.mark.parametrize("value", [None, ""])
def test_resource_has_no_revision_without_git_sha(
    monkeypatch: pytest.MonkeyPatch, value: str | None
) -> None:
    if value is None:
        monkeypatch.delenv("GIT_SHA", raising=False)
    else:
        monkeypatch.setenv("GIT_SHA", value)
    assert "vcs.ref.head.revision" not in build_resource("feed", "0.1.0").attributes
