"""The image pipeline: what `PhotoService.store` makes of an upload (AD-14, AD-27)."""

import os
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from PIL import Image

from app.core.errors import AppError
from app.photos.service import PhotoService, UploadLimits
from app.photos.storage import LocalPhotoStorage
from tests.images import (
    GPS_INFO,
    MAKE,
    exif_with,
    jpeg,
    open_webp,
    png,
    webp,
)


@pytest.fixture
def root(tmp_path: Path) -> Path:
    return tmp_path / "photos"


@pytest.fixture
def photos(root: Path) -> PhotoService:
    return PhotoService(LocalPhotoStorage(root), UploadLimits(50_000, 10_000))


def stored(root: Path, key: str, variant: str = "") -> bytes:
    return (root / f"{key}{variant}.webp").read_bytes()


def code(error: pytest.ExceptionInfo[AppError]) -> tuple[int, str]:
    return error.value.status_code, str(error.value.body.code)


# --- Formats -----------------------------------------------------------------


@pytest.mark.parametrize("data", [jpeg(), png(), png(alpha=True), webp()])
def test_jpeg_png_and_webp_become_webp_with_a_thumbnail(
    photos: PhotoService, root: Path, data: bytes
) -> None:
    key = photos.store(data)
    assert len(key) == 32
    assert open_webp(stored(root, key)).size == (80, 60)
    assert open_webp(stored(root, key, "-thumb")).size == (80, 60)


def test_transparency_is_kept(photos: PhotoService, root: Path) -> None:
    key = photos.store(png(alpha=True))
    assert open_webp(stored(root, key)).mode == "RGBA"


def test_the_type_is_read_from_the_file_not_the_name(photos: PhotoService) -> None:
    with pytest.raises(AppError) as error:
        photos.store(b"GIF89a" + b"\x00" * 100)
    assert code(error) == (415, "photo_unsupported_type")
    with pytest.raises(AppError) as error:
        photos.store(b"<html>not a picture</html>")
    assert code(error) == (415, "photo_unsupported_type")


def test_an_unaccepted_picture_format_is_refused(
    photos: PhotoService,
) -> None:
    from tests.images import encode

    gif = encode(Image.new("P", (20, 20)), "GIF")
    with pytest.raises(AppError) as error:
        photos.store(gif)
    assert code(error) == (415, "photo_unsupported_type")


def test_a_truncated_file_is_refused(photos: PhotoService) -> None:
    data = jpeg(80, 60)
    with pytest.raises(AppError) as error:
        photos.store(data[: len(data) // 2])
    assert code(error) == (415, "photo_unsupported_type")


# --- Limits ------------------------------------------------------------------


def test_a_file_over_the_byte_limit_is_413_and_nothing_is_stored(
    photos: PhotoService, root: Path
) -> None:
    with pytest.raises(AppError) as error:
        photos.store(b"\x00" * 50_001)
    assert code(error) == (413, "photo_too_large")
    assert not root.exists() or list(root.iterdir()) == []


def test_a_picture_with_too_many_pixels_is_413_before_it_is_decoded(
    photos: PhotoService, root: Path
) -> None:
    # 200 x 100 = 20,000 pixels is over this service's 10,000, yet the file is tiny.
    with pytest.raises(AppError) as error:
        photos.store(png(200, 100))
    assert code(error) == (413, "photo_dimensions_too_large")
    assert not root.exists() or list(root.iterdir()) == []


def test_a_decompression_bomb_is_413(
    root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Pillow itself refuses pictures far beyond its own pixel limit when opening.
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)
    photos = PhotoService(LocalPhotoStorage(root), UploadLimits(50_000, 10_000_000))
    with pytest.raises(AppError) as error:
        photos.store(png(60, 60))
    assert code(error) == (413, "photo_dimensions_too_large")


def test_the_limits_are_published(photos: PhotoService) -> None:
    limits = photos.limits()
    assert limits.max_bytes == 50_000
    assert limits.content_types == ["image/jpeg", "image/png", "image/webp"]


# --- Sizes -------------------------------------------------------------------


def test_a_big_picture_is_capped_at_1600_and_its_thumbnail_at_600(
    root: Path,
) -> None:
    photos = PhotoService(LocalPhotoStorage(root), UploadLimits(5_000_000, 10_000_000))
    key = photos.store(jpeg(3200, 2400))
    assert open_webp(stored(root, key)).size == (1600, 1200)
    assert open_webp(stored(root, key, "-thumb")).size == (600, 450)


def test_a_tall_picture_keeps_its_shape(root: Path) -> None:
    photos = PhotoService(LocalPhotoStorage(root), UploadLimits(5_000_000, 10_000_000))
    key = photos.store(jpeg(1000, 2000))
    assert open_webp(stored(root, key)).size == (800, 1600)
    assert open_webp(stored(root, key, "-thumb")).size == (300, 600)


def test_a_small_picture_is_not_enlarged(photos: PhotoService, root: Path) -> None:
    key = photos.store(jpeg(40, 30))
    assert open_webp(stored(root, key)).size == (40, 30)


# --- EXIF --------------------------------------------------------------------


def test_orientation_is_applied(photos: PhotoService, root: Path) -> None:
    # Orientation 6 means "rotate 90 degrees to show it": the 80 x 60 file is upright
    # as 60 x 80.
    key = photos.store(jpeg(80, 60, exif=exif_with(orientation=6)))
    assert open_webp(stored(root, key)).size == (60, 80)
    assert open_webp(stored(root, key, "-thumb")).size == (60, 80)


def test_every_trace_of_metadata_is_stripped(photos: PhotoService, root: Path) -> None:
    source = jpeg(80, 60, exif=exif_with(orientation=1, gps=True))
    original = Image.open(__import__("io").BytesIO(source))
    assert original.getexif().get(MAKE) == "TestCam"  # the test picture does carry it
    assert GPS_INFO in original.getexif()

    key = photos.store(source)
    for variant in ("", "-thumb"):
        image = open_webp(stored(root, key, variant))
        assert len(image.getexif()) == 0
        assert "exif" not in image.info
        assert b"TestCam" not in stored(root, key, variant)


# --- Storage, keys and the sweep ---------------------------------------------


def test_require_and_release(photos: PhotoService, root: Path) -> None:
    key = photos.store(jpeg())
    photos.require(key)
    photos.release(key)
    assert list(root.iterdir()) == []
    with pytest.raises(AppError) as error:
        photos.require(key)
    assert code(error) == (404, "photo_not_found")
    photos.release(key)  # a second release is harmless


def test_read_builds_the_urls_on_the_server(photos: PhotoService) -> None:
    assert photos.read(None, "example.com") is None
    photo = photos.read("a" * 32, "commons.wikimedia.org")
    assert photo is not None
    assert photo.url == f"/media/photos/{'a' * 32}.webp"
    assert photo.thumb_url == f"/media/photos/{'a' * 32}-thumb.webp"
    assert photo.credit_domain == "commons.wikimedia.org"


def test_the_sweep_removes_only_old_unattached_photos(
    photos: PhotoService, root: Path
) -> None:
    old_unused = photos.store(jpeg())
    old_used = photos.store(jpeg())
    new_unused = photos.store(jpeg())
    two_days_ago = time.time() - 2 * 86400
    for key in (old_unused, old_used):
        os.utime(root / f"{key}.webp", (two_days_ago, two_days_ago))

    assert photos.sweep({old_used}) == 1
    assert sorted(path.name for path in root.iterdir()) == sorted(
        [
            f"{old_used}.webp",
            f"{old_used}-thumb.webp",
            f"{new_unused}.webp",
            f"{new_unused}-thumb.webp",
        ]
    )


def test_the_sweep_waits_a_full_day(photos: PhotoService) -> None:
    key = photos.store(jpeg())
    soon = datetime.now(UTC) + timedelta(hours=23)
    later = datetime.now(UTC) + timedelta(hours=25)
    assert photos.sweep(set(), now=soon) == 0
    assert photos.sweep(set(), now=later) == 1
    with pytest.raises(AppError):
        photos.require(key)


def test_the_sweep_on_an_empty_volume_does_nothing(photos: PhotoService) -> None:
    assert photos.sweep(set()) == 0
