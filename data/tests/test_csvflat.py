import csv
import io
import zipfile
from pathlib import Path

import pytest

from resonance_data.fma.bronze import SPECS
from resonance_data.fma.csvflat import CsvSpec, column_names, flatten_csv, sanitize

SPEC = {spec.table: spec for spec in SPECS}


def flatten(archive: Path, table: str) -> tuple[str, int]:
    spec = SPEC[table]
    with zipfile.ZipFile(archive) as z, z.open(f"fma_metadata/{spec.member}") as raw:
        out = io.StringIO()
        rows = flatten_csv(io.TextIOWrapper(raw, encoding="utf-8", newline=""), out, spec)
    return out.getvalue(), rows


def test_sanitize() -> None:
    assert sanitize("#tracks") == "n_tracks"
    assert sanitize(" Album Date ") == "album_date"
    assert sanitize("000") == "000"
    with pytest.raises(ValueError, match="empty"):
        sanitize("  --  ")


def test_tracks_header_is_flattened_to_group_field(sample_archive: Path) -> None:
    text, rows = flatten(sample_archive, "tracks")
    header = text.splitlines()[0].split(",")
    assert header[0] == "track_id"
    assert {"album_id", "artist_id", "artist_bio", "set_subset", "track_license"} <= set(header)
    assert len(header) == 53
    assert rows == 6


def test_echonest_skips_the_constant_top_row(sample_archive: Path) -> None:
    text, rows = flatten(sample_archive, "echonest")
    header = text.splitlines()[0].split(",")
    assert header[:3] == ["track_id", "audio_features_acousticness", "audio_features_danceability"]
    assert header[-1] == "temporal_features_002"
    assert rows == 3


def test_genres_hash_column_is_renamed(sample_archive: Path) -> None:
    text, _ = flatten(sample_archive, "genres")
    assert text.splitlines()[0] == "genre_id,n_tracks,parent,title,top_level"


def test_embedded_newlines_and_quotes_survive(sample_archive: Path) -> None:
    text, _ = flatten(sample_archive, "tracks")
    rows = list(csv.DictReader(io.StringIO(text)))
    bio = next(r["artist_bio"] for r in rows if r["artist_id"] == "3")
    assert bio == 'Line one.\nLine two, with a comma and "quotes".'


def test_ragged_row_is_rejected() -> None:
    with pytest.raises(ValueError, match="data row 1 has 1 fields, expected 2"):
        flatten_csv(io.StringIO("a,b\n1\n"), io.StringIO(), CsvSpec("x", ("a",)))


def test_missing_required_column_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"missing required columns \['z'\]"):
        flatten_csv(io.StringIO("a,b\n1,2\n"), io.StringIO(), CsvSpec("x", ("a", "z")))


def test_duplicate_names_are_rejected() -> None:
    with pytest.raises(ValueError, match="duplicate column names"):
        column_names([["Name", "name"]], CsvSpec("x", ()))
