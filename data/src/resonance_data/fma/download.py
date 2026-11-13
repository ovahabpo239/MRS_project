"""Fetches fma_metadata.zip, verifies it and lands an immutable raw copy in the lake.

The landing key is derived from the file's SHA-1, so landing the same file twice is a no-op and
every bronze row can be traced to the exact bytes it came from.
"""

import hashlib
import shutil
import urllib.request
from pathlib import Path

from resonance_data.lake_s3 import LakeStore

# Source: https://github.com/mdeff/fma (README, "Data" and "Checksums")
FMA_METADATA_URL = "https://os.unil.cloud.switch.ch/fma/fma_metadata.zip"
FMA_METADATA_SHA1 = "f0df49ffe5f2a6008d7dc83c6915b31835dfe733"

RAW_PREFIX = "bronze/fma/_raw"
LATEST_KEY = f"{RAW_PREFIX}/LATEST"
ARCHIVE_NAME = "fma_metadata.zip"


class ChecksumError(RuntimeError):
    pass


def sha1_of(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha1").hexdigest()


def fetch(source: str, dest: Path, expected_sha1: str | None) -> str:
    """Copies a local path or downloads an http(s) URL to dest; returns the SHA-1.

    Raises ChecksumError if expected_sha1 is given and does not match; dest is removed then.
    """
    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source) as response, dest.open("wb") as out:
            shutil.copyfileobj(response, out, 1 << 20)
    else:
        shutil.copyfile(source, dest)
    actual = sha1_of(dest)
    if expected_sha1 and actual != expected_sha1:
        dest.unlink()
        raise ChecksumError(f"{source}: sha1 {actual} != expected {expected_sha1}")
    return actual


def batch_id_for(sha1: str) -> str:
    return sha1[:12]


def raw_key(batch_id: str) -> str:
    return f"{RAW_PREFIX}/{batch_id}/{ARCHIVE_NAME}"


def land(archive: Path, sha1: str, store: LakeStore) -> str:
    """Uploads the archive under its batch id (once) and marks it as the latest batch."""
    batch_id = batch_id_for(sha1)
    key = raw_key(batch_id)
    if store.exists(key):
        print(f"batch {batch_id} already landed at {key}")
    else:
        store.upload(archive, key)
        print(f"landed {archive.name} as batch {batch_id} at {key}")
    store.put_text(LATEST_KEY, batch_id)
    return batch_id
