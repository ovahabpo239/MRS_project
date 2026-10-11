import logging
import os

from fastapi import FastAPI
from pydantic import BaseModel

from feed import __version__
from feed.logging_setup import configure_logging
from feed.telemetry import setup_telemetry

SERVICE_NAME = "feed"
log = logging.getLogger("feed")


class Status(BaseModel):
    status: str


class Ping(BaseModel):
    message: str
    service: str
    version: str


def create_app() -> FastAPI:
    configure_logging(os.environ.get("LOG_LEVEL", "INFO"))
    app = FastAPI(title="Resonance Feed", version=__version__)

    @app.get("/healthz", response_model=Status, tags=["ops"])
    def healthz() -> Status:
        """Liveness: the process is up."""
        return Status(status="ok")

    @app.get("/readyz", response_model=Status, tags=["ops"])
    def readyz() -> Status:
        """Readiness: dependencies are reachable. No dependencies yet."""
        return Status(status="ok")

    @app.get("/v1/ping", response_model=Ping, tags=["feed"])
    def ping() -> Ping:
        log.info("ping handled", extra={"route": "/v1/ping"})
        return Ping(message="pong", service=SERVICE_NAME, version=__version__)

    instrumented = setup_telemetry(app, SERVICE_NAME, __version__)
    log.info("feed started", extra={"telemetry": instrumented, "version": __version__})
    return app


app = create_app()
