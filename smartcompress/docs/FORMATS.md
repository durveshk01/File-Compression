# Supported format matrix

The running API is authoritative for installed engines: `GET /api/v1/formats` and `GET /api/v1/health`.

| Format family | Formats | Availability | Output and preservation |
| --- | --- | --- | --- |
| Raster images | JPEG, PNG, WebP, GIF, BMP, TIFF, ICO | Implemented with Pillow | JPEG/WebP quality and scale candidates; lossless PNG; GIF animation retained with timing and palette differences possible; BMP/TIFF/ICO convert to PNG. Metadata is removed; ICC profile is preserved where supported. |
| PDF | PDF | Implemented with PyMuPDF | Structural cleanup/deflate, text/vector content and page count validation. No image downsampling; encrypted or malformed input rejected. |
| Video | MP4, MOV, MKV, WebM, AVI | Implemented when ffmpeg and ffprobe are available | H.264/AAC MP4 output, up to five bitrate candidates. CPU encoding; lossy; measured target may be missed. |
| Audio | MP3, WAV, FLAC, M4A, AAC, OGG | Implemented when ffmpeg and ffprobe are available | MP3 output with bitrate candidates; lossy. Lossless-only mode preserves the source unchanged. |
| ZIP packages | ZIP, DOCX, PPTX, XLSX, ODT, ODS, ODP, EPUB | Implemented | Recompresses members while preserving member bytes and paths; validates resulting archive. Does not optimize embedded assets. |
| Detected without adapter | SVG, TAR, GZIP, 7Z, AVIF, HEIC/HEIF, WMA, executables/proprietary | Unsupported | Reports a useful limitation instead of pretending arbitrary compression is possible. |

Signatures/container parsing override browser MIME. Extensions that conflict with content are rejected. Media must pass ffprobe and contain the expected stream type. Images over 80 megapixels and archives over safety limits are rejected. No archive member is extracted to disk.

## Native dependencies

- **Required for video/audio:** FFmpeg build with `libx264`, AAC and `libmp3lame`, plus `ffprobe`. The adapter uses H.264/AAC MP4 output and MP3 output. Hardware encoders are not assumed.
- **Not required:** Ghostscript, qpdf, Redis, a database, Node.js or a frontend build tool.
- **Optional formats not enabled:** AVIF/HEIC require codecs in Pillow; those inputs are not declared supported by this adapter.
