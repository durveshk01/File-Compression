from __future__ import annotations

import io
import json
import os
import re
import shutil
import subprocess
import tarfile
import threading
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import fitz
from PIL import Image, ImageFile, ImageOps, UnidentifiedImageError

MAX_IMAGE_PIXELS = max(1_000_000, int(os.getenv("SMARTCOMPRESS_MAX_IMAGE_PIXELS", "80000000")))
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
ImageFile.LOAD_TRUNCATED_IMAGES = False
_clock = threading.local()

EXTENSIONS = {
    ".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WebP", ".gif": "GIF",
    ".bmp": "BMP", ".tif": "TIFF", ".tiff": "TIFF", ".ico": "ICO", ".avif": "AVIF",
    ".heic": "HEIC", ".heif": "HEIC", ".wma": "WMA", ".pdf": "PDF", ".zip": "ZIP", ".docx": "DOCX",
    ".pptx": "PPTX", ".xlsx": "XLSX", ".odt": "ODT", ".ods": "ODS", ".odp": "ODP",
    ".epub": "EPUB", ".tar": "TAR", ".gz": "GZIP", ".tgz": "GZIP", ".7z": "7Z",
    ".mp4": "MP4", ".mov": "MOV", ".mkv": "MKV", ".webm": "WebM", ".avi": "AVI",
    ".mp3": "MP3", ".wav": "WAV", ".flac": "FLAC", ".m4a": "M4A", ".aac": "AAC", ".ogg": "OGG",
}
IMAGE_FORMATS = {"JPEG", "PNG", "WebP", "GIF", "BMP", "TIFF", "ICO"}
IMAGE_SIGNATURES = (
    (b"\xff\xd8\xff", "JPEG"), (b"\x89PNG\r\n\x1a\n", "PNG"), (b"GIF87a", "GIF"), (b"GIF89a", "GIF"),
    (b"BM", "BMP"), (b"RIFF", "RIFF"), (b"II*\x00", "TIFF"), (b"MM\x00*", "TIFF"),
    (b"\x00\x00\x01\x00", "ICO"), (b"%PDF-", "PDF"), (b"PK\x03\x04", "ZIP"), (b"PK\x05\x06", "ZIP"),
    (b"PK\x07\x08", "ZIP"), (b"7z\xbc\xaf\x27\x1c", "7Z"), (b"ID3", "MP3"), (b"fLaC", "FLAC"),
    (b"OggS", "OGG"), (b"RIFF", "RIFF"), (b"\x1aE\xdf\xa3", "WebM/MKV"),
)


class CompressionError(Exception):
    """Safe, user-displayable processing error."""


def detect(path: Path, filename: str) -> dict:
    ext = Path(filename).suffix.lower()
    expected = EXTENSIONS.get(ext)
    with path.open("rb") as stream:
        head = stream.read(32)
    actual = None
    if head[4:8] == b"ftyp" and len(head) >= 12:
        brand = head[8:12].decode("ascii", "ignore").lower()
        if brand in {"avif", "avis"}: actual = "AVIF"
        elif brand in {"heic", "heix", "hevc", "hevx", "mif1", "msf1"}: actual = "HEIC"
    if head.startswith(bytes.fromhex("3026b2758e66cf11a6d900aa0062ce6c")): actual = "WMA"
    if head.startswith(b"RIFF"):
        try:
            with path.open("rb") as stream:
                stream.seek(8)
                kind = stream.read(4)
            if kind == b"WEBP": actual = "WebP"
            elif kind == b"WAVE": actual = "WAV"
            elif kind == b"AVI ": actual = "AVI"
        except OSError:
            pass
    if actual is None:
        for signature, kind in IMAGE_SIGNATURES:
            if head.startswith(signature):
                actual = kind
                break
    if actual == "ZIP":
        try:
            with zipfile.ZipFile(path) as zf:
                names = set(zf.namelist())
                if "[Content_Types].xml" in names:
                    actual = "DOCX" if any(n.startswith("word/") for n in names) else "PPTX" if any(n.startswith("ppt/") for n in names) else "XLSX" if any(n.startswith("xl/") for n in names) else "Office package"
                elif "mimetype" in names:
                    actual = "EPUB" if "META-INF/container.xml" in names else "ODT/ODS/ODP"
        except (OSError, zipfile.BadZipFile):
            raise CompressionError("This ZIP file is damaged or incomplete.")
    if actual is None and ext in {".mp4", ".mov", ".m4a"}:
        with path.open("rb") as stream:
            stream.seek(4)
            if stream.read(4) == b"ftyp": actual = expected
    if actual is None and ext in {".gz", ".tgz"} and head.startswith(b"\x1f\x8b"): actual = "GZIP"
    if actual is None and ext == ".tar":
        try:
            if tarfile.is_tarfile(path): actual = "TAR"
        except OSError:
            pass
    if actual is None and ext == ".svg":
        try:
            with path.open("rb") as stream: raw = stream.read(4096).lstrip()
            if b"<svg" in raw[:4096].lower(): actual = "SVG"
        except OSError:
            pass
    if actual is None and ext in {".mp3", ".aac", ".wav", ".flac", ".m4a", ".ogg"}:
        actual = expected if head else None
    if actual is None and ext in {".mkv", ".webm", ".avi", ".mov", ".mp4"}:
        # Container parsing and validation happens through ffprobe before processing.
        actual = expected
    media_exts = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}
    if ext in media_exts:
        ffprobe = shutil.which("ffprobe")
        if not ffprobe:
            raise CompressionError("Media validation requires ffprobe. Install FFmpeg and add its bin folder to PATH.")
        try:
            probe = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=format_name:stream=codec_type", "-of", "json", str(path)], capture_output=True, text=True, timeout=20, shell=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise CompressionError("Media validation could not finish. Try a smaller or shorter file.") from exc
        if probe.returncode:
            raise CompressionError("The media file is damaged, incomplete, or unsupported by the installed FFmpeg build.")
        try:
            media = json.loads(probe.stdout)
            media_names = media["format"]["format_name"].lower().split(",")
            streams = {item.get("codec_type") for item in media.get("streams", [])}
        except (ValueError, KeyError, TypeError):
            raise CompressionError("The media container could not be validated.")
        video_exts = {".mp4", ".mov", ".mkv", ".webm", ".avi"}
        if not streams.intersection({"audio", "video"}):
            raise CompressionError("This media container has no supported audio or video stream.")
        if ext in video_exts and "video" not in streams:
            raise CompressionError("This filename suggests video, but the file contains no video stream.")
        if ext not in video_exts and "audio" not in streams:
            raise CompressionError("This filename suggests audio, but the file contains no audio stream.")
        compatible = {
            ".mp4": {"mov", "mp4", "m4a", "3gp", "3g2", "mj2"}, ".mov": {"mov", "mp4", "m4a", "3gp", "3g2", "mj2"},
            ".m4a": {"mov", "mp4", "m4a", "3gp", "3g2", "mj2"}, ".mkv": {"matroska"}, ".webm": {"webm", "matroska"},
            ".avi": {"avi"}, ".mp3": {"mp3"}, ".wav": {"wav"}, ".flac": {"flac"}, ".aac": {"aac"}, ".ogg": {"ogg", "opus"},
        }
        if not any(token in name for token in compatible.get(ext, set()) for name in media_names):
            probed = ", ".join(media_names)
            raise CompressionError(f"The file contents do not match the {expected} extension (detected {probed}). Rename it to match and try again.")
        if actual == "WebM/MKV": actual = expected
    mismatch = bool(expected and actual and expected not in {actual, "Office package", "ODT/ODS/ODP", "WebM/MKV"})
    if mismatch:
        raise CompressionError(f"The file contents look like {actual}, but the filename says {expected}. Rename it to match the real format and upload again.")
    if not actual:
        raise CompressionError("We could not identify this file from its contents. This format is not supported.")
    if actual in IMAGE_FORMATS:
        try:
            with Image.open(path) as image:
                image.verify()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            raise CompressionError(f"This image is damaged, incomplete, or exceeds the safe {MAX_IMAGE_PIXELS // 1_000_000} megapixel limit.") from exc
    supported = actual in IMAGE_FORMATS or actual in {"PDF", "ZIP", "DOCX", "PPTX", "XLSX", "ODT", "ODS", "ODP", "EPUB", "MP4", "MOV", "MKV", "WebM", "AVI", "MP3", "WAV", "FLAC", "M4A", "AAC", "OGG"}
    return {"format": actual, "extension": ext, "supported": supported, "category": category(actual), "warning": format_warning(actual)}


def category(kind: str) -> str:
    if kind in IMAGE_FORMATS or kind == "SVG": return "Image"
    if kind == "PDF": return "PDF"
    if kind in {"MP4", "MOV", "MKV", "WebM", "AVI"}: return "Video"
    if kind in {"MP3", "WAV", "FLAC", "M4A", "AAC", "OGG"}: return "Audio"
    if kind in {"ZIP", "GZIP", "TAR", "7Z"}: return "Archive"
    return "Document"


def format_warning(kind: str) -> str:
    if kind in {"JPEG", "WebP"}: return "Lossy recompression may slightly reduce image quality; camera and location metadata are removed."
    if kind == "GIF": return "Animation timing is preserved; palette changes can affect colors. Camera and location metadata are removed."
    if kind in {"BMP", "TIFF", "ICO"}: return "Output is converted to optimized PNG. Camera-specific tags are not retained."
    if kind == "PDF": return "Structural optimization keeps text and vector content. Embedded images are not rasterized."
    if kind in {"ZIP", "DOCX", "PPTX", "XLSX", "ODT", "ODS", "ODP", "EPUB"}: return "Package structure and contents are preserved; highly compressed content may not shrink."
    if kind in {"MP4", "MOV", "MKV", "WebM", "AVI"}: return "Video is re-encoded with FFmpeg; quality depends on the requested size and source."
    if kind in {"MP3", "M4A", "AAC", "OGG", "WAV", "FLAC"}: return "Audio is re-encoded with FFmpeg; lossy sources cannot regain lost quality."
    return ""


def _image_candidates(src: Path, outdir: Path, target: int | None, lossless: bool, smallest: bool, max_seconds: int, cancelled: Callable[[], bool]) -> tuple[Path, str, list[str]]:
    try:
        im = Image.open(src)
        im.verify()
        im = Image.open(src)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise CompressionError(f"This image is damaged, unsupported, or exceeds the safe {MAX_IMAGE_PIXELS // 1_000_000} megapixel limit.") from exc
    if getattr(im, "n_frames", 1) > 1:
        if lossless:
            return src, "Lossless only: the original animated image was retained unchanged.", []
        # Save as GIF with the original frame sequence intact.
        frames, durations = [], []
        loop = im.info.get("loop", 0)
        try:
            for i in range(min(im.n_frames, 500)):
                im.seek(i); frames.append(im.convert("RGBA" if "transparency" in im.info else "RGB").copy()); durations.append(im.info.get("duration", 100))
        except (OSError, EOFError) as exc:
            raise CompressionError("This animated image could not be safely decoded.") from exc
        dest = outdir / "optimized.gif"
        frames[0].save(dest, format="GIF", save_all=True, append_images=frames[1:], optimize=True, duration=durations, loop=loop, disposal=2)
        return dest, "Animation and frame timing preserved; palette optimization may change individual colors.", ["Camera/location metadata is not retained."]
    image = ImageOps.exif_transpose(im)
    source_format = im.format or "PNG"
    warnings = ["Camera and location metadata is removed; embedded color profile is preserved when supported."]
    preserve_transparency = "A" in image.getbands() or "transparency" in im.info
    out_format = "JPEG" if source_format == "JPEG" else "WEBP" if source_format == "WebP" else "PNG"
    if lossless and source_format in {"JPEG", "WebP"}:
        return src, "Lossless only: this format cannot be recompressed without changing image data, so the original was retained.", []
    image = image.convert("RGBA" if preserve_transparency else "RGB") if out_format != "PNG" else image.convert("RGBA" if preserve_transparency else "RGB")
    if source_format not in {"JPEG", "PNG", "WebP"}: warnings.append(f"Output converted from {source_format} to {out_format}; original animation may not be preserved.")
    if source_format == "PNG" and lossless:
        dest = outdir / "optimized.png"
        image.save(dest, format="PNG", optimize=True, compress_level=9, icc_profile=im.info.get("icc_profile"))
        return dest, "Lossless PNG optimization preserves pixels and transparency.", warnings
    qualities = ([52] if smallest and not target else [22, 30, 40, 52, 64, 72, 80, 88, 95] if smallest else [88] if not target else [95, 88, 80, 72, 64, 52, 40, 30, 22]) if out_format != "PNG" else [100] if not target else [100, 90, 80, 70, 60, 45]
    # Lossy output explores quality and bounded image scaling. Always return the best measured candidate.
    factors = [1.0, .9, .78, .65, .5] if target and target < src.stat().st_size * .65 and not lossless else [1.0]
    best: tuple[int, Path, str] | None = None
    for factor in factors:
        candidate_image = image
        if factor < 1:
            candidate_image = image.copy()
            candidate_image.thumbnail((max(1, int(image.width * factor)), max(1, int(image.height * factor))), Image.Resampling.LANCZOS)
        for quality in qualities:
            if cancelled(): raise CompressionError("Compression was cancelled.")
            dest = outdir / f"candidate-{int(factor*100)}-{quality}.{ 'jpg' if out_format == 'JPEG' else out_format.lower()}"
            options = {"format": out_format, "optimize": True}
            if out_format in {"JPEG", "WEBP"}:
                options["quality"] = quality
                if out_format == "JPEG": options["progressive"] = True
            elif out_format == "PNG": options.update(compress_level=9)
            if im.info.get("icc_profile"): options["icc_profile"] = im.info["icc_profile"]
            try:
                candidate_image.save(dest, **options)
            except (OSError, ValueError) as exc:
                raise CompressionError(f"The image encoder could not create a valid output ({type(exc).__name__}).") from exc
            size = dest.stat().st_size
            if best is None or size < best[0]: best = (size, dest, f"Quality {quality}, {candidate_image.width} × {candidate_image.height}")
            if target and size <= target:
                return dest, f"Target reached at quality {quality}, {candidate_image.width} × {candidate_image.height}.", warnings
            if time.monotonic() - _clock.started > max_seconds: break
        if time.monotonic() - _clock.started > max_seconds: break
    assert best
    if not target and best[0] >= src.stat().st_size:
        return src, "Optimization did not save space; the original was retained.", warnings
    return best[1], f"Best candidate: {best[2]}.", warnings


def _pdf(src: Path, outdir: Path) -> tuple[Path, str, list[str]]:
    try:
        doc = fitz.open(src)
        if doc.is_encrypted: raise CompressionError("This PDF is password protected. Unlock it and upload it again.")
        if doc.page_count < 1 or doc.page_count > 5000: raise CompressionError("This PDF has an unsafe or unsupported page count.")
        dest = outdir / "optimized.pdf"
        doc.save(dest, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True)
        result = fitz.open(dest)
        if result.page_count != doc.page_count: raise CompressionError("The optimized PDF did not pass page-count validation.")
        result.close(); doc.close()
        if dest.stat().st_size >= src.stat().st_size:
            return src, "Lossless structural optimization did not reduce the file; the original was retained.", ["Further reduction would require changing embedded media or content."]
        return dest, "PDF structure optimized; page count, text, and vectors retained.", []
    except fitz.FileDataError as exc:
        raise CompressionError("This PDF is damaged or incomplete.") from exc
    except fitz.EmptyFileError as exc:
        raise CompressionError("The PDF has no readable content.") from exc


def _zip(src: Path, filename: str, outdir: Path, max_seconds: int, cancelled: Callable[[], bool]) -> tuple[Path, str, list[str]]:
    dest = outdir / f"optimized-{Path(filename).name}"
    try:
        with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dest, "w", allowZip64=True, compresslevel=9) as zout:
            infos = zin.infolist()
            if len(infos) > 10000 or sum(x.file_size for x in infos) > 2_000_000_000:
                raise CompressionError("This archive exceeds safe entry-count or expanded-size limits.")
            for info in infos:
                if cancelled(): raise CompressionError("Compression was cancelled.")
                if time.monotonic() - _clock.started > max_seconds: break
                if info.flag_bits & 1: raise CompressionError("Encrypted archives cannot be safely recompressed.")
                if info.is_dir(): zout.writestr(info, b""); continue
                if info.file_size > 256_000_000: raise CompressionError("An archive entry exceeds the 256 MB safety limit.")
                # No extraction to disk: member paths are never used as filesystem paths.
                clone = zipfile.ZipInfo(info.filename, info.date_time)
                clone.compress_type = zipfile.ZIP_DEFLATED
                clone.external_attr, clone.create_system, clone.flag_bits = info.external_attr, info.create_system, info.flag_bits & ~1
                copied = 0
                with zin.open(info) as member, zout.open(clone, "w") as output:
                    while True:
                        chunk = member.read(1024 * 1024)
                        if not chunk: break
                        copied += len(chunk)
                        if copied > 256_000_000 or copied > info.file_size: raise CompressionError("An archive member exceeded its declared size or the 256 MB safety limit.")
                        output.write(chunk)
                if copied != info.file_size: raise CompressionError("An archive member did not match its declared size.")
        with zipfile.ZipFile(dest) as check:
            bad = check.testzip()
            if bad: raise CompressionError("The archive failed output integrity validation.")
        return dest, "Archive contents validated. Already-compressed members may not shrink.", []
    except zipfile.BadZipFile as exc:
        raise CompressionError("This archive is damaged or incomplete.") from exc


def _ffmpeg(src: Path, outdir: Path, kind: str, target: int | None, mode: str, max_seconds: int, cancelled: Callable[[], bool]) -> tuple[Path, str, list[str], int]:
    ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if not ffmpeg or not ffprobe: raise CompressionError("FFmpeg/ffprobe was not found. Install FFmpeg and add its bin folder to PATH.")
    probe = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", str(src)], capture_output=True, text=True, timeout=15, shell=False)
    if probe.returncode: raise CompressionError("FFmpeg could not read this media file. It may be corrupt or unsupported.")
    try: meta = json.loads(probe.stdout); duration = max(float(meta["format"]["duration"]), .01)
    except (ValueError, KeyError, TypeError): raise CompressionError("Media duration could not be determined safely.")
    video = kind in {"MP4", "MOV", "MKV", "WebM", "AVI"}
    ext = ".mp4" if video else ".mp3"
    warning = "" if video else "Audio is converted to MP3; this does not restore quality from a lossy original."
    stream_types = {s.get("codec_type") for s in meta.get("streams", [])}
    candidates: list[tuple[int, Path]] = []
    attempts = 0
    fractions = [.55, .42, .3, .22, .16] if mode == "smallest" else [.95, .82, .7, .58, .45]
    if video:
        codecs = [s.get("codec_name", "unknown") for s in meta.get("streams", []) if s.get("codec_type") == "video"]
        warning = f"Original video codec: {', '.join(codecs) or 'unknown'}. Re-encoded to H.264/AAC."
        audio_bps = 96_000 if "audio" in stream_types else 0
        base = int((target or src.stat().st_size * .75) * 8 / duration)
        base = max(base, 144_000 if "audio" in stream_types else 80_000)
        rates = list(dict.fromkeys(max(80_000, int(base * fraction) - audio_bps) for fraction in ([.95] if not target else fractions)))
    else:
        base = int((target or src.stat().st_size * .7) * 8 / duration)
        rates = list(dict.fromkeys(max(32_000, min(320_000, int(base * fraction))) for fraction in ([.95] if not target else fractions)))
    best: tuple[int, Path] | None = None
    for index, bitrate in enumerate(rates[:5], 1):
        if cancelled(): raise CompressionError("Compression was cancelled.")
        if time.monotonic() - _clock.started > max_seconds: break
        dest = outdir / f"candidate-{index}{ext}"
        if video:
            video_bps = max(80_000, bitrate)
            cmd = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-map", "0:v:0?"]
            if "audio" in stream_types: cmd += ["-map", "0:a:0?", "-c:a", "aac", "-b:a", str(audio_bps)]
            cmd += ["-c:v", "libx264", "-preset", "medium", "-b:v", str(video_bps), "-maxrate", str(video_bps), "-bufsize", str(video_bps * 2), "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", str(dest)]
        else:
            cmd = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-vn", "-c:a", "libmp3lame", "-b:a", str(bitrate), "-progress", "pipe:1", "-nostats", str(dest)]
        try:
            process = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, shell=False)
            assert process.stdout
            for line in process.stdout:
                if cancelled(): process.kill(); raise CompressionError("Compression was cancelled.")
                if time.monotonic() - _clock.started > max_seconds: process.kill(); raise CompressionError("Media conversion timed out. Try a shorter or smaller file.")
            process.wait(timeout=5)
            if process.returncode != 0: raise CompressionError("FFmpeg could not encode this media file.")
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise CompressionError("The media converter failed. Check that FFmpeg is installed and the disk has free space.") from exc
        attempts += 1
        if not dest.exists() or dest.stat().st_size == 0: raise CompressionError("The encoder did not produce a valid output.")
        size = dest.stat().st_size
        if best is None or size < best[0]: best = (size, dest)
        if target and size <= target: best = (size, dest); break
        if not target: best = (size, dest); break
    if not best: raise CompressionError("Media conversion timed out before a valid candidate was produced.")
    if target and best[0] > target: warning += " The best tested bitrate remained above the requested size."
    return best[1], warning, ["This media conversion is lossy; quality was balanced against the target."], attempts


def compress(src: Path, filename: str, outdir: Path, target: int | None, mode: str, max_seconds: int, cancelled: Callable[[], bool] = lambda: False) -> dict:
    _clock.started = time.monotonic()
    info = detect(src, filename)
    if not info["supported"]: raise CompressionError(f"{info['format']} files cannot be compressed meaningfully by this service. Use the original format's export options.")
    if target is not None and target <= 0: raise CompressionError("Target size must be greater than zero.")
    src_size = src.stat().st_size
    if target and target >= src_size:
        return {"path": str(src), "format": info["format"], "message": "Requested target is at least the original size; compression was skipped.", "warnings": [], "target_reached": False, "iterations": 0}
    if mode == "lossless" and info["format"] in {"MP4", "MOV", "MKV", "WebM", "AVI", "MP3", "WAV", "FLAC", "M4A", "AAC", "OGG"}:
        return {"path": str(src), "format": info["format"], "message": "Lossless-only mode: no lossless encoder is available for this container, so the original was retained unchanged.", "warnings": [], "target_reached": False, "iterations": 0}
    if cancelled(): raise CompressionError("Compression was cancelled.")
    if info["format"] in IMAGE_FORMATS:
        output, message, warnings = _image_candidates(src, outdir, target, mode == "lossless", mode == "smallest", max_seconds, cancelled)
    elif info["format"] == "PDF": output, message, warnings = _pdf(src, outdir)
    elif info["format"] in {"ZIP", "DOCX", "PPTX", "XLSX", "ODT", "ODS", "ODP", "EPUB"}:
        output, message, warnings = _zip(src, filename, outdir, max_seconds, cancelled)
    elif info["format"] in {"MP4", "MOV", "MKV", "WebM", "AVI", "MP3", "WAV", "FLAC", "M4A", "AAC", "OGG"}:
        output, message, warnings, iterations = _ffmpeg(src, outdir, info["format"], target, mode, max_seconds, cancelled)
    else:
        raise CompressionError(f"{info['format']} is detectable but has no safe compression adapter installed.")
    actual = output.stat().st_size
    if actual >= src_size and info["format"] in {"ZIP", "DOCX", "PPTX", "XLSX", "ODT", "ODS", "ODP", "EPUB"}:
        # Do not ship a larger rewritten ZIP package.
        return {"path": str(src), "format": info["format"], "message": "Recompression did not save space; returned the original unchanged.", "warnings": ["The contents are already compressed; further lossless reduction is unlikely."], "target_reached": False, "iterations": 1}
    reached = bool(target and (actual == target if mode == "exact" else actual <= target))
    if target and not reached: message += " Best valid output is larger than the requested target; further reduction would need stronger quality loss or unsupported operations."
    return {"path": str(output), "format": output.suffix.lstrip(".").upper(), "message": message, "warnings": warnings, "target_reached": reached, "iterations": locals().get("iterations", 1)}
