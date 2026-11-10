"""Where photo files are saved: the `PhotoStorage` interface and its local disk
implementation (AD-14).

Only `photos.service` uses a storage. To move to S3-like storage later, we only need
to write another class that implements this Protocol.
"""

import logging
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, Protocol

logger = logging.getLogger(__name__)

Variant = Literal["full", "thumb"]


@dataclass(frozen=True)
class StoredPhoto:
    key: str
    modified: datetime


class PhotoStorage(Protocol):
    def save(self, key: str, variant: Variant, data: bytes) -> None: ...

    def exists(self, key: str) -> bool: ...

    def delete(self, key: str) -> None:
        """Deletes all the files of the photo. A missing file is not an error."""
        ...

    def list_photos(self) -> list[StoredPhoto]: ...


def file_name(key: str, variant: Variant) -> str:
    """Returns the file name. It is also the last part of the URL under
    `/media/photos/`."""
    return f"{key}.webp" if variant == "full" else f"{key}-thumb.webp"


class LocalPhotoStorage:
    """Saves photos as files in one folder, on the same disk as the database."""

    def __init__(self, root: Path) -> None:
        self._root = root

    def save(self, key: str, variant: Variant, data: bytes) -> None:
        self._root.mkdir(parents=True, exist_ok=True)
        target = self._root / file_name(key, variant)
        # Write to a temporary file and then rename it, so nobody reads half a file.
        partial = target.with_suffix(".partial")
        partial.write_bytes(data)
        os.replace(partial, target)

    def exists(self, key: str) -> bool:
        return (self._root / file_name(key, "full")).is_file()

    def delete(self, key: str) -> None:
        for variant in ("full", "thumb"):
            try:
                (self._root / file_name(key, variant)).unlink(missing_ok=True)
            except OSError:
                # The database row is already deleted. A file left behind is
                # cleaned up at the next startup.
                logger.warning("Could not delete photo file for %s", key)

    def list_photos(self) -> list[StoredPhoto]:
        if not self._root.is_dir():
            return []
        return [
            StoredPhoto(
                key=path.stem,
                modified=datetime.fromtimestamp(path.stat().st_mtime, UTC),
            )
            for path in self._root.glob("*.webp")
            if not path.stem.endswith("-thumb")
        ]
