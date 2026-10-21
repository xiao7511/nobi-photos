package app.nobi.photos.library;

import android.content.res.AssetManager;
import android.graphics.Bitmap;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.tensorflow.lite.DataType;
import org.tensorflow.lite.Interpreter;

/** APK-bundled CPU inference. No services, telemetry SDK or runtime model download. */
final class LocalImageClassifier implements AutoCloseable {
    private final Interpreter interpreter;
    private final String[] labels;
    private static final String HASH = "7aad0c74c5e3c06e5eb3c827e13304fdd68a83da6087d92ee169c24ff9fd4776";
    private static byte[] read(AssetManager assets, String path) throws Exception {
        try (InputStream input = assets.open(path); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] block = new byte[8192]; int size;
            while ((size = input.read(block)) != -1) output.write(block, 0, size);
            return output.toByteArray();
        }
    }
    LocalImageClassifier(AssetManager assets) throws Exception {
        byte[] model = read(assets, "nobi-ai/mobilenet_v2_1.0_224_quant.tflite");
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(model);
        StringBuilder hex = new StringBuilder();
        for (byte b : digest) hex.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        if (!HASH.equals(hex.toString())) throw new IllegalStateException("Invalid bundled model");
        ByteBuffer buffer = ByteBuffer.allocateDirect(model.length).order(ByteOrder.nativeOrder());
        buffer.put(model).rewind();
        interpreter = new Interpreter(buffer, new Interpreter.Options().setNumThreads(2));
        labels = new String(read(assets, "nobi-ai/imagenet_labels.txt"), StandardCharsets.UTF_8).trim().split("\\r?\\n");
        if (!Arrays.equals(interpreter.getInputTensor(0).shape(), new int[]{1,224,224,3}) ||
            interpreter.getInputTensor(0).dataType() != DataType.UINT8 ||
            interpreter.getOutputTensor(0).dataType() != DataType.UINT8 ||
            interpreter.getOutputTensor(0).numElements() != labels.length) {
            interpreter.close(); throw new IllegalStateException("Unexpected model tensors");
        }
    }
    JSObject classify(Bitmap source) {
        Bitmap scaled = Bitmap.createScaledBitmap(source, 224, 224, true);
        int[] pixels = new int[224 * 224]; scaled.getPixels(pixels, 0, 224, 0, 0, 224, 224);
        ByteBuffer input = ByteBuffer.allocateDirect(pixels.length * 3).order(ByteOrder.nativeOrder());
        for (int pixel : pixels) { input.put((byte)(pixel >> 16)); input.put((byte)(pixel >> 8)); input.put((byte)pixel); }
        input.rewind(); byte[][] output = new byte[1][labels.length];
        try { interpreter.run(input, output); }
        finally { if (scaled != source) scaled.recycle(); Arrays.fill(pixels, 0); input.clear(); }
        float scale = interpreter.getOutputTensor(0).quantizationParams().getScale();
        int zero = interpreter.getOutputTensor(0).quantizationParams().getZeroPoint();
        List<Integer> order = new ArrayList<>();
        for (int i = 1; i < labels.length; i++) order.add(i);
        order.sort((a, b) -> Integer.compare(output[0][b] & 255, output[0][a] & 255));
        JSArray results = new JSArray();
        for (int index : order.subList(0, Math.min(5, order.size()))) {
            double score = Math.max(0, Math.min(1, ((output[0][index] & 255) - zero) * scale));
            results.put(new JSObject().put("label", labels[index]).put("confidence", score));
        }
        return new JSObject().put("engine", "mobilenet-v2-int8").put("labels", results);
    }
    public void close() { interpreter.close(); }
}
