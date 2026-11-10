"""The business logic of photos. Other modules call this layer, not the repository."""

import uuid
from collections.abc import Callable, Collection
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.safe_fetch import (
    FETCH_HTTP_STATUS,
    FetchBlockedError,
    FetchedResponse,
    FetchError,
    FetchFailedError,
    FetchLimits,
    safe_get,
)
from app.photos.schemas import PhotoLimits, PhotoRead
from app.photos.storage import LocalPhotoStorage, PhotoStorage

# The folders, inside the data folder, that `/media` is served from and that hold
# the photos.
MEDIA_DIR = "media"
PHOTOS_DIR = "photos"
MEDIA_URL = "/media/photos"

FULL_SIZE = 1600
THUMB_SIZE = 600
WEBP_QUALITY = 80
# The image formats we accept (Pillow's names) and their types for the client.
ACCEPTED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
UNATTACHED_MAX_AGE = timedelta(hours=24)


@dataclass(frozen=True)
class UploadLimits:
    max_bytes: int
    max_pixels: int
    # The maximum time to download a photo from a link, including redirects.
    fetch_timeout_seconds: float = 15


# A function that downloads a URL under the safe-fetch rules. Tests replace it.
Fetch = Callable[[str, FetchLimits], FetchedResponse]


def _safe_fetch(url: str, limits: FetchLimits) -> FetchedResponse:
    return safe_get(url, limits, accept="image/webp,image/png,image/jpeg,image/*")


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
    """Saves the image as WebP. We pass no metadata, so none is written."""
    output = BytesIO()
    image.save(output, "WEBP", quality=WEBP_QUALITY, method=4)
    return output.getvalue()


class PhotoService:
    def __init__(
        self, storage: PhotoStorage, limits: UploadLimits, fetch: Fetch = _safe_fetch
    ) -> None:
        self._storage = storage
        self._limits = limits
        self._fetch = fetch

    def limits(self) -> PhotoLimits:
        return PhotoLimits(
            max_bytes=self._limits.max_bytes,
            content_types=list(ACCEPTED_FORMATS.values()),
        )

    def store(self, data: bytes) -> str:
        """Saves an uploaded photo and returns its key. No recipe uses it yet.

        Saves a WebP up to 1600 px and a 600 px thumbnail, without any metadata
        (EXIF can contain a GPS location).
        """
        if len(data) > self._limits.max_bytes:
            raise _too_large(self._limits.max_bytes)
        # Detect the type from the file content, never from its name or declared type.
        try:
            image = Image.open(BytesIO(data))
        except Image.DecompressionBombError as error:
            raise _too_many_pixels() from error
        except (UnidentifiedImageError, OSError) as error:
            raise _unsupported() from error
        if image.format not in ACCEPTED_FORMATS:
            raise _unsupported()
        # The size is known from the file header, before the pixels are decoded.
        if image.width * image.height > self._limits.max_pixels:
            raise _too_many_pixels()
        try:
            image.load()
        except (OSError, ValueError, SyntaxError) as error:
            raise _unsupported() from error

        # Rotate the picture according to its EXIF orientation.
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

    def store_from_url(self, url: str) -> str:
        """Downloads a photo with safe fetch (AD-23) and saves it like an upload.

        The downloaded file gets the same checks as an upload: the type is detected
        from the content, and the size and pixel limits apply.
        """
        limits = FetchLimits(
            max_bytes=self._limits.max_bytes,
            timeout_seconds=self._limits.fetch_timeout_seconds,
        )
        try:
            response = self._fetch(url, limits)
            if response.status in (401, 403, 429):
                raise FetchBlockedError(
                    f"the site refused the photo ({response.status})"
                )
            if not 200 <= response.status < 300:
                raise FetchFailedError(f"the site answered {response.status}")
        except FetchError as error:
            if error.code is ErrorCode.FETCH_TOO_LARGE:
                raise _too_large(self._limits.max_bytes) from error
            status = FETCH_HTTP_STATUS[error.code]
            raise AppError(status, error.code, error.detail) from error
        return self.store(response.body)

    def require(self, key: str) -> None:
        """Raises 404 if no photo with this key is stored."""
        if not self._storage.exists(key):
            raise AppError(404, ErrorCode.PHOTO_NOT_FOUND, "Photo not found")

    def release(self, key: str) -> None:
        """Deletes a photo that no recipe uses any more. Call it after the commit."""
        self._storage.delete(key)

    def read(self, key: str | None, credit_domain: str | None) -> PhotoRead | None:
        """Returns the photo as it appears in API responses, with its URLs."""
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
        """Deletes photos that no recipe uses and that are older than 24 hours.
        Returns how many were deleted."""
        cutoff = (now or datetime.now(UTC)) - UNATTACHED_MAX_AGE
        removed = 0
        for photo in self._storage.list_photos():
            if photo.key not in in_use and photo.modified < cutoff:
                self._storage.delete(photo.key)
                removed += 1
        return removed


def get_photo_service() -> PhotoService:
    """Creates the photo service for a route, like a Nest provider:
    `Depends(get_photo_service)`."""
    settings = get_settings()
    return PhotoService(
        LocalPhotoStorage(settings.data_dir / MEDIA_DIR / PHOTOS_DIR),
        UploadLimits(
            settings.photo_max_bytes,
            settings.photo_max_pixels,
            settings.page_fetch_timeout_seconds,
        ),
    )
