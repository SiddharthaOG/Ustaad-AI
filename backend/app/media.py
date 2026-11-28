from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Literal

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_AUDIO_BYTES = 2 * 1024 * 1024
MAX_AUDIO_SECONDS = 15.0
MAX_IMAGE_BYTES = int(1.5 * 1024 * 1024)
MAX_IMAGE_PIXELS = 20_000_000
TARGET_SAMPLE_RATE = 16_000
TARGET_CHANNELS = 1
TARGET_BITS_PER_SAMPLE = 16
TARGET_BYTE_RATE = 32_000
TARGET_BLOCK_ALIGN = 2
MAX_IMAGE_DIMENSION = 1024


class MediaValidationError(Exception):
    def __init__(
        self,
        code: Literal["FILE_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "AUDIO_INVALID", "IMAGE_INVALID"],
        message: str,
        field: Literal["audio", "image"],
        status_code: int,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.field = field
        self.status_code = status_code


@dataclass(frozen=True)
class ValidatedAudio:
    data: bytes
    duration_seconds: float
    sample_rate: int = TARGET_SAMPLE_RATE
    channels: int = TARGET_CHANNELS
    bits_per_sample: int = TARGET_BITS_PER_SAMPLE


@dataclass(frozen=True)
class ValidatedImage:
    original_size: int
    width: int
    height: int
    data: bytes


async def _read_limited(upload: UploadFile, limit: int, field: Literal["audio", "image"]) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(min(64 * 1024, limit + 1 - total))
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise MediaValidationError(
                "FILE_TOO_LARGE",
                f"The {field} file exceeds the {limit // 1024} KiB upload limit.",
                field,
                413,
            )
        chunks.append(chunk)
    if total == 0:
        raise MediaValidationError(
            "AUDIO_INVALID" if field == "audio" else "IMAGE_INVALID",
            f"The {field} file is empty.",
            field,
            400,
        )
    return b"".join(chunks)


def _check_audio_metadata(upload: UploadFile) -> None:
    filename = (upload.filename or "").lower()
    if not filename.endswith(".wav"):
        raise MediaValidationError(
            "UNSUPPORTED_MEDIA_TYPE", "Diagnosis accepts PCM WAV audio files only.", "audio", 415
        )
    if upload.content_type and upload.content_type.lower() not in {
        "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"
    }:
        raise MediaValidationError(
            "UNSUPPORTED_MEDIA_TYPE", "The uploaded audio must be identified as WAV.", "audio", 415
        )


def _check_image_metadata(upload: UploadFile) -> None:
    filename = (upload.filename or "").lower()
    if not filename.endswith((".jpg", ".jpeg")) or upload.content_type != "image/jpeg":
        raise MediaValidationError(
            "UNSUPPORTED_MEDIA_TYPE", "Upload a JPEG image (.jpg or .jpeg) only.", "image", 415
        )


def validate_wav_bytes(data: bytes) -> float:
    """Validate a complete RIFF/WAVE PCM16 mono 16 kHz file; return duration."""
    def invalid(message: str) -> None:
        raise MediaValidationError("AUDIO_INVALID", message, "audio", 400)

    if len(data) < 44 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        invalid("The audio is not a complete RIFF/WAVE file.")

    riff_end = int.from_bytes(data[4:8], "little") + 8
    if riff_end != len(data) or riff_end < 44:
        invalid("The WAV file has an invalid or incomplete RIFF length.")

    fmt: tuple[int, int, int, int, int, int] | None = None
    data_size: int | None = None
    offset = 12
    while offset < riff_end:
        if offset + 8 > riff_end:
            invalid("The WAV contains an incomplete chunk header.")
        chunk_id = data[offset:offset + 4]
        chunk_size = int.from_bytes(data[offset + 4:offset + 8], "little")
        chunk_start = offset + 8
        chunk_end = chunk_start + chunk_size
        padded_end = chunk_end + (chunk_size % 2)
        if chunk_end > riff_end or padded_end > riff_end:
            invalid("The WAV contains a truncated chunk.")

        if chunk_id == b"fmt ":
            if fmt is not None or chunk_size < 16:
                invalid("The WAV format chunk is missing, duplicated or incomplete.")
            fmt = (
                int.from_bytes(data[chunk_start:chunk_start + 2], "little"),
                int.from_bytes(data[chunk_start + 2:chunk_start + 4], "little"),
                int.from_bytes(data[chunk_start + 4:chunk_start + 8], "little"),
                int.from_bytes(data[chunk_start + 8:chunk_start + 12], "little"),
                int.from_bytes(data[chunk_start + 12:chunk_start + 14], "little"),
                int.from_bytes(data[chunk_start + 14:chunk_start + 16], "little"),
            )
        elif chunk_id == b"data":
            if data_size is not None:
                invalid("The WAV contains multiple audio data chunks.")
            data_size = chunk_size

        offset = padded_end

    if fmt is None or data_size is None or data_size <= 0:
        invalid("The WAV must contain a format chunk and non-empty audio data.")

    codec, channels, sample_rate, byte_rate, block_align, bits = fmt
    if (codec, channels, sample_rate, byte_rate, block_align, bits) != (
        1, TARGET_CHANNELS, TARGET_SAMPLE_RATE, TARGET_BYTE_RATE,
        TARGET_BLOCK_ALIGN, TARGET_BITS_PER_SAMPLE
    ):
        invalid("Audio must be uncompressed PCM16, mono, sampled at 16 kHz.")
    if data_size % TARGET_BLOCK_ALIGN:
        invalid("The WAV audio ends with a partial PCM sample.")

    duration = data_size / TARGET_BYTE_RATE
    if duration > MAX_AUDIO_SECONDS:
        invalid("Audio recordings must be 15 seconds or shorter.")
    return duration


def preprocess_jpeg_bytes(data: bytes) -> tuple[bytes, int, int]:
    """Decode, orient, strip metadata, resize and re-encode a JPEG in memory."""
    def invalid(message: str) -> None:
        raise MediaValidationError("IMAGE_INVALID", message, "image", 400)

    if len(data) < 4 or data[:3] != b"\xff\xd8\xff" or data[-2:] != b"\xff\xd9":
        invalid("The image does not contain a complete JPEG signature.")

    try:
        with Image.open(BytesIO(data)) as probe:
            if probe.format != "JPEG":
                invalid("The uploaded image is not a JPEG.")
            width, height = probe.size
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                invalid("The JPEG dimensions are invalid or exceed the safe pixel limit.")
            probe.verify()

        with Image.open(BytesIO(data)) as source:
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)
            output = BytesIO()
            image.save(output, format="JPEG", quality=85, optimize=True, progressive=False)
            processed = output.getvalue()
            final_width, final_height = image.size
    except MediaValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        invalid("The JPEG could not be safely decoded.")

    return processed, final_width, final_height


async def validate_audio_upload(upload: UploadFile) -> ValidatedAudio:
    _check_audio_metadata(upload)
    data = await _read_limited(upload, MAX_AUDIO_BYTES, "audio")
    duration = validate_wav_bytes(data)
    return ValidatedAudio(data=data, duration_seconds=duration)


async def validate_image_upload(upload: UploadFile) -> ValidatedImage:
    _check_image_metadata(upload)
    original = await _read_limited(upload, MAX_IMAGE_BYTES, "image")
    processed, width, height = preprocess_jpeg_bytes(original)
    return ValidatedImage(
        original_size=len(original),
        width=width,
        height=height,
        data=processed,
    )
