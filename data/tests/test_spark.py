import pytest

from resonance_data.spark import lake_uri


def test_lake_uri_builds_s3a_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LAKE_BUCKET", "my-lake")
    assert lake_uri("silver", "fma", "tracks") == "s3a://my-lake/silver/fma/tracks"


def test_lake_uri_defaults_to_lake_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LAKE_BUCKET", raising=False)
    assert lake_uri("bronze") == "s3a://lake/bronze"


def test_lake_uri_rejects_unknown_layer() -> None:
    with pytest.raises(ValueError, match="unknown layer"):
        lake_uri("platinum")
