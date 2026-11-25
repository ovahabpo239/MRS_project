import hashlib
from pathlib import Path

import pytest

from resonance_data.fma import download


def test_fetch_copies_a_local_file_and_returns_its_sha1(
    sample_archive: Path, tmp_path: Path
) -> None:
    expected = hashlib.sha1(sample_archive.read_bytes(), usedforsecurity=False).hexdigest()
    dest = tmp_path / "copy.zip"
    assert download.fetch(str(sample_archive), dest, expected) == expected
    assert dest.read_bytes() == sample_archive.read_bytes()


def test_fetch_rejects_a_wrong_checksum_and_removes_the_file(
    sample_archive: Path, tmp_path: Path
) -> None:
    dest = tmp_path / "copy.zip"
    with pytest.raises(download.ChecksumError):
        download.fetch(str(sample_archive), dest, "0" * 40)
    assert not dest.exists()


def test_fetch_without_expected_checksum_skips_verification(
    sample_archive: Path, tmp_path: Path
) -> None:
    assert download.fetch(str(sample_archive), tmp_path / "copy.zip", None)


def test_batch_id_and_key() -> None:
    sha = download.FMA_METADATA_SHA1
    assert download.batch_id_for(sha) == "f0df49ffe5f2"
    assert download.raw_key("f0df49ffe5f2") == "bronze/fma/_raw/f0df49ffe5f2/fma_metadata.zip"
