import json
import logging
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from feed import __version__
from feed.logging_setup import JsonFormatter
from feed.main import create_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


@pytest.mark.parametrize("path", ["/healthz", "/readyz"])
def test_probes_return_ok(client: TestClient, path: str) -> None:
    response = client.get(path)
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ping_reports_service_and_version(client: TestClient) -> None:
    response = client.get("/v1/ping")
    assert response.status_code == 200
    assert response.json() == {"message": "pong", "service": "feed", "version": __version__}


def test_openapi_snapshot_is_current(client: TestClient) -> None:
    """Fails when the API changed without re-running `make openapi`."""
    snapshot = Path(__file__).parents[1] / "openapi.json"
    assert json.loads(snapshot.read_text()) == client.get("/openapi.json").json()


def test_json_formatter_includes_extra_fields() -> None:
    record = logging.LogRecord("feed", logging.INFO, __file__, 1, "hello %s", ("you",), None)
    record.route = "/v1/ping"
    payload = json.loads(JsonFormatter().format(record))
    assert payload["message"] == "hello you"
    assert payload["level"] == "INFO"
    assert payload["route"] == "/v1/ping"
