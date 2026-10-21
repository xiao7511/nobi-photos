import XCTest

@MainActor
final class NobiUITests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "app.nobi.photos")
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 45))
    }
    override func tearDownWithError() throws {
        if testRun?.hasSucceeded == false {
            print("NOBI_TEST_FAILURE_HIERARCHY\n" + app.debugDescription)
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
        let scan = app.webViews.buttons["立即扫描"].firstMatch
        if scan.waitForExistence(timeout: 10) {
            scan.tap()
        } else {
            // XCTest may reinstall the target after simctl's grant; use the real consent flow.
            let connect = app.webViews.buttons["连接并读取照片"].firstMatch
            XCTAssertTrue(connect.waitForExistence(timeout: 20))
            connect.tap()
            let consent = app.webViews.buttons["继续系统授权"].firstMatch
            XCTAssertTrue(consent.waitForExistence(timeout: 20))
            consent.tap()
            let system = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            let fullAccess = system.buttons.matching(NSPredicate(format: "label MATCHES[c] %@", ".*(Allow Full Access|允许完全访问|允许访问所有照片|允许所有照片|允许全部照片).*" )).firstMatch
            if fullAccess.waitForExistence(timeout: 15) { fullAccess.tap() }
        }
        XCTAssertTrue(text("101 张本机照片").waitForExistence(timeout: 120))
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
        XCTAssertTrue(text("101 张本机照片").waitForExistence(timeout: 45))
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
