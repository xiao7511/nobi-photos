import xcode from 'xcode'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import console from 'node:console'

// Add an explicit shared iOS UI-test scheme once, using Capacitor's xcode dependency.
const path = 'ios/App/App.xcodeproj/project.pbxproj'
const project = xcode.project(path)
project.parseSync()
const objects = project.hash.project.objects
const app = project.getFirstTarget()
let target = Object.entries(objects.PBXNativeTarget).find(
  ([, t]) => typeof t === 'object' && String(t.name).replaceAll('"', '') === 'NobiUITests',
)
if (!target) {
  const added = project.addTarget(
    'NobiUITests',
    'unit_test_bundle',
    'NobiUITests',
    'app.nobi.photos.uitests',
  )
  added.pbxNativeTarget.productType = '"com.apple.product-type.bundle.ui-testing"'
  // UI tests depend on the app, not the reverse (the library helper defaults the other way).
  app.firstTarget.dependencies = app.firstTarget.dependencies.filter((ref) => {
    const dependency = objects.PBXTargetDependency[ref.value]
    return dependency?.target !== added.uuid
  })
  project.addTargetDependency(added.uuid, [app.uuid])
  project.addBuildPhase(
    ['NobiUITests/NobiUITests.swift'],
    'PBXSourcesBuildPhase',
    'Sources',
    added.uuid,
  )
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', added.uuid)
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', added.uuid)
  const list = objects.XCConfigurationList[added.pbxNativeTarget.buildConfigurationList]
  for (const ref of list.buildConfigurations) {
    const settings = objects.XCBuildConfiguration[ref.value].buildSettings
    delete settings.INFOPLIST_FILE
    Object.assign(settings, {
      GENERATE_INFOPLIST_FILE: 'YES',
      TEST_TARGET_NAME: 'App',
      SWIFT_VERSION: '5.0',
      IPHONEOS_DEPLOYMENT_TARGET: '15.0',
      TARGETED_DEVICE_FAMILY: '"1,2"',
      CODE_SIGN_STYLE: 'Automatic',
      CLANG_ENABLE_MODULES: 'YES',
    })
  }
  project.addTargetAttribute('TestTargetID', app.uuid, added)
  target = [added.uuid, added.pbxNativeTarget]
}
assert.ok(target)
const product = objects.PBXFileReference[target[1].productReference]
product.path = product.name = '"NobiUITests.xctest"'
for (const file of Object.values(objects.PBXFileReference)) {
  if (typeof file === 'object' && String(file.path).includes('NobiUITests/NobiUITests.swift'))
    file.sourceTree = 'SOURCE_ROOT'
}
function clean(value) {
  if (!value || typeof value !== 'object') return
  for (const key of Object.keys(value)) {
    if (value[key] === undefined || value[key] === 'undefined') delete value[key]
    else clean(value[key])
  }
}
clean(project.hash)
writeFileSync(path, project.writeSync().replaceAll('NobiUITests.mdimporter', 'NobiUITests.xctest'))
const reference = (id, name, product) =>
  `<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${id}" BuildableName="${product}" BlueprintName="${name}" ReferencedContainer="container:App.xcodeproj"/>`
const appRef = reference(app.uuid, 'App', 'App.app')
const testRef = reference(target[0], 'NobiUITests', 'NobiUITests.xctest')
mkdirSync('ios/App/App.xcodeproj/xcshareddata/xcschemes', { recursive: true })
writeFileSync(
  'ios/App/App.xcodeproj/xcshareddata/xcschemes/Nobi.xcscheme',
  `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>
    <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">${appRef}</BuildActionEntry>
    <BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">${testRef}</BuildActionEntry>
  </BuildActionEntries></BuildAction>
  <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">${testRef}</TestableReference></Testables></TestAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">${appRef}</BuildableProductRunnable></LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">${appRef}</BuildableProductRunnable></ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
`,
)
assert.match(readFileSync(path, 'utf8'), /com.apple.product-type.bundle.ui-testing/)
console.log('Shared Nobi scheme and native iOS UI-test target configured')
