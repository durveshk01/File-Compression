import json
import shutil
import subprocess

import pytest

from services.compressor.engine import compress


FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")
pytestmark = pytest.mark.skipif(not (FFMPEG and FFPROBE), reason="FFmpeg and ffprobe are not installed")


def test_ffmpeg_video_conversion_has_valid_stream_and_duration(tmp_path):
    source = tmp_path / "fixture.mp4"
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=160x120:d=1.5", "-f", "lavfi", "-i", "sine=frequency=440:duration=1.5", "-shortest", "-c:v", "libx264", "-c:a", "aac", str(source)], check=True, timeout=30, shell=False)
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, source.stat().st_size - 1, "balanced", 30)
    probe = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", result["path"]], capture_output=True, text=True, check=True, timeout=10, shell=False)
    meta = json.loads(probe.stdout)
    assert {s["codec_type"] for s in meta["streams"]} == {"video", "audio"}
    assert 1.2 < float(meta["format"]["duration"]) < 1.8
    assert result["format"] == "MP4"
