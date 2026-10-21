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
        CAPPluginMethod(name: "classify", returnType: CAPPluginReturnPromise)
    ]
    private let worker = DispatchQueue(label: "app.nobi.photos.library")
    private var snapshot: [String]?
    private var session: String?
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
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in call.resolve(["status": self.access()]) }
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
}
