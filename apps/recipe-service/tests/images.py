"""Pictures made in memory for the photo tests, so no binary fixtures are checked in."""

import os
from io import BytesIO

from PIL import Image

# EXIF tag numbers.
ORIENTATION = 0x0112
GPS_INFO = 0x8825
MAKE = 0x010F  # the camera's make


def encode(image: Image.Image, fmt: str, **options: object) -> bytes:
    output = BytesIO()
    image.save(output, fmt, **options)
    return output.getvalue()


def jpeg(width: int = 80, height: int = 60, *, exif: Image.Exif | None = None) -> bytes:
    image = Image.new("RGB", (width, height), (200, 60, 40))
    return encode(image, "JPEG", exif=exif) if exif else encode(image, "JPEG")


def png(width: int = 80, height: int = 60, *, alpha: bool = False) -> bytes:
    mode = "RGBA" if alpha else "RGB"
    color = (10, 120, 200, 128) if alpha else (10, 120, 200)
    return encode(Image.new(mode, (width, height), color), "PNG")


def noisy_png(width: int = 100, height: int = 100) -> bytes:
    """A picture that does not compress, so its file is big for its size."""
    noise = Image.frombytes("RGB", (width, height), os.urandom(width * height * 3))
    return encode(noise, "PNG")


def webp(width: int = 80, height: int = 60) -> bytes:
    return encode(Image.new("RGB", (width, height), (30, 160, 90)), "WEBP")


def exif_with(orientation: int | None = None, *, gps: bool = False) -> Image.Exif:
    """An EXIF block: a camera make, an orientation and, if asked, a GPS position."""
    exif = Image.Exif()
    exif[MAKE] = "TestCam"
    if orientation is not None:
        exif[ORIENTATION] = orientation
    if gps:
        exif[GPS_INFO] = {1: "N", 2: (32.0, 4.0, 0.0), 3: "E", 4: (34.0, 46.0, 0.0)}
    return exif


def open_webp(data: bytes) -> Image.Image:
    image = Image.open(BytesIO(data))
    assert image.format == "WEBP"
    return image
