---
name: build-pipeline
description: Configure multi-platform Unity build settings for Android, iOS, PC, and WebGL with CI/CD integration.
---

# マルチプラットフォームビルドパイプライン

Android、iOS、PC、WebGL 向けのビルド設定と CI/CD 統合。Unity Cloud Build および GitHub Actions (GameCI) のテンプレートを含む。

---

## プラットフォーム別ビルド設定

### Android

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Minimum API Level | 24 (Android 7.0) | Google Play 要件に準拠 |
| Target API Level | 34 | 最新安定版 |
| Target Architectures | ARM64 | ARMv7 は非推奨 |
| Scripting Backend | IL2CPP | Mono は ARM64 非対応 |
| API Compatibility Level | .NET Standard 2.1 | |
| Keystore | 専用 keystore ファイル | リリース署名用 |
| Build App Bundle | true | Google Play 提出用 (.aab) |
| Split Application Binary | true | 150MB 超のアプリ |

### iOS

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Target minimum iOS Version | 15.0 | サポート範囲に応じて調整 |
| Scripting Backend | IL2CPP | iOS 必須 |
| Architecture | ARM64 | |
| Signing Team ID | Apple Developer アカウント | Xcode で設定 |
| Automatic Signing | true (開発) / false (リリース) | |
| Camera Usage Description | 必要時のみ記載 | 空欄だとリジェクト |
| Location Usage Description | 必要時のみ記載 | |

### PC (Windows / macOS / Linux)

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Architecture | x86_64 | |
| Scripting Backend | Mono or IL2CPP | IL2CPP 推奨（パフォーマンス） |
| Default Screen Width | 1920 | |
| Default Screen Height | 1080 | |
| Fullscreen Mode | Fullscreen Window | |
| Resizable Window | true | |
| Quality Settings | Ultra (PC), Medium (モバイル) | |

### WebGL

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Compression Format | Brotli | サーバー対応確認 |
| Memory Size | 256MB | コンテンツに応じて調整 |
| Linker Target | Default | |
| Data Caching | true | 再訪問時のロード高速化 |
| Decompression Fallback | true | 非対応サーバー向け |
| Template | Default / PWA | |
| Exception Support | Explicitly Thrown Exceptions Only | ビルドサイズ削減 |

---

## ビルドスクリプト

### Editor/BuildScript.cs

```csharp
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
using System;
using System.Linq;

public static class BuildScript
{
    private static readonly string[] Scenes = GetEnabledScenes();

    [MenuItem("Build/Android - Development")]
    public static void BuildAndroidDev()
    {
        Build(BuildTarget.Android,
              BuildOptions.Development | BuildOptions.ConnectWithProfiler,
              "Builds/Android/game-dev.apk");
    }

    [MenuItem("Build/Android - Release")]
    public static void BuildAndroidRelease()
    {
        SetAndroidKeystore();
        Build(BuildTarget.Android, BuildOptions.None,
              "Builds/Android/game-release.aab");
    }

    [MenuItem("Build/iOS")]
    public static void BuildIOS()
    {
        Build(BuildTarget.iOS, BuildOptions.None, "Builds/iOS");
    }

    [MenuItem("Build/Windows")]
    public static void BuildWindows()
    {
        Build(BuildTarget.StandaloneWindows64, BuildOptions.None,
              "Builds/Windows/game.exe");
    }

    [MenuItem("Build/WebGL")]
    public static void BuildWebGL()
    {
        Build(BuildTarget.WebGL, BuildOptions.None, "Builds/WebGL");
    }

    private static void Build(BuildTarget target, BuildOptions options,
                              string path)
    {
        var buildPlayerOptions = new BuildPlayerOptions
        {
            scenes = Scenes,
            locationPathName = path,
            target = target,
            options = options
        };

        BuildReport report = BuildPipeline.BuildPlayer(buildPlayerOptions);
        BuildSummary summary = report.summary;

        if (summary.result == BuildResult.Succeeded)
        {
            Debug.Log($"Build succeeded: {summary.totalSize / (1024 * 1024)}MB");
        }
        else
        {
            Debug.LogError($"Build failed: {summary.result}");
            throw new Exception($"Build failed: {summary.result}");
        }
    }

    private static string[] GetEnabledScenes()
    {
        return EditorBuildSettings.scenes
            .Where(s => s.enabled)
            .Select(s => s.path)
            .ToArray();
    }

    private static void SetAndroidKeystore()
    {
        PlayerSettings.Android.keystoreName =
            Environment.GetEnvironmentVariable("KEYSTORE_PATH") ?? "keystore.jks";
        PlayerSettings.Android.keystorePass =
            Environment.GetEnvironmentVariable("KEYSTORE_PASS") ?? "";
        PlayerSettings.Android.keyaliasName =
            Environment.GetEnvironmentVariable("KEY_ALIAS") ?? "";
        PlayerSettings.Android.keyaliasPass =
            Environment.GetEnvironmentVariable("KEY_PASS") ?? "";
    }
}
```

---

## GitHub Actions (GameCI) テンプレート

### .github/workflows/unity-build.yml

```yaml
name: Unity Build

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true

      - uses: game-ci/unity-test-runner@v4
        with:
          projectPath: .
          testMode: all
          artifactsPath: test-results
          githubToken: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results/
          retention-days: 30

  build:
    name: Build for ${{ matrix.targetPlatform }}
    needs: test
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        targetPlatform:
          - Android
          - StandaloneWindows64
          - WebGL
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true

      - uses: game-ci/unity-builder@v4
        with:
          projectPath: .
          targetPlatform: ${{ matrix.targetPlatform }}

      - uses: actions/upload-artifact@v4
        with:
          name: build-${{ matrix.targetPlatform }}
          path: build/${{ matrix.targetPlatform }}
          retention-days: 14
```

---

## ビルド前チェックリスト

### 共通

- [ ] シーンが Build Settings に正しく登録されているか
- [ ] Player Settings の Company Name / Product Name が正しいか
- [ ] バージョン番号を更新したか（Application.version）
- [ ] Scripting Define Symbols が適切か（DEBUG, RELEASE 等）
- [ ] 不要な `Debug.Log` をビルドから除外する設定か
- [ ] Console にエラー / 警告が残っていないか

### Android 固有

- [ ] Keystore が設定されているか
- [ ] Minimum API Level が適切か
- [ ] Internet Access が "Require" になっているか（ネットワーク使用時）
- [ ] Proguard / R8 の難読化設定を確認したか

### iOS 固有

- [ ] Signing Certificate が有効か
- [ ] Provisioning Profile が正しいか
- [ ] Info.plist の Usage Description が記載されているか
- [ ] App Transport Security の設定を確認したか

### WebGL 固有

- [ ] サーバーの MIME Type 設定を確認したか（.unityweb, .data, .wasm）
- [ ] Compression Format に対応するサーバー設定があるか
- [ ] Memory Size が十分か（256MB 以上推奨）

---

## 注意事項

- GameCI の利用には Unity License の Secrets 登録が必要
- IL2CPP ビルドは Mono より時間がかかる（CI のタイムアウトに注意）
- Android の AAB ビルドは実機テスト用に APK も別途用意する
- WebGL は multithreading 非対応のため、Job System の使用に注意
