package app.nobi.photos.library;

import android.Manifest;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.util.Size;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;

@CapacitorPlugin(name = "NobiPhotoLibrary", permissions = {
    @Permission(alias = "legacy", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
    @Permission(alias = "images", strings = { "android.permission.READ_MEDIA_IMAGES" }),
    @Permission(alias = "selected", strings = { "android.permission.READ_MEDIA_VISUAL_USER_SELECTED" })
})
public class NobiPhotoLibraryPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private List<String> snapshot;
    private String session;
    private LocalImageClassifier classifier;
    private final Map<String, File> originals = new HashMap<>();
    private volatile boolean foreground = true;
    private volatile long viewerGeneration;
    private File viewerDirectory() { return new File(getContext().getCacheDir(), "nobi-viewer"); }
    private void clearOriginals() {
        originals.clear();
        File[] files = viewerDirectory().listFiles();
        if (files != null) for (File file : files) if (file.isFile()) file.delete();
    }
    @Override public void load() { worker.execute(this::clearOriginals); }
    @Override protected void handleOnResume() { foreground = true; }
    @Override protected void handleOnPause() {
        foreground = false; viewerGeneration++;
        worker.execute(this::clearOriginals);
    }
    private static final Uri COLLECTION = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
    private String iso(long millis) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(Math.max(0, millis)));
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }
    private String access() {
        if (Build.VERSION.SDK_INT >= 33 && granted("android.permission.READ_MEDIA_IMAGES")) return "granted";
        if (Build.VERSION.SDK_INT >= 34 && granted("android.permission.READ_MEDIA_VISUAL_USER_SELECTED")) return "limited";
        if (Build.VERSION.SDK_INT < 33 && granted(Manifest.permission.READ_EXTERNAL_STORAGE)) return "granted";
        String alias = Build.VERSION.SDK_INT >= 33 ? "images" : "legacy";
        return getPermissionState(alias) == PermissionState.PROMPT ? "prompt" : "denied";
    }
    private void requireAccess() {
        String state = access();
        if (!state.equals("granted") && !state.equals("limited")) throw new SecurityException("Photo access is not granted");
    }
    @PluginMethod public void getAccess(PluginCall call) { call.resolve(new JSObject().put("status", access())); }
    @PluginMethod public void requestAccess(PluginCall call) {
        String[] aliases = Build.VERSION.SDK_INT >= 34 ? new String[]{"images", "selected"}
            : Build.VERSION.SDK_INT >= 33 ? new String[]{"images"} : new String[]{"legacy"};
        requestPermissionForAliases(aliases, call, "accessResult");
    }
    @PermissionCallback private void accessResult(PluginCall call) { getAccess(call); }
    @PluginMethod public void openSettings(PluginCall call) {
        getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
        call.resolve();
    }
    private void run(PluginCall call, Runnable task) {
        worker.execute(() -> { try { task.run(); } catch (SecurityException error) { call.reject("Photo permission changed", "PERMISSION_DENIED"); }
            catch (Exception error) { call.reject("Local photo operation failed", "LOCAL_READ_FAILED"); } });
    }
    @PluginMethod public void beginSnapshot(PluginCall call) { run(call, () -> {
        requireAccess();
        if (session != null) throw new IllegalStateException("A snapshot is already open");
        List<String> ids = new ArrayList<>();
        try (Cursor cursor = getContext().getContentResolver().query(COLLECTION, new String[]{"_id"}, null, null, "date_added DESC, _id DESC")) {
            if (cursor == null) throw new IllegalStateException("MediaStore unavailable");
            while (cursor.moveToNext()) ids.add(cursor.getString(0));
        }
        requireAccess(); snapshot = ids; session = UUID.randomUUID().toString();
        call.resolve(new JSObject().put("sessionId", session).put("total", ids.size()));
    }); }
    private Map<String, JSObject> read(List<String> ids) {
        Map<String, JSObject> rows = new HashMap<>();
        if (ids.isEmpty()) return rows;
        String placeholders = android.text.TextUtils.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        String[] projection = {"_id", "_display_name", "datetaken", "date_added", "date_modified", "width", "height", "_size"};
        try (Cursor cursor = getContext().getContentResolver().query(COLLECTION, projection, "_id IN (" + placeholders + ")", ids.toArray(new String[0]), null)) {
            if (cursor == null) throw new IllegalStateException("MediaStore unavailable");
            while (cursor.moveToNext()) {
                String id = cursor.getString(0);
                long taken = cursor.getLong(2); if (taken <= 0) taken = cursor.getLong(3) * 1000;
                rows.put(id, new JSObject().put("assetId", id).put("title", cursor.getString(1) == null ? "本机照片" : cursor.getString(1))
                    .put("takenAt", iso(taken))
                    .put("modifiedAt", iso(cursor.getLong(4) * 1000))
                    .put("width", Math.max(1, cursor.getInt(5))).put("height", Math.max(1, cursor.getInt(6)))
                    .put("bytes", Math.max(0, cursor.getLong(7))).put("bytesKnown", !cursor.isNull(7)));
            }
        }
        return rows;
    }
    @PluginMethod public void readPage(PluginCall call) { run(call, () -> {
        requireAccess();
        if (session == null || !session.equals(call.getString("sessionId"))) throw new IllegalStateException("Snapshot expired");
        int offset = call.getInt("offset", 0), limit = call.getInt("limit", 100);
        if (offset < 0 || offset > snapshot.size() || limit < 1 || limit > 200) throw new IllegalArgumentException();
        int end = Math.min(snapshot.size(), offset + limit);
        List<String> ids = snapshot.subList(offset, end); Map<String, JSObject> rows = read(ids); JSArray result = new JSArray();
        for (String id : ids) if (rows.containsKey(id)) result.put(rows.get(id));
        requireAccess(); call.resolve(new JSObject().put("photos", result).put("nextOffset", end).put("done", end == snapshot.size()));
    }); }
    @PluginMethod public void endSnapshot(PluginCall call) { run(call, () -> {
        if (session != null && session.equals(call.getString("sessionId"))) { snapshot = null; session = null; }
        call.resolve();
    }); }
    @PluginMethod public void filterAccessible(PluginCall call) { run(call, () -> {
        requireAccess(); JSONArray input = call.getArray("assetIds", new JSArray());
        if (input.length() > 200) throw new IllegalArgumentException();
        List<String> ids = new ArrayList<>(); for (int i=0; i<input.length(); i++) ids.add(input.optString(i));
        call.resolve(new JSObject().put("assetIds", new JSArray(new ArrayList<>(read(ids).keySet()))));
    }); }
    @PluginMethod public void thumbnail(PluginCall call) { run(call, () -> {
        requireAccess(); String id = call.getString("assetId", "");
        if (!id.matches("[0-9]+")) throw new IllegalArgumentException();
        Uri uri = ContentUris.withAppendedId(COLLECTION, Long.parseLong(id)); Bitmap bitmap;
        try {
            if (Build.VERSION.SDK_INT >= 29) bitmap = getContext().getContentResolver().loadThumbnail(uri, new Size(256, 256), null);
            else {
                BitmapFactory.Options bounds = new BitmapFactory.Options(); bounds.inJustDecodeBounds = true;
                try (InputStream stream = getContext().getContentResolver().openInputStream(uri)) { BitmapFactory.decodeStream(stream, null, bounds); }
                BitmapFactory.Options options = new BitmapFactory.Options(); options.inSampleSize = 1;
                while (Math.max(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 512) options.inSampleSize *= 2;
                try (InputStream stream = getContext().getContentResolver().openInputStream(uri)) { bitmap = BitmapFactory.decodeStream(stream, null, options); }
            }
            if (bitmap == null) throw new IllegalStateException();
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(); bitmap.compress(Bitmap.CompressFormat.JPEG, 75, bytes); bitmap.recycle();
            requireAccess(); call.resolve(new JSObject().put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)));
        } catch (SecurityException error) { throw error; }
          catch (Exception error) { call.resolve(new JSObject().put("dataUrl", "")); }
    }); }
    @PluginMethod public void classify(PluginCall call) { run(call, () -> {
        requireAccess(); String id = call.getString("assetId", "");
        if (!id.matches("[0-9]+")) throw new IllegalArgumentException();
        Uri uri = ContentUris.withAppendedId(COLLECTION, Long.parseLong(id));
        Bitmap bitmap = null;
        try {
            if (Build.VERSION.SDK_INT >= 29) bitmap = getContext().getContentResolver().loadThumbnail(uri, new Size(512, 512), null);
            else {
                BitmapFactory.Options bounds = new BitmapFactory.Options(); bounds.inJustDecodeBounds = true;
                try (InputStream input = getContext().getContentResolver().openInputStream(uri)) { BitmapFactory.decodeStream(input, null, bounds); }
                BitmapFactory.Options options = new BitmapFactory.Options(); options.inSampleSize = 1;
                while (Math.max(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 512) options.inSampleSize *= 2;
                try (InputStream input = getContext().getContentResolver().openInputStream(uri)) { bitmap = BitmapFactory.decodeStream(input, null, options); }
            }
            if (bitmap == null) throw new IllegalStateException();
            if (classifier == null) classifier = new LocalImageClassifier(getContext().getAssets());
            JSObject result = classifier.classify(bitmap);
            requireAccess();
            // A limited-access change may leave the general permission granted.
            try (Cursor check = getContext().getContentResolver().query(uri, new String[]{"_id"}, null, null, null)) {
                if (check == null || !check.moveToFirst()) throw new SecurityException();
            }
            call.resolve(result);
        } catch (SecurityException error) { throw error; }
          catch (Exception error) { call.reject("Local AI unavailable for this image", "LOCAL_AI_FAILED"); }
        finally { if (bitmap != null) bitmap.recycle(); }
    }); }
    @PluginMethod public void original(PluginCall call) {
        final long generation = viewerGeneration;
        run(call, () -> {
            requireAccess();
            String id = call.getString("assetId", ""), lease = call.getString("leaseId", "");
            if (!id.matches("[0-9]+") || !lease.matches("[a-fA-F0-9-]{36}") || !foreground || generation != viewerGeneration) {
                call.reject("Viewer closed", "VIEWER_CLOSED"); return;
            }
            Uri uri = ContentUris.withAppendedId(COLLECTION, Long.parseLong(id));
            Map<String, JSObject> rows = read(java.util.Collections.singletonList(id));
            JSObject row = rows.get(id);
            if (row == null) throw new SecurityException();
            if ((long) row.optInt("width") * row.optInt("height") > 64000000L || row.optLong("bytes") > 80L * 1024 * 1024) {
                call.reject("Original exceeds safe viewer limits", "ORIGINAL_TOO_LARGE"); return;
            }
            String mime = getContext().getContentResolver().getType(uri);
            String extension = "image/jpeg".equals(mime) ? "jpg" : "image/png".equals(mime) ? "png"
                : "image/webp".equals(mime) ? "webp" : "image/gif".equals(mime) ? "gif"
                : "image/heic".equals(mime) ? "heic" : "image/heif".equals(mime) ? "heif"
                : "image/avif".equals(mime) ? "avif" : null;
            if (extension == null) { call.reject("Unsupported original format", "ORIGINAL_FORMAT"); return; }
            clearOriginals(); // One original at a time, independent of the thumbnail cache.
            File directory = viewerDirectory();
            if (!directory.isDirectory() && !directory.mkdirs()) { call.reject("Cache unavailable"); return; }
            File file = new File(directory, lease + "." + extension);
            boolean retained = false;
            try {
                try (InputStream input = getContext().getContentResolver().openInputStream(uri);
                     FileOutputStream output = new FileOutputStream(file)) {
                    if (input == null) throw new IOException();
                    byte[] buffer = new byte[65536]; int count; long total = 0;
                    while ((count = input.read(buffer)) != -1) {
                        total += count;
                        if (!foreground || generation != viewerGeneration || total > 80L * 1024 * 1024) throw new IOException();
                        output.write(buffer, 0, count);
                    }
                    if (total == 0) throw new IOException();
                }
                requireAccess();
                try (Cursor check = getContext().getContentResolver().query(uri, new String[]{"_id"}, null, null, null)) {
                    if (check == null || !check.moveToFirst()) throw new SecurityException();
                }
                if (!foreground || generation != viewerGeneration) throw new IOException();
                originals.put(lease, file); retained = true;
                call.resolve(new JSObject().put("fileUri", Uri.fromFile(file).toString()));
            } catch (SecurityException error) { throw error; }
              catch (Exception error) { call.reject("Local original unavailable", "ORIGINAL_UNAVAILABLE"); }
            finally { if (!retained) file.delete(); }
        });
    }
    @PluginMethod public void releaseOriginal(PluginCall call) { run(call, () -> {
        File file = originals.remove(call.getString("leaseId", ""));
        if (file != null) file.delete();
        call.resolve();
    }); }
    @Override protected void handleOnDestroy() {
        // Serialize release with any inference in progress.
        foreground = false; viewerGeneration++;
        worker.execute(() -> { clearOriginals(); if (classifier != null) { classifier.close(); classifier = null; } });
        worker.shutdown(); snapshot = null; session = null;
    }
}
