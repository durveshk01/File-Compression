package com.smartcompress.app;

public final class DownloadRequestTest {
    private static void rejected(String home, String path, String token, String body) {
        try { new DownloadRequest(home, path, token, "result.jpg", body); }
        catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("Unsafe download was allowed");
    }

    public static void main(String[] args) {
        String home = "https://compress.example/", path = "/api/v1/compression-jobs/" + "a".repeat(32) + "/download", token = "b".repeat(43);
        DownloadRequest good = new DownloadRequest(home, path, token, "../photo.jpg", "");
        if (!good.url.equals("https://compress.example" + path) || good.name.contains("/")) throw new AssertionError("Invalid scoped request");
        rejected(home, "https://evil.example/", token, "");
        rejected(home, "//evil.example/api/v1/compression-jobs/batch-download", token, "");
        rejected("http://compress.example/", path, token, "");
        rejected(home, path, "bad", "");
        rejected(home, path + "?token=secret", token, "");
        rejected(home, path, token, "{}");
        rejected(home, "/api/v1/compression-jobs/batch-download", "", "");
        DownloadRequest batch = new DownloadRequest(home, "/api/v1/compression-jobs/batch-download", "", "results.zip", "{\"jobs\":[]}");
        if (!batch.mimeType.equals("application/zip")) throw new AssertionError("Batch type mismatch");
        DownloadRequest report = new DownloadRequest("filename,original_bytes\nphoto.jpg,100", "report.csv");
        if (!report.mimeType.equals("text/csv") || report.url != null) throw new AssertionError("Invalid report request");
        System.out.println("Download request validation passed");
    }
}
