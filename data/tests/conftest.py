import os
import socket
from collections.abc import Iterator
from pathlib import Path
from urllib.parse import urlparse

import pytest
from pyspark.sql import SparkSession

from resonance_data.fma.sample import write_sample_archive
from resonance_data.lake_s3 import LakeStore
from resonance_data.spark import get_spark


@pytest.fixture
def sample_archive(tmp_path: Path) -> Path:
    path = tmp_path / "fma_metadata.zip"
    write_sample_archive(path)
    return path


@pytest.fixture
def local_lake(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Points the lake at a local directory, so Spark tests need no S3."""
    root = tmp_path / "lake"
    monkeypatch.setenv("LAKE_ROOT", f"file://{root}")
    return root


@pytest.fixture(scope="session")
def spark() -> Iterator[SparkSession]:
    session = get_spark("tests")
    yield session
    session.stop()


def _lake_reachable() -> bool:
    endpoint = os.environ.get("S3_ENDPOINT")
    if not endpoint:
        return False
    url = urlparse(endpoint)
    try:
        with socket.create_connection((url.hostname or "", url.port or 80), timeout=1):
            return True
    except OSError:
        return False


@pytest.fixture
def lake_bucket(monkeypatch: pytest.MonkeyPatch) -> Iterator[str]:
    """A separate, emptied bucket, so tests never touch the real `lake` bucket."""
    if not _lake_reachable():
        pytest.skip("local lake not reachable (make lake-up)")
    monkeypatch.setenv("LAKE_BUCKET", "lake-test")
    store = LakeStore()
    store.ensure_bucket()
    store.empty()
    yield "lake-test"
    store.empty()
