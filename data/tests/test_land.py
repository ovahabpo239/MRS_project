"""Landing against the real local lake. Skipped unless `make lake-up` is running."""

from pathlib import Path

import pytest

from resonance_data.fma import download
from resonance_data.lake_s3 import LakeStore


@pytest.mark.lake
def test_land_uploads_once_and_marks_latest(sample_archive: Path, lake_bucket: str) -> None:
    store = LakeStore()
    sha1 = download.sha1_of(sample_archive)
    batch = download.batch_id_for(sha1)

    assert download.land(sample_archive, sha1, store) == batch
    assert store.exists(download.raw_key(batch))
    # Landing the same file again is a no-op.
    assert download.land(sample_archive, sha1, store) == batch
    assert store.get_text(download.LATEST_KEY) == batch

    target = sample_archive.parent / "back.zip"
    store.download(download.raw_key(batch), target)
    assert target.read_bytes() == sample_archive.read_bytes()
