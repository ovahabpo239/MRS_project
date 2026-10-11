"""Write the service's OpenAPI document to a file (used for contract tests and docs)."""

import json
import sys
from pathlib import Path

from feed.main import app


def main() -> None:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "openapi.json")
    target.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n")
    print(f"wrote {target}")


if __name__ == "__main__":
    main()
