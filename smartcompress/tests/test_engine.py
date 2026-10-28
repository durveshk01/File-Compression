import io
import zipfile

import fitz
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


from pathlib import Path
