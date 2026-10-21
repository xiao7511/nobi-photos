// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "NobiPhotoLibrary",
    platforms: [.iOS(.v15)],
    products: [.library(name: "NobiPhotoLibrary", targets: ["NobiPhotoLibrary"])],
    dependencies: [.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")],
    targets: [.target(name: "NobiPhotoLibrary", dependencies: [
        .product(name: "Capacitor", package: "capacitor-swift-pm"),
        .product(name: "Cordova", package: "capacitor-swift-pm")
    ], path: "ios/Sources/NobiPhotoLibrary", linkerSettings: [.linkedFramework("Photos"), .linkedFramework("Vision")])]
)
