"""Plain S3 access to the lake bucket, for files that are not Delta tables (raw landing copies).

Uses the same env vars as `resonance_data.spark`: S3_ENDPOINT, AWS_REGION, AWS_* credentials.
"""

import os
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


class LakeStore:
    def __init__(self) -> None:
        self.bucket = os.environ.get("LAKE_BUCKET", "lake")
        endpoint = os.environ.get("S3_ENDPOINT")
        self._s3: Any = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=os.environ.get("AWS_REGION", "us-east-1"),
            # A custom endpoint such as http://lake:9000 has no bucket sub-domains.
            config=Config(s3={"addressing_style": "path"}) if endpoint else None,
        )

    def exists(self, key: str) -> bool:
        try:
            self._s3.head_object(Bucket=self.bucket, Key=key)
        except ClientError as error:
            # HEAD responses have no body, so the error code is just the HTTP status.
            if error.response["Error"]["Code"] == "404":
                return False
            raise
        return True

    def upload(self, path: Path, key: str) -> None:
        self._s3.upload_file(str(path), self.bucket, key)

    def download(self, key: str, path: Path) -> None:
        self._s3.download_file(self.bucket, key, str(path))

    def ensure_bucket(self) -> None:
        try:
            self._s3.head_bucket(Bucket=self.bucket)
        except ClientError:
            self._s3.create_bucket(Bucket=self.bucket)

    def empty(self) -> None:
        """Deletes every object in the bucket (for test buckets)."""
        for page in self._s3.get_paginator("list_objects_v2").paginate(Bucket=self.bucket):
            for obj in page.get("Contents", []):
                self._s3.delete_object(Bucket=self.bucket, Key=obj["Key"])

    def put_text(self, key: str, text: str) -> None:
        self._s3.put_object(Bucket=self.bucket, Key=key, Body=text.encode())

    def get_text(self, key: str) -> str:
        body: bytes = self._s3.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        return body.decode()
