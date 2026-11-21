from pathlib import Path
import zipfile

import pymupdf as fitz
import pytest
from PIL import Image

from services.compressor.engine import CompressionError, compress, detect


def image_file(tmp_path, name="source.jpg", color=(150, 80, 200)):
    path = tmp_path / name
    Image.new("RGB", (640, 480), color).save(path, "JPEG", quality=96)
    return path


def test_jpeg_target_search_produces_valid_measured_output(tmp_path):
    source = image_file(tmp_path)
    # The engine owns its candidate directory; create it as the API worker does.
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, source.stat().st_size - 1, "balanced", 15)
    with Image.open(result["path"]) as im:
        im.verify()
    assert Path(result["path"]).stat().st_size > 0
    assert result["iterations"] == 1
    assert (tmp_path / "source.jpg").stat().st_size > 0


def test_lossless_png_retains_dimensions_and_pixels(tmp_path):
    source = tmp_path / "alpha.png"
    Image.new("RGBA", (40, 30), (30, 120, 60, 90)).save(source)
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, None, "lossless", 10)
    with Image.open(result["path"]) as im:
        assert im.size == (40, 30)
        assert im.getpixel((0, 0)) == (30, 120, 60, 90)


def test_tiny_target_returns_best_valid_image_without_claiming_success(tmp_path):
    source = image_file(tmp_path)
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, 1, "balanced", 10)
    with Image.open(result["path"]) as im: im.verify()
    assert not result["target_reached"]
    assert Path(result["path"]).stat().st_size > 1


def test_reachable_image_target_is_measured_and_met(tmp_path):
    source = tmp_path / "noisy.jpg"
    Image.effect_noise((800, 600), 55).convert("RGB").save(source, "JPEG", quality=98)
    target = source.stat().st_size // 2
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, target, "balanced", 15)
    assert result["target_reached"]
    assert Path(result["path"]).stat().st_size <= target
    with Image.open(result["path"]) as im: im.verify()


def test_target_larger_than_source_keeps_original(tmp_path):
    source = image_file(tmp_path)
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, source.stat().st_size + 100, "balanced", 10)
    assert result["path"] == str(source)
    assert "skipped" in result["message"]


def test_misleading_extension_is_rejected(tmp_path):
    source = image_file(tmp_path, "portrait.png")
    with pytest.raises(CompressionError, match="filename says PNG"):
        detect(source, "portrait.png")


def test_corrupt_image_is_rejected(tmp_path):
    source = tmp_path / "broken.jpg"; source.write_bytes(b"\xff\xd8\xffnot-an-image")
    with pytest.raises(CompressionError): detect(source, source.name)


def test_avif_signature_is_identified_but_disabled(tmp_path):
    source = tmp_path / "photo.avif"
    source.write_bytes((24).to_bytes(4, "big") + b"ftypavif" + b"0000")
    info = detect(source, source.name)
    assert info["format"] == "AVIF"
    assert not info["supported"]


def test_pdf_is_structurally_rewritten_and_keeps_page_count(tmp_path):
    source = tmp_path / "sample.pdf"
    doc = fitz.open(); page = doc.new_page(); page.insert_text((70, 80), "Searchable text stays searchable")
    doc.save(source); doc.close()
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, None, "balanced", 10)
    check = fitz.open(result["path"])
    assert check.page_count == 1
    assert "Searchable text" in check[0].get_text()
    check.close()


def test_zip_recompression_preserves_members_and_validity(tmp_path):
    source = tmp_path / "sample.zip"
    with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("folder/notes.txt", "hello world " * 1000)
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, None, "lossless", 10)
    with zipfile.ZipFile(result["path"]) as archive:
        assert archive.testzip() is None
        assert archive.read("folder/notes.txt") == b"hello world " * 1000


def test_large_zip_member_is_copied_in_valid_chunks(tmp_path):
    payload = b"bounded streaming member test\n" * 350_000
    source = tmp_path / "large.zip"
    with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_STORED) as archive: archive.writestr("large.txt", payload)
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, None, "lossless", 20)
    with zipfile.ZipFile(result["path"]) as archive:
        assert archive.read("large.txt") == payload
        assert archive.testzip() is None


def test_zip_timeout_never_returns_a_partial_archive(tmp_path, monkeypatch):
    from services.compressor import engine
    source = tmp_path / "timeout.zip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("first.txt", b"a" * 10000)
        archive.writestr("second.txt", b"b" * 10000)
    original = source.read_bytes()
    out = tmp_path / "out"
    out.mkdir()
    ticks = iter([0.0, 0.0, 2.0])
    monkeypatch.setattr(engine.time, "monotonic", lambda: next(ticks, 2.0))
    with pytest.raises(CompressionError, match="timed out"):
        compress(source, source.name, out, None, "lossless", 1)
    assert source.read_bytes() == original


@pytest.mark.parametrize("extension,mime,kind", [
    ("odt", "application/vnd.oasis.opendocument.text", "ODT"),
    ("ods", "application/vnd.oasis.opendocument.spreadsheet", "ODS"),
    ("odp", "application/vnd.oasis.opendocument.presentation", "ODP"),
    ("epub", "application/epub+zip", "EPUB"),
])
def test_package_mimetype_identifies_supported_format(tmp_path, extension, mime, kind):
    source = tmp_path / f"document.{extension}"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("mimetype", mime)
        archive.writestr("content.xml", "<content>" + "hello " * 1000 + "</content>")
        if extension == "epub":
            archive.writestr("META-INF/container.xml", "<container/>")
    info = detect(source, source.name)
    assert info["format"] == kind
    assert info["supported"]
    out = tmp_path / "out"
    out.mkdir()
    result = compress(source, source.name, out, None, "lossless", 10)
    with zipfile.ZipFile(result["path"]) as archive:
        assert archive.read("mimetype").decode() == mime
        assert archive.infolist()[0].filename == "mimetype"
        assert archive.infolist()[0].compress_type == zipfile.ZIP_STORED


def test_animation_over_frame_limit_is_not_silently_truncated(tmp_path):
    source = tmp_path / "long.gif"
    frames = [Image.new("RGB", (2, 2), (i % 256, i // 256, 0)) for i in range(501)]
    frames[0].save(source, save_all=True, append_images=frames[1:], duration=20, loop=0)
    with Image.open(source) as image:
        assert image.n_frames == 501
    out = tmp_path / "out"
    out.mkdir()
    with pytest.raises(CompressionError, match="frame"):
        compress(source, source.name, out, None, "balanced", 10)


def test_image_over_configured_pixel_limit_is_rejected(tmp_path, monkeypatch):
    from services.compressor import engine
    source = tmp_path / "large.png"
    Image.new("RGB", (11, 10)).save(source)
    monkeypatch.setattr(engine, "MAX_IMAGE_PIXELS", 100)
    with pytest.raises(CompressionError, match="limit"):
        detect(source, source.name)


def test_exact_target_below_requested_size_is_reported_honestly(tmp_path):
    source = image_file(tmp_path)
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, source.stat().st_size - 1, "exact", 10)
    assert not result["target_reached"]
    if Path(result["path"]).stat().st_size < source.stat().st_size - 1:
        assert "larger than" not in result["message"]


def test_unreachable_image_target_counts_all_candidates(tmp_path):
    source = image_file(tmp_path)
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, 1, "balanced", 10)
    assert result["iterations"] == 45


def test_lossless_tiff_keeps_all_pages(tmp_path):
    source = tmp_path / "pages.tiff"
    Image.new("RGB", (12, 10), "red").save(source, save_all=True, append_images=[Image.new("RGB", (12, 10), "blue")])
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, None, "lossless", 10)
    assert result["format"] == "TIFF"
    with Image.open(result["path"]) as image:
        assert image.n_frames == 2


def test_unchanged_lossless_image_reports_source_format(tmp_path):
    source = image_file(tmp_path)
    source_bin = tmp_path / "source.bin"; source_bin.write_bytes(source.read_bytes())
    out = tmp_path / "out"; out.mkdir()
    result = compress(source_bin, "photo.jpg", out, None, "lossless", 10)
    assert result["format"] == "JPEG"


def test_automatic_lossless_png_never_returns_a_larger_file(tmp_path):
    source = tmp_path / "small.png"
    Image.new("RGB", (8, 8), (40, 80, 120)).save(source)
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, None, "lossless", 10)
    assert Path(result["path"]).stat().st_size <= source.stat().st_size


def test_lossy_multipage_tiff_is_not_converted_to_animation(tmp_path):
    source = tmp_path / "pages.tiff"
    Image.new("RGB", (12, 10), "red").save(source, save_all=True, append_images=[Image.new("RGB", (12, 10), "blue")])
    out = tmp_path / "out"; out.mkdir()
    result = compress(source, source.name, out, None, "balanced", 10)
    assert result["format"] == "TIFF"
    with Image.open(result["path"]) as image:
        assert image.n_frames == 2


def test_media_timeout_kills_process_even_without_progress_output(tmp_path, monkeypatch):
    import json
    import subprocess
    import sys
    import time
    from services.compressor import engine
    source = tmp_path / "source.mp4"; source.write_bytes(b"media")
    out = tmp_path / "out"; out.mkdir()
    monkeypatch.setattr(engine.shutil, "which", lambda name: sys.executable)
    monkeypatch.setattr(engine.subprocess, "run", lambda *args, **kwargs: subprocess.CompletedProcess(args, 0, json.dumps({"format": {"duration": "1"}, "streams": [{"codec_type": "video", "codec_name": "h264"}]}), ""))
    popen = subprocess.Popen
    children = []
    def stalled_encoder(*args, **kwargs):
        child = popen([sys.executable, "-c", "import time; time.sleep(30)"], **kwargs)
        children.append(child)
        return child
    monkeypatch.setattr(engine.subprocess, "Popen", stalled_encoder)
    engine._clock.started = time.monotonic()
    with pytest.raises(CompressionError, match="timed out"):
        engine._ffmpeg(source, out, "MP4", None, "balanced", 1, lambda: False)
    assert children[0].poll() is not None
