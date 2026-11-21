# Android wrapper

This WebView client uses the same HTTPS service as the browser app. It does not
run Python or FFmpeg on the device. Uploads use Android's document picker.
Individual results and ZIP batches send scoped authorization directly to the
compressor, then stream into a destination chosen with Android's document saver.
CSV reports use that saver too. No broad storage permission is required.

The default server is `https://smartcompress-8eq6.onrender.com/`. It must be running
and serve the matching web UI. Configure another trusted HTTPS server at build time:

```powershell
cd android
gradle -PsmartcompressHome=https://your-server.example/ assembleDebug
```

Use JDK 17, Gradle 8.9, Android SDK platform 35 and build tools 35.0.0.
The repository currently uses a system Gradle installation; there is no Gradle
wrapper. The GitHub workflow installs the required Gradle and SDK versions.
The debug APK is produced in `app/build/outputs/apk/debug/`. Use a signed release
build and your own keystore before distribution.

The Java bridge accepts only compressor download paths. It rejects external URLs,
query-string tokens, malformed tokens and oversized batch/report requests. HTTP
redirects and mixed content are disabled. Third-party navigation opens externally.

Validation of the bridge request rules can run without an emulator:

```powershell
javac -d ..\.audit\java-tests app\src\main\java\com\smartcompress\app\DownloadRequest.java ..\tests\DownloadRequestTest.java
java -cp ..\.audit\java-tests com.smartcompress.app.DownloadRequestTest
```

Before distributing, test multi-file selection, a single result, ZIP batches, CSV
export, picker cancellation, rotation and expired results on an actual Android
device or emulator. The wrapper depends on the server's availability.
