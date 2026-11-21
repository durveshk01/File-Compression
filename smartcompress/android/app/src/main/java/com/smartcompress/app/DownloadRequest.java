package com.smartcompress.app;

import java.net.URI;

/** Only scoped compressor endpoints can be opened by the WebView bridge. */
final class DownloadRequest {
    final String url;
    final String token;
    final String name;
    final String body;
    final String text;
    final String mimeType;

    DownloadRequest(String home, String path, String token, String name, String body) {
        URI origin = URI.create(home);
        if (!"https".equals(origin.getScheme()) || origin.getHost() == null) throw new IllegalArgumentException("An HTTPS server is required");
        if (path == null || body == null || name == null || token == null) throw new IllegalArgumentException("Missing download details");
        boolean batch = path.equals("/api/v1/compression-jobs/batch-download");
        if (!batch && !path.matches("/api/v1/compression-jobs/[a-f0-9]{32}/download")) throw new IllegalArgumentException("Unsupported download endpoint");
        if (!batch && (!token.matches("[A-Za-z0-9_-]{32,64}") || !body.isEmpty())) throw new IllegalArgumentException("Invalid result access token");
        if (batch && (body.isEmpty() || body.length() > 20000 || !token.isEmpty())) throw new IllegalArgumentException("Invalid batch download");
        this.url = origin.resolve(path).toString();
        this.token = token;
        this.name = safeName(name);
        this.body = body;
        this.text = null;
        this.mimeType = batch ? "application/zip" : "application/octet-stream";
    }

    DownloadRequest(String text, String name) {
        if (text == null || text.length() > 262144) throw new IllegalArgumentException("The report is too large");
        this.url = null; this.token = ""; this.name = safeName(name); this.body = "";
        this.text = text; this.mimeType = "text/csv";
    }

    private static String safeName(String name) {
        if (name == null) throw new IllegalArgumentException("Missing filename");
        String safe = name.replaceAll("[\\\\/\\p{Cntrl}]", "_");
        return safe.isEmpty() ? "smartcompress-result" : safe.substring(0, Math.min(150, safe.length()));
    }
}
