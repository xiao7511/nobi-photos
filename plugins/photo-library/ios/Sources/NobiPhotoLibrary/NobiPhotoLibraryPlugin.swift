import Foundation
import Capacitor
import Photos
import UIKit
import Vision

@objc(NobiPhotoLibraryPlugin)
public class NobiPhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NobiPhotoLibraryPlugin"
    public let jsName = "NobiPhotoLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "filterAccessible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "thumbnail", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "original", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "releaseOriginal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "classify", returnType: CAPPluginReturnPromise)
    ]
    private let worker = DispatchQueue(label: "app.nobi.photos.library")
    private var snapshot: [String]?
    private var session: String?
    private final class OriginalRead {
        let url: URL
        let handle: FileHandle
        var request: PHAssetResourceDataRequestID?
        var bytes = 0
        var failed = false
        init(url: URL, handle: FileHandle) { self.url = url; self.handle = handle }
    }
    private var originals: [String: OriginalRead] = [:]
    private var observers: [NSObjectProtocol] = []
    private var viewerActive = true
    private var viewerDirectory: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("nobi-viewer", isDirectory: true)
    }
    public override func load() {
        worker.async { self.clearOriginals() }
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self else { return }
            self.worker.async { self.viewerActive = false; self.clearOriginals() }
        })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self else { return }
            self.worker.async { self.viewerActive = true }
        })
    }
    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
    private func release(_ lease: String) {
        guard let read = originals.removeValue(forKey: lease) else { return }
        if let request = read.request { PHAssetResourceManager.default().cancelDataRequest(request) }
        try? read.handle.close()
        try? FileManager.default.removeItem(at: read.url)
    }
    private func clearOriginals() {
        for lease in Array(originals.keys) { release(lease) }
        if let files = try? FileManager.default.contentsOfDirectory(at: viewerDirectory, includingPropertiesForKeys: nil) {
            for file in files { try? FileManager.default.removeItem(at: file) }
        }
    }
    private func access() -> String {
        switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
        case .authorized: return "granted"
        case .limited: return "limited"
        case .notDetermined: return "prompt"
        default: return "denied"
        }
    }
    private func permitted() -> Bool { let status = access(); return status == "granted" || status == "limited" }
    @objc func getAccess(_ call: CAPPluginCall) { call.resolve(["status": access()]) }
    @objc func requestAccess(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in
            DispatchQueue.main.async { self.resolveAccessWhenActive(call, attempts: 0) }
        }
    }
    private func resolveAccessWhenActive(_ call: CAPPluginCall, attempts: Int) {
        // PhotoKit can finish before the permission sheet's inactive state ends.
        // Let the app-state listener restore foreground access before JS starts its explicit scan.
        if UIApplication.shared.applicationState == .active {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                if UIApplication.shared.applicationState == .active {
                    call.resolve(["status": self.access()])
                } else { self.resolveAccessWhenActive(call, attempts: attempts + 1) }
            }
        } else if attempts < 50 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.resolveAccessWhenActive(call, attempts: attempts + 1)
            }
        } else {
            // Never start background work; JS keeps its foreground guard and offers manual scanning.
            call.resolve(["status": self.access()])
        }
    }
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { call.reject("Settings unavailable"); return }
            UIApplication.shared.open(url) { opened in
                if opened { call.resolve() } else { call.reject("Settings unavailable") }
            }
        }
    }
    @objc func beginSnapshot(_ call: CAPPluginCall) {
        worker.async {
            guard self.permitted() else { call.reject("Photo permission changed", "PERMISSION_DENIED"); return }
            guard self.session == nil else { call.reject("A snapshot is already open"); return }
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            let assets = PHAsset.fetchAssets(with: .image, options: options)
            var ids: [String] = []; ids.reserveCapacity(assets.count)
            assets.enumerateObjects { asset, _, _ in ids.append(asset.localIdentifier) }
            self.snapshot = ids; let session = UUID().uuidString; self.session = session
            call.resolve(["sessionId": session, "total": ids.count])
        }
    }
    @objc func readPage(_ call: CAPPluginCall) {
        worker.async {
            guard self.permitted() else { call.reject("Photo permission changed", "PERMISSION_DENIED"); return }
            guard let ids = self.snapshot, self.session == call.getString("sessionId") else { call.reject("Snapshot expired"); return }
            let offset = call.getInt("offset") ?? 0, limit = call.getInt("limit") ?? 100
            guard offset >= 0, offset <= ids.count, limit > 0, limit <= 200 else { call.reject("Invalid page"); return }
            let end = min(ids.count, offset + limit)
            let assets = PHAsset.fetchAssets(withLocalIdentifiers: Array(ids[offset..<end]), options: nil)
            let formatter = ISO8601DateFormatter()
            var photos: [[String: Any]] = []
            assets.enumerateObjects { asset, _, _ in
                // No resource-data request or private file-size KVC; iCloud originals stay untouched.
                let taken = asset.creationDate ?? Date(timeIntervalSince1970: 0)
                photos.append(["assetId": asset.localIdentifier, "title": "照片 · " + String(formatter.string(from: taken).prefix(10)),
                    "takenAt": formatter.string(from: taken), "modifiedAt": formatter.string(from: asset.modificationDate ?? taken),
                    "width": max(1, asset.pixelWidth), "height": max(1, asset.pixelHeight), "bytes": 0, "bytesKnown": false])
            }
            call.resolve(["photos": photos, "nextOffset": end, "done": end == ids.count])
        }
    }
    @objc func endSnapshot(_ call: CAPPluginCall) {
        worker.async {
            if self.session == call.getString("sessionId") { self.snapshot = nil; self.session = nil }
            call.resolve()
        }
    }
    @objc func filterAccessible(_ call: CAPPluginCall) {
        worker.async {
            guard self.permitted() else { call.reject("Photo permission changed", "PERMISSION_DENIED"); return }
            let ids = call.getArray("assetIds", String.self) ?? []
            guard ids.count <= 200 else { call.reject("Too many identifiers"); return }
            let assets = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
            var accessible: [String] = []
            assets.enumerateObjects { asset, _, _ in accessible.append(asset.localIdentifier) }
            call.resolve(["assetIds": accessible])
        }
    }
    @objc func thumbnail(_ call: CAPPluginCall) {
        worker.async {
            guard self.permitted() else { call.reject("Photo permission changed", "PERMISSION_DENIED"); return }
            guard let id = call.getString("assetId"), let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
                call.resolve(["dataUrl": ""]); return
            }
            let options = PHImageRequestOptions()
            options.isNetworkAccessAllowed = false
            options.isSynchronous = true
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .fast
            PHImageManager.default().requestImage(for: asset, targetSize: CGSize(width: 256, height: 256), contentMode: .aspectFit, options: options) { image, _ in
                guard self.permitted() else { call.reject("Photo permission changed", "PERMISSION_DENIED"); return }
                let data = image?.jpegData(compressionQuality: 0.75)
                call.resolve(["dataUrl": data.map { "data:image/jpeg;base64," + $0.base64EncodedString() } ?? ""])
            }
        }
    }
    @objc func classify(_ call: CAPPluginCall) {
        worker.async {
            guard self.permitted() else { call.reject("Photo permission changed", "PERMISSION_DENIED"); return }
            guard let id = call.getString("assetId"),
                  let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
                call.reject("Local image unavailable", "LOCAL_AI_FAILED"); return
            }
            let options = PHImageRequestOptions()
            options.isNetworkAccessAllowed = false
            options.isSynchronous = true
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .fast
            var preview: UIImage?
            PHImageManager.default().requestImage(for: asset, targetSize: CGSize(width: 512, height: 512), contentMode: .aspectFit, options: options) { image, _ in preview = image }
            guard let image = preview, let data = image.jpegData(compressionQuality: 0.9) else {
                call.reject("Local preview unavailable; cloud downloads disabled", "LOCAL_AI_FAILED"); return
            }
            do {
                // Vision's system classifier executes on-device; no model or image network request.
                let request = VNClassifyImageRequest()
                let handler = VNImageRequestHandler(data: data, options: [:])
                try handler.perform([request])
                guard self.permitted(), PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject != nil else {
                    call.reject("Photo permission changed", "PERMISSION_DENIED"); return
                }
                let labels = (request.results ?? []).prefix(5).map { ["label": $0.identifier, "confidence": Double($0.confidence)] as [String: Any] }
                call.resolve(["engine": "apple-vision", "labels": labels])
            } catch { call.reject("Local classification failed", "LOCAL_AI_FAILED") }
        }
    }
    @objc func original(_ call: CAPPluginCall) {
        worker.async {
            guard self.viewerActive, self.permitted(), let id = call.getString("assetId"),
                  let lease = call.getString("leaseId"), UUID(uuidString: lease) != nil,
                  let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
                call.reject("Local original unavailable", "ORIGINAL_UNAVAILABLE"); return
            }
            guard Int64(asset.pixelWidth) * Int64(asset.pixelHeight) <= 64_000_000,
                  let resource = PHAssetResource.assetResources(for: asset).first(where: { $0.type == .photo }) else {
                call.reject("Original exceeds viewer limits or unsupported format", "ORIGINAL_FORMAT"); return
            }
            let ext = (resource.originalFilename as NSString).pathExtension.lowercased()
            guard ["jpg", "jpeg", "png", "heic", "heif", "webp", "gif", "avif"].contains(ext) else {
                call.reject("Unsupported original format", "ORIGINAL_FORMAT"); return
            }
            // Keep the visible original until its successor has completed the slide.
            guard self.originals.count < 2, self.originals[lease] == nil else {
                call.reject("Viewer original slots occupied", "ORIGINAL_BUSY"); return
            }
            var pendingURL: URL?
            do {
                try FileManager.default.createDirectory(at: self.viewerDirectory, withIntermediateDirectories: true)
                var url = self.viewerDirectory.appendingPathComponent(lease + "." + ext)
                pendingURL = url
                guard FileManager.default.createFile(atPath: url.path, contents: nil, attributes: [.protectionKey: FileProtectionType.complete]) else {
                    call.reject("Cache unavailable"); return
                }
                var values = URLResourceValues(); values.isExcludedFromBackup = true; try url.setResourceValues(values)
                let fileURL = url
                let read = OriginalRead(url: url, handle: try FileHandle(forWritingTo: url))
                self.originals[lease] = read
                let options = PHAssetResourceRequestOptions()
                options.isNetworkAccessAllowed = false
                read.request = PHAssetResourceManager.default().requestData(for: resource, options: options, dataReceivedHandler: { data in
                    self.worker.async {
                        guard self.originals[lease] === read, !read.failed else { return }
                        read.bytes += data.count
                        do {
                            guard read.bytes <= 80 * 1024 * 1024 else { throw CocoaError(.fileReadTooLarge) }
                            try read.handle.write(contentsOf: data)
                        } catch {
                            read.failed = true
                            if let request = read.request { PHAssetResourceManager.default().cancelDataRequest(request) }
                        }
                    }
                }, completionHandler: { error in
                    self.worker.async {
                        guard self.originals[lease] === read else { call.reject("Viewer closed", "VIEWER_CLOSED"); return }
                        try? read.handle.close()
                        guard error == nil, !read.failed, read.bytes > 0, self.viewerActive, self.permitted(),
                              PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject != nil else {
                            self.release(lease)
                            call.reject("Local original unavailable; cloud downloads disabled", "ORIGINAL_UNAVAILABLE"); return
                        }
                        read.request = nil
                        call.resolve(["fileUri": fileURL.absoluteString])
                    }
                })
            } catch {
                self.release(lease)
                if let url = pendingURL { try? FileManager.default.removeItem(at: url) }
                call.reject("Local original unavailable", "ORIGINAL_UNAVAILABLE")
            }
        }
    }
    @objc func releaseOriginal(_ call: CAPPluginCall) {
        worker.async { self.release(call.getString("leaseId") ?? ""); call.resolve() }
    }
}
