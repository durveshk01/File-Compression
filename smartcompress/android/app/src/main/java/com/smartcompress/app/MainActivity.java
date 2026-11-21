package com.smartcompress.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int FILE_PICKER_REQUEST = 4102;
    private static final int SAVE_REQUEST = 4103;
    private static final String HOME = BuildConfig.SMARTCOMPRESS_HOME;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private DownloadRequest pendingDownload;
    private final ExecutorService downloads = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.addJavascriptInterface(new DownloadBridge(), "SmartCompress");
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && Uri.parse(HOME).getAuthority().equals(uri.getAuthority())) return false;
                if (!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme())) return true;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                catch (ActivityNotFoundException ignored) { }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), FILE_PICKER_REQUEST); }
                catch (ActivityNotFoundException error) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "No file picker is available", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
        webView.setDownloadListener((url, userAgent, disposition, mimeType, size) -> message("Use the file's Download button to save the result."));
        if (state == null) webView.loadUrl(HOME); else webView.restoreState(state);
    }

    private final class DownloadBridge {
        @JavascriptInterface public void download(String path, String token, String name, String body) {
            try { requestSave(new DownloadRequest(HOME, path, token, name, body)); }
            catch (IllegalArgumentException error) { message("Invalid download request"); }
        }
        @JavascriptInterface public void saveText(String text, String name) {
            try { requestSave(new DownloadRequest(text, name)); }
            catch (IllegalArgumentException error) { message("The report could not be saved"); }
        }
    }

    private void message(String text) {
        runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) Toast.makeText(this, text, Toast.LENGTH_LONG).show(); });
    }

    private void requestSave(DownloadRequest request) {
        runOnUiThread(() -> {
            if (isFinishing() || isDestroyed()) return;
            if (pendingDownload != null) { message("Choose a location for the current download first"); return; }
            pendingDownload = request;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(request.mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, request.name);
            try { startActivityForResult(intent, SAVE_REQUEST); }
            catch (ActivityNotFoundException error) { pendingDownload = null; message("No document saver is available"); }
        });
    }

    private void saveResult(DownloadRequest request, Uri destination) {
        downloads.execute(() -> {
            HttpURLConnection connection = null;
            try {
                if (request.text != null) {
                    try (OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                        if (output == null) throw new java.io.IOException("No output stream");
                        output.write(request.text.getBytes(StandardCharsets.UTF_8));
                    }
                } else {
                    connection = (HttpURLConnection) new URL(request.url).openConnection();
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(30000); connection.setReadTimeout(120000);
                    if (request.body.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + request.token);
                    else {
                        connection.setRequestMethod("POST"); connection.setDoOutput(true);
                        connection.setRequestProperty("Content-Type", "application/json");
                        byte[] body = request.body.getBytes(StandardCharsets.UTF_8);
                        connection.setFixedLengthStreamingMode(body.length);
                        try (OutputStream output = connection.getOutputStream()) { output.write(body); }
                    }
                    if (connection.getResponseCode() != 200) throw new java.io.IOException("Result unavailable");
                    try (InputStream input = connection.getInputStream(); OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                        if (output == null) throw new java.io.IOException("No output stream");
                        byte[] buffer = new byte[65536]; int length;
                        while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
                    }
                }
                message("File saved");
            } catch (Exception error) {
                try { DocumentsContract.deleteDocument(getContentResolver(), destination); } catch (Exception ignored) { }
                message("Download failed. The result may have expired; try again.");
            } finally { if (connection != null) connection.disconnect(); }
        });
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SAVE_REQUEST) {
            DownloadRequest request = pendingDownload; pendingDownload = null;
            if (request != null && resultCode == RESULT_OK && data != null && data.getData() != null) saveResult(request, data.getData());
            return;
        }
        if (requestCode == FILE_PICKER_REQUEST && fileCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileCallback.onReceiveValue(results);
            fileCallback = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        pendingDownload = null;
        if (webView != null) { webView.removeJavascriptInterface("SmartCompress"); webView.destroy(); }
        downloads.shutdown();
        super.onDestroy();
    }
}
