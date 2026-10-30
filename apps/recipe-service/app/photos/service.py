"""Business rules for photos; other modules call this layer, never the repository."""

import uuid
from collections.abc import Collection
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.photos.schemas import PhotoLimits, PhotoRead
from app.photos.storage import LocalPhotoStorage, PhotoStorage

# Where `/media` is served from and the folder photos live in, under the data volume.
MEDIA_DIR = "media"
PHOTOS_DIR = "photos"
MEDIA_URL = "/media/photos"

FULL_SIZE = 1600
THUMB_SIZE = 600
WEBP_QUALITY = 80
# Pillow's names for the formats an upload may be, and the types we tell the client.
ACCEPTED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
UNATTACHED_MAX_AGE = timedelta(hours=24)


@dataclass(frozen=True)
class UploadLimits:
    max_bytes: int
    max_pixels: int


def _unsupported() -> AppError:
    return AppError(
        415,
        ErrorCode.PHOTO_UNSUPPORTED_TYPE,
        "Only JPEG, PNG and WebP images are accepted",
    )


def _too_large(max_bytes: int) -> AppError:
    return AppError(
        413,
        ErrorCode.PHOTO_TOO_LARGE,
        "The photo is too large",
        params={"max_mb": max_bytes // (1024 * 1024)},
    )


def _too_many_pixels() -> AppError:
    return AppError(
        413,
        ErrorCode.PHOTO_DIMENSIONS_TOO_LARGE,
        "The photo's dimensions are too large",
    )


def _encode(image: Image.Image) -> bytes:
    """WebP with no metadata: nothing is passed on, so nothing is written."""
    output = BytesIO()
    image.save(output, "WEBP", quality=WEBP_QUALITY, method=4)
    return output.getvalue()


class PhotoService:
    def __init__(self, storage: PhotoStorage, limits: UploadLimits) -> None:
        self._storage = storage
        self._limits = limits

    def limits(self) -> PhotoLimits:
        return PhotoLimits(
            max_bytes=self._limits.max_bytes,
            content_types=list(ACCEPTED_FORMATS.values()),
        )

    def store(self, data: bytes) -> str:
        """Turn an upload into a stored photo and return its (unattached) key.

        The type is read from the file itself, never from its name or declared type.
        Orientation is applied and all metadata dropped (EXIF can hold a GPS position);
        the picture is saved as WebP at most 1600 px wide plus a 600 px thumbnail.
        """
        if len(data) > self._limits.max_bytes:
            raise _too_large(self._limits.max_bytes)
        try:
            image = Image.open(BytesIO(data))
        except Image.DecompressionBombError as error:
            raise _too_many_pixels() from error
        except (UnidentifiedImageError, OSError) as error:
            raise _unsupported() from error
        if image.format not in ACCEPTED_FORMATS:
            raise _unsupported()
        # The header gives the size before any pixels are decoded.
        if image.width * image.height > self._limits.max_pixels:
            raise _too_many_pixels()
        try:
            image.load()
        except (OSError, ValueError, SyntaxError) as error:
            raise _unsupported() from error

        upright = ImageOps.exif_transpose(image)
        has_alpha = upright.mode in ("RGBA", "LA", "PA") or (
            "transparency" in upright.info
        )
        pixels = upright.convert("RGBA" if has_alpha else "RGB")

        full = pixels.copy()
        full.thumbnail((FULL_SIZE, FULL_SIZE), Image.Resampling.LANCZOS)
        thumb = pixels.copy()
        thumb.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.Resampling.LANCZOS)

        key = uuid.uuid4().hex
        self._storage.save(key, "full", _encode(full))
        self._storage.save(key, "thumb", _encode(thumb))
        return key

    def require(self, key: str) -> None:
        """Raise 404 unless this key was uploaded and is still stored."""
        if not self._storage.exists(key):
            raise AppError(404, ErrorCode.PHOTO_NOT_FOUND, "Photo not found")

    def release(self, key: str) -> None:
        """Delete a photo no recipe holds any more; call it after the commit."""
        self._storage.delete(key)

    def read(self, key: str | None, credit_domain: str | None) -> PhotoRead | None:
        """The shape read schemas embed, with its URLs built on the server."""
        if key is None:
            return None
        return PhotoRead(
            url=f"{MEDIA_URL}/{key}.webp",
            thumb_url=f"{MEDIA_URL}/{key}-thumb.webp",
            credit_domain=credit_domain,
        )

    def sweep(
        self,
        in_use: Collection[str],
        now: datetime | None = None,
    ) -> int:
        """Delete files no recipe holds that are older than 24 h; return how many."""
        cutoff = (now or datetime.now(UTC)) - UNATTACHED_MAX_AGE
        removed = 0
        for photo in self._storage.list_photos():
            if photo.key not in in_use and photo.modified < cutoff:
                self._storage.delete(photo.key)
                removed += 1
        return removed


def get_photo_service() -> PhotoService:
    """Provider, like a Nest injectable: `Depends(get_photo_service)`."""
    settings = get_settings()
    return PhotoService(
        LocalPhotoStorage(settings.data_dir / MEDIA_DIR / PHOTOS_DIR),
        UploadLimits(settings.photo_max_bytes, settings.photo_max_pixels),
    )
