# Bundled offline image model

- Model: quantized MobileNet V2 1.0 / 224, CPU UINT8 RGB input `[1,224,224,3]`, 1001 ImageNet output labels including background at index 0.
- Official source: https://github.com/google-coral/test_data/tree/104342d2d3480b3e66203073dac24f4e2dbb4c41
- Model file: `mobilenet_v2_1.0_224_quant.tflite` (3,610,798 bytes).
- SHA-256: `7aad0c74c5e3c06e5eb3c827e13304fdd68a83da6087d92ee169c24ff9fd4776`.
- Label file: `imagenet_labels.txt` from the same revision. The repository's Apache-2.0 license is included as `LICENSE`.
- Runtime: standalone `com.google.ai.edge.litert:litert:1.4.2`, CPU Interpreter API. No Play Services runtime, telemetry SDK, model URL or runtime download is used.
- The model runs only after an explicit user action. Scores below 0.55 or labels outside the six broad, non-sensitive visual topics are not assigned an album.
- This is general image classification, not face recognition, OCR, semantic text-image search, or a guarantee of correct organization. Android and Apple Vision results can differ.

The app checks the model hash and tensor shapes before first use. Input and output stay in memory; the original photo is never copied into this directory or modified.
