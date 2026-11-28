from __future__ import annotations

import io
import struct

import pytest
from PIL import Image

from backend.app.media import (
    MAX_AUDIO_BYTES,
    MAX_IMAGE_BYTES,
    MediaValidationError,
    preprocess_jpeg_bytes,
    validate_wav_bytes,
)


def make_wav(
    *,
    seconds: int = 1,
    sample_rate: int = 16_000,
    channels: int = 1,
    bits: int = 16,
    codec: int = 1,
) -> bytes:
    block_align = channels * bits // 8
    byte_rate = sample_rate * block_align
    samples = sample_rate * seconds
    audio = b"\x00" * (samples * block_align)
    fmt = struct.pack(
        "<HHIIHH", codec, channels, sample_rate, byte_rate, block_align, bits
    )
    body = b"fmt " + struct.pack("<I", len(fmt)) + fmt
    body += b"data" + struct.pack("<I", len(audio)) + audio
    return b"RIFF" + struct.pack("<I", len(body) + 4) + b"WAVE" + body


def make_jpeg(width: int = 1600, height: int = 1200) -> bytes:
    image = Image.new("RGB", (width, height), (80, 120, 160))
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=90)
    return output.getvalue()


def test_accepts_valid_pcm16_mono_16khz_wav():
    assert validate_wav_bytes(make_wav(seconds=2)) == 2.0


@pytest.mark.parametrize(
    "kwargs",
    [
        {"sample_rate": 44_100},
        {"channels": 2},
        {"bits": 8},
        {"codec": 3},
    ],
)
def test_rejects_unsupported_wav_formats(kwargs):
    with pytest.raises(MediaValidationError) as error:
        validate_wav_bytes(make_wav(**kwargs))
    assert error.value.code == "AUDIO_INVALID"
    assert error.value.status_code == 400


def test_rejects_audio_longer_than_15_seconds():
    with pytest.raises(MediaValidationError, match="15 seconds"):
        validate_wav_bytes(make_wav(seconds=16))


def test_rejects_truncated_riff():
    valid = make_wav()
    with pytest.raises(MediaValidationError, match="RIFF length"):
        validate_wav_bytes(valid[:-1])


def test_rejects_bad_riff_signature():
    with pytest.raises(MediaValidationError):
        validate_wav_bytes(b"NOPE" + make_wav()[4:])


def test_rejects_partial_pcm_sample():
    valid = make_wav()
    # Add one partial sample byte plus the required RIFF chunk-padding byte.
    changed = bytearray(valid)
    data_size_offset = valid.index(b"data") + 4
    current_data_size = struct.unpack_from("<I", changed, data_size_offset)[0]
    struct.pack_into("<I", changed, data_size_offset, current_data_size + 1)
    struct.pack_into("<I", changed, 4, struct.unpack_from("<I", changed, 4)[0] + 2)
    changed.extend(b"\x00\x00")  # partial sample byte plus RIFF odd-chunk padding
    with pytest.raises(MediaValidationError, match="partial PCM"):
        validate_wav_bytes(bytes(changed))


def test_rejects_upload_over_audio_limit():
    with pytest.raises(MediaValidationError) as error:
        from backend.app.media import _read_limited
        import asyncio
        from fastapi import UploadFile

        upload = UploadFile(filename="too-large.wav", file=io.BytesIO(b"x" * (MAX_AUDIO_BYTES + 1)))
        asyncio.run(_read_limited(upload, MAX_AUDIO_BYTES, "audio"))
    assert error.value.code == "FILE_TOO_LARGE"
    assert error.value.status_code == 413


def test_jpeg_is_decoded_resized_and_reencoded():
    processed, width, height = preprocess_jpeg_bytes(make_jpeg())
    assert width == 1024
    assert height == 768
    assert processed.startswith(b"\xff\xd8\xff")
    assert processed.endswith(b"\xff\xd9")
    with Image.open(io.BytesIO(processed)) as decoded:
        assert decoded.format == "JPEG"
        assert decoded.size == (1024, 768)


def test_small_jpeg_is_not_upscaled():
    processed, width, height = preprocess_jpeg_bytes(make_jpeg(320, 240))
    assert (width, height) == (320, 240)
    assert processed.startswith(b"\xff\xd8\xff")


def test_rejects_non_jpeg_bytes():
    with pytest.raises(MediaValidationError) as error:
        preprocess_jpeg_bytes(b"not-a-jpeg")
    assert error.value.code == "IMAGE_INVALID"


def test_image_limit_is_smaller_than_audio_limit():
    assert MAX_IMAGE_BYTES < MAX_AUDIO_BYTES
