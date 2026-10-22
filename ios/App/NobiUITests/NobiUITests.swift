import XCTest

@MainActor
final class NobiUITests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "app.nobi.photos")
        addUIInterruptionMonitor(withDescription: "Full access to isolated synthetic photo library") { alert in
            let allow = alert.buttons.matching(NSPredicate(format: "label MATCHES[c] %@", ".*(Allow Full Access|Allow Access to All Photos|Allow All Photos|允许完全访问|允许访问所有照片|允许所有照片|允许全部照片).*" )).firstMatch
            if allow.exists { allow.tap(); return true }
            print("NOBI_UNHANDLED_SYSTEM_ALERT\n" + alert.debugDescription)
            return false
        }
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 45))
        app.activate()
        XCTAssertEqual(app.state, .runningForeground)
    }
    override func tearDownWithError() throws {
        if (testRun?.failureCount ?? 0) > 0 {
            print("NOBI_TEST_FAILURE_HIERARCHY\n" + app.debugDescription)
            print("NOBI_SYSTEM_FAILURE_HIERARCHY\n" + XCUIApplication(bundleIdentifier: "com.apple.springboard").debugDescription)
            let shot = XCTAttachment(screenshot: app.screenshot())
            shot.name = "ios-failure-synthetic-library"
            shot.lifetime = .keepAlways
            add(shot)
        }
    }
    private func text(_ value: String) -> XCUIElement {
        app.webViews.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", value)).firstMatch
    }
    func testNativeLibraryAndOnDeviceAI() throws {
        let count = app.webViews.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "[1-9][0-9]{2,} 张本机照片")).firstMatch
        let scan = app.webViews.buttons["立即扫描"].firstMatch
        if scan.waitForExistence(timeout: 10) {
            scan.tap()
        } else {
            // XCTest may reinstall the target after simctl's grant; use the real consent flow.
            let connect = app.webViews.buttons["连接并读取照片"].firstMatch
            XCTAssertTrue(connect.waitForExistence(timeout: 20))
            let consent = app.webViews.buttons["继续系统授权"].firstMatch
            for _ in 0..<3 {
                XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true AND hittable == true"), object: connect)], timeout: 30) == .completed)
                connect.tap()
                if consent.waitForExistence(timeout: 10) { break }
            }
            XCTAssertTrue(consent.exists)
            consent.tap()
            // A normal, harmless navigation action lets XCTest's interruption monitor
            // handle the system sheet, even when the hosted simulator exposes it late.
            let granted = text("已授权照片读取")
            for _ in 0..<6 {
                app.webViews.links["照片"].firstMatch.tap()
                if granted.waitForExistence(timeout: 5) || count.exists { break }
            }
        }
        // The hosted simulator can include Apple's six stock images in addition to our 101 fixtures.
        // Require enough real assets to cross the 100-item page boundary, then retain the exact total.
        XCTAssertTrue(count.waitForExistence(timeout: 120))
        let indexedLabel = count.label
        let indexedCount = Int(indexedLabel.split(separator: " ").first.map(String.init) ?? "0") ?? 0
        XCTAssertGreaterThanOrEqual(indexedCount, 101)
        print("NOBI_INDEXED_PHOTOS \(indexedCount); generated fixtures: 101; remaining assets: hosted simulator stock images")
        app.webViews.links["分类"].firstMatch.tap()
        let start = app.webViews.buttons["开始智能整理"].firstMatch
        XCTAssertTrue(start.waitForExistence(timeout: 20))
        start.tap()
        XCTAssertTrue(text("本地 AI 分析完成").waitForExistence(timeout: 240))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "ios-synthetic-local-ai"
        shot.lifetime = .keepAlways
        add(shot)
        app.terminate()
        app.launch()
        XCTAssertTrue(text(indexedLabel).waitForExistence(timeout: 45))
    }
    func testTabsThemePrivacyAndKeyboard() throws {
        for tab in ["照片", "分类", "AI 搜索", "清理", "我的"] {
            let link = app.webViews.links[tab].firstMatch
            XCTAssertTrue(link.waitForExistence(timeout: 20))
            XCTAssertTrue(link.isHittable, "Safe-area navigation must be tappable: \(tab)")
            link.tap()
        }
        // WebKit exposes HTML aria-pressed buttons as accessibility switches.
        let dark = app.webViews.switches["深色"].firstMatch
        XCTAssertTrue(dark.waitForExistence(timeout: 30))
        dark.tap()
        XCTAssertTrue(NSPredicate(format: "value == '1'").evaluate(with: dark))
        let light = app.webViews.switches["浅色"].firstMatch
        XCTAssertTrue(light.waitForExistence(timeout: 20))
        light.tap()
        XCTAssertTrue(NSPredicate(format: "value == '1'").evaluate(with: light))
        app.webViews.links["隐私与安全中心"].firstMatch.tap()
        let back = app.webViews.buttons["返回我的"].firstMatch
        XCTAssertTrue(back.waitForExistence(timeout: 20))
        back.tap()
        app.webViews.links["AI 搜索"].firstMatch.tap()
        let input = app.webViews.textFields["搜索照片"].firstMatch
        XCTAssertTrue(input.waitForExistence(timeout: 20))
        input.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 15))
    }
}
