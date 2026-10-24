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
    private func control(_ label: String) -> XCUIElement {
        // Hosted WebKit can change an HTML control's AX type during a loading refresh.
        // Keep the exact label and real enabled/hittable checks, independent of Button/Switch caching.
        app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }
    func testNativeLibraryAndOnDeviceAI() throws {
        let count = app.webViews.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "[1-9][0-9]{2,} 张本机照片")).firstMatch
        let scan = control("立即扫描")
        if scan.waitForExistence(timeout: 10) {
            scan.tap()
        } else {
            // XCTest may reinstall the target after simctl's grant; use the real consent flow.
            let connect = control("连接并读取照片")
            XCTAssertTrue(connect.waitForExistence(timeout: 20))
            let consent = control("继续系统授权")
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
        let openPhoto = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "查看照片 ·")).firstMatch
        XCTAssertTrue(openPhoto.waitForExistence(timeout: 20))
        openPhoto.tap()
        XCTAssertTrue(app.webViews.staticTexts["原图"].firstMatch.waitForExistence(timeout: 30))
        let zoom = app.webViews.buttons["放大照片"].firstMatch
        XCTAssertTrue(zoom.isEnabled)
        zoom.tap()
        let fit = app.webViews.buttons["适应屏幕"].firstMatch
        XCTAssertTrue(fit.waitForExistence(timeout: 10))
        fit.tap()
        app.webViews.buttons["下一张照片"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts["原图"].firstMatch.waitForExistence(timeout: 30))
        let originalShot = XCTAttachment(screenshot: app.screenshot())
        originalShot.name = "ios-local-original-viewer"
        originalShot.lifetime = .keepAlways
        add(originalShot)
        app.webViews.buttons["关闭照片详情"].firstMatch.tap()
        app.webViews.links["分类"].firstMatch.tap()
        let start = app.webViews.buttons["开始智能整理"].firstMatch
        XCTAssertTrue(start.waitForExistence(timeout: 20))
        start.tap()
        XCTAssertTrue(text("本地 AI 分析完成").waitForExistence(timeout: 240))
        let category = app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "未分类", "张照片")).firstMatch
        XCTAssertTrue(category.waitForExistence(timeout: 20))
        for _ in 0..<6 { if category.isHittable { break }; app.swipeUp() }
        category.tap()
        XCTAssertTrue(app.webViews.buttons["返回相册列表"].firstMatch.waitForExistence(timeout: 15))
        app.webViews.buttons["选择背景音乐"].firstMatch.tap()
        XCTAssertTrue(text("在线曲目列表").waitForExistence(timeout: 10))
        app.webViews.switches["选用 Long Stroll"].firstMatch.tap()
        app.webViews.buttons["完成选择"].firstMatch.tap()
        app.webViews.buttons["播放相册"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts["原图"].firstMatch.waitForExistence(timeout: 30))
        let counter = app.webViews.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "[0-9]+ / [0-9]+")).firstMatch
        XCTAssertTrue(counter.waitForExistence(timeout: 10))
        let firstCounter = counter.label
        let music = app.webViews.switches["开启分类配乐"].firstMatch
        XCTAssertTrue(music.waitForExistence(timeout: 10))
        music.tap()
        XCTAssertTrue(text("Long Stroll").waitForExistence(timeout: 15))
        XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "label != %@", firstCounter), object: counter)], timeout: 20) == .completed)
        XCTAssertTrue(app.webViews.switches["关闭背景音乐"].firstMatch.exists)
        app.webViews.switches["暂停轮播"].firstMatch.tap()
        app.webViews.buttons["关闭照片详情"].firstMatch.tap()
        app.webViews.buttons["返回相册列表"].firstMatch.tap()
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "ios-synthetic-local-ai"
        shot.lifetime = .keepAlways
        add(shot)
        app.terminate()
        app.launch()
        XCTAssertTrue(text(indexedLabel).waitForExistence(timeout: 45))
    }
    func testOptionalAccountAndGuestCreationBoundary() throws {
        app.webViews.links["我的"].firstMatch.tap()
        let account = app.webViews.links.containing(NSPredicate(format: "label CONTAINS %@", "注册 / 登录")).firstMatch
        XCTAssertTrue(account.waitForExistence(timeout: 20))
        account.tap()
        XCTAssertTrue(text("账号服务尚未配置").waitForExistence(timeout: 20))
        let loginButtons = app.webViews.buttons.matching(NSPredicate(format: "label == %@", "登录")).allElementsBoundByIndex
        XCTAssertTrue(loginButtons.contains(where: { !$0.isEnabled }))
        app.webViews.links.containing(NSPredicate(format: "label CONTAINS %@", "返回我的空间")).firstMatch.tap()
        let studio = app.webViews.links.containing(NSPredicate(format: "label CONTAINS %@", "图片创作室")).firstMatch
        XCTAssertTrue(studio.waitForExistence(timeout: 20))
        studio.tap()
        XCTAssertTrue(text("注册用户专属创作").waitForExistence(timeout: 20))
        XCTAssertFalse(app.webViews.buttons["生成成品预览"].exists)
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "ios-optional-account-guest-studio"
        shot.lifetime = .keepAlways
        add(shot)
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
