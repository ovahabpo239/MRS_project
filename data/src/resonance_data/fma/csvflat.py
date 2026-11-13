"""Turns the FMA CSVs, which have 1 to 4 header rows, into plain single-header CSVs.

tracks.csv:    row 0 group (album, artist, set, track), row 1 field, row 2 the index name
echonest.csv:  row 0 constant 'echonest', row 1 group, row 2 field, row 3 the index name
genres.csv, raw_tracks.csv: one ordinary header row

Column names become `<group>_<field>` in snake case, e.g. `album_id`, `track_title`,
`audio_features_energy`. Nothing is dropped or retyped here: bronze keeps the data as delivered.
"""

import csv
import re
import sys
from dataclasses import dataclass
from typing import TextIO


@dataclass(frozen=True)
class CsvSpec:
    table: str  # bronze table name; the archive member is `<table>.csv`
    required: tuple[str, ...]  # columns that must exist after flattening
    header_rows: int = 1
    name_rows: tuple[int, ...] = (0,)  # header rows whose cells are joined into the column name

    @property
    def member(self) -> str:
        return f"{self.table}.csv"


def sanitize(name: str) -> str:
    """Delta-safe snake_case: lower case, runs of non-alphanumerics become one underscore."""
    cleaned = re.sub(r"[^a-z0-9]+", "_", name.strip().lower().replace("#", "n_")).strip("_")
    if not cleaned:
        raise ValueError(f"column name {name!r} is empty after cleaning")
    return cleaned


def column_names(header: list[list[str]], spec: CsvSpec) -> list[str]:
    # The first column is the index, named in the last header row; the others join their name rows.
    raw = [header[-1][0] or "index"] + [
        "_".join(header[row][col] for row in spec.name_rows if header[row][col])
        for col in range(1, len(header[0]))
    ]
    names = [sanitize(name) for name in raw]
    duplicates = {name for name in names if names.count(name) > 1}
    if duplicates:
        raise ValueError(f"{spec.member}: duplicate column names {sorted(duplicates)}")
    return names


def flatten_csv(src: TextIO, dst: TextIO, spec: CsvSpec) -> int:
    """Writes src to dst with one header row; returns the number of data rows."""
    csv.field_size_limit(sys.maxsize)  # artist bios exceed the default 128 KiB limit
    reader = csv.reader(src)
    header = [next(reader) for _ in range(spec.header_rows)]
    names = column_names(header, spec)
    missing = [column for column in spec.required if column not in names]
    if missing:
        raise ValueError(f"{spec.member}: missing required columns {missing}")

    writer = csv.writer(dst, lineterminator="\n")
    writer.writerow(names)
    count = 0
    for row in reader:
        if len(row) != len(names):
            raise ValueError(
                f"{spec.member}: data row {count + 1} has {len(row)} fields, expected {len(names)}"
            )
        writer.writerow(row)
        count += 1
    return count
