"""A tiny synthetic archive with the same shape as fma_metadata.zip.

Used by the tests and by CI to run the whole pipeline without the 342 MiB download. The names,
texts and numbers are invented; the file layout (header rows, column order, quoting, empty
licenses, a raw track that tracks.csv does not have) copies the real files.

    python -m resonance_data fma sample --out /tmp/fma_sample.zip
"""

import csv
import io
import zipfile
from pathlib import Path


def _group(group: str, fields: str) -> list[tuple[str, str]]:
    return [(group, field) for field in fields.split()]


TRACKS_COLUMNS = (
    _group(
        "album",
        "comments date_created date_released engineer favorites id information listens "
        "producer tags title tracks type",
    )
    + _group(
        "artist",
        "active_year_begin active_year_end associated_labels bio comments date_created "
        "favorites id latitude location longitude members name related_projects tags website "
        "wikipedia_page",
    )
    + _group("set", "split subset")
    + _group(
        "track",
        "bit_rate comments composer date_created date_recorded duration favorites genre_top "
        "genres genres_all information interest language_code license listens lyricist "
        "number publisher tags title",
    )
)

RAW_TRACKS_COLUMNS = (
    "track_id album_id album_title album_url artist_id artist_name artist_url artist_website "
    "license_image_file license_image_file_large license_parent_id license_title license_url "
    "tags track_bit_rate track_comments track_composer track_copyright_c track_copyright_p "
    "track_date_created track_date_recorded track_disc_number track_duration track_explicit "
    "track_explicit_notes track_favorites track_file track_genres track_image_file "
    "track_information track_instrumental track_interest track_language_code track_listens "
    "track_lyricist track_number track_publisher track_title track_url"
).split()

BY_NC_SA = ("Attribution-NonCommercial-ShareAlike 3.0 International", "by-nc-sa/3.0/")
BY = ("Attribution", "by/4.0/")
CC0 = ("CC0 1.0 Universal", "zero/1.0/")

# track_id, title, album_id, artist_id, subset, split, genre_top, genres, license (title, path)
TRACKS = [
    (2, "Food", 1, 1, "small", "training", "Hip-Hop", "[21]", BY_NC_SA),
    (3, "Electric Ave", 1, 1, "small", "training", "Hip-Hop", "[21, 12]", BY_NC_SA),
    (10, "Rain, Rain, Go Away", 2, 2, "small", "validation", "Jazz", "[4]", BY),
    (20, 'The "Long" Night', 3, 3, "medium", "test", "Electronic", "[15]", BY),
    (30, "No Licence Given", 3, 3, "medium", "training", "", "[]", ("", "")),
    (40, "Public Song", 3, 3, "large", "training", "Rock", "[12]", CC0),
]
ARTISTS = {1: "AWOL", 2: "Night Owl Trio", 3: "Quiet Machines"}
ALBUMS = {1: "A Way Of Life", 2: "After Hours", 3: "Longer Than Night"}
ARTIST_BIO = {3: 'Line one.\nLine two, with a comma and "quotes".'}
GENRES = [
    (21, 8693, 38, "Hip-Hop", 21),
    (12, 9000, 0, "Rock", 12),
    (4, 3000, 0, "Jazz", 4),
    (15, 7000, 0, "Electronic", 15),
]
ECHONEST_TRACKS = {
    2: (0.41, 0.67, 0.63, 0.01, 0.17, 0.15, 165.9, 0.57),
    3: (0.37, 0.52, 0.81, 0.00, 0.10, 0.46, 126.9, 0.26),
    10: (0.90, 0.30, 0.20, 0.85, 0.12, 0.04, 88.1, 0.31),
}
ECHONEST_COLUMNS = _group(
    "audio_features",
    "acousticness danceability energy instrumentalness liveness speechiness tempo valence",
) + _group("temporal_features", "000 001 002")


def _rows(rows: list[list[str]]) -> str:
    out = io.StringIO()
    csv.writer(out, lineterminator="\n").writerows(rows)
    return out.getvalue()


def tracks_csv() -> str:
    groups = [""] + [group for group, _ in TRACKS_COLUMNS]
    fields = [""] + [field for _, field in TRACKS_COLUMNS]
    header = [groups, fields, ["track_id"] + [""] * len(TRACKS_COLUMNS)]
    data = []
    for track_id, title, album_id, artist_id, subset, split, genre_top, genres, lic in TRACKS:
        values = {
            ("album", "id"): str(album_id),
            ("album", "title"): ALBUMS[album_id],
            ("album", "date_released"): "2009-01-05 00:00:00",
            ("artist", "id"): str(artist_id),
            ("artist", "name"): ARTISTS[artist_id],
            ("artist", "bio"): ARTIST_BIO.get(artist_id, ""),
            ("set", "split"): split,
            ("set", "subset"): subset,
            ("track", "title"): title,
            ("track", "duration"): "168",
            ("track", "genre_top"): genre_top,
            ("track", "genres"): genres,
            ("track", "genres_all"): genres,
            ("track", "license"): lic[0],
            ("track", "listens"): str(1000 + track_id),
            ("track", "language_code"): "en",
        }
        data.append([str(track_id)] + [values.get(column, "") for column in TRACKS_COLUMNS])
    return _rows(header + data)


def raw_tracks_csv() -> str:
    tracks = [(t[0], t[1], t[2], t[3], t[8]) for t in TRACKS]
    tracks.append((99, "Orphan Raw", 3, 3, BY))  # only in raw_tracks, as in the real archive
    data = []
    for track_id, title, album_id, artist_id, lic in tracks:
        values = {
            "track_id": str(track_id),
            "album_id": str(album_id),
            "artist_id": str(artist_id),
            "artist_name": ARTISTS[artist_id],
            "license_title": lic[0],
            "license_url": f"http://creativecommons.org/licenses/{lic[1]}" if lic[1] else "",
            "track_title": title,
            "track_url": f"http://freemusicarchive.org/music/sample/{track_id}/",
        }
        data.append([values.get(column, "") for column in RAW_TRACKS_COLUMNS])
    return _rows([RAW_TRACKS_COLUMNS] + data)


def genres_csv() -> str:
    return _rows(
        [["genre_id", "#tracks", "parent", "title", "top_level"]]
        + [list(map(str, g)) for g in GENRES]
    )


def echonest_csv() -> str:
    width = len(ECHONEST_COLUMNS)
    header = [
        [""] + ["echonest"] * width,
        [""] + [group for group, _ in ECHONEST_COLUMNS],
        [""] + [field for _, field in ECHONEST_COLUMNS],
        ["track_id"] + [""] * width,
    ]
    data = [
        [str(track_id), *map(str, values), "0.1", "0.2", "0.3"]
        for track_id, values in ECHONEST_TRACKS.items()
    ]
    return _rows(header + data)


def write_sample_archive(path: Path) -> None:
    members = {
        "tracks.csv": tracks_csv(),
        "raw_tracks.csv": raw_tracks_csv(),
        "genres.csv": genres_csv(),
        "echonest.csv": echonest_csv(),
        "README.txt": "Synthetic sample with the shape of fma_metadata.zip.\n",
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, text in members.items():
            archive.writestr(f"fma_metadata/{name}", text)
