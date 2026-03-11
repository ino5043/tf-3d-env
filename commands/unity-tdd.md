---
description: Start Unity test-driven development workflow with EditMode and PlayMode test support.
---

# Unity TDD Workflow

3d-tdd-guide エージェントを起動し、Unity プロジェクトのテスト駆動開発ワークフローを実行する。EditMode Test → PlayMode Test の順序で進める。

---

## 実行手順

### 1. 3d-tdd-guide エージェント起動

テスト対象の機能を指定して TDD ワークフローを開始する。

### 2. テストの種類と順序

| 順序 | テスト種別 | 対象 | 実行環境 |
|:----:|-----------|------|---------|
| 1 | EditMode Test | ピュアロジック、データ変換、ユーティリティ | エディタ上（Play 不要） |
| 2 | PlayMode Test | MonoBehaviour、コルーチン、物理演算、UI | Play モード |

### 3. TDD サイクル

```
RED → GREEN → REFACTOR の繰り返し

1. RED:    テストを書く → 失敗することを確認
2. GREEN:  最小限の実装でテストを通す
3. REFACTOR: コードを整理する → テストが通ることを確認
```

---

## テストファイル構成

### ディレクトリ構造

```
Assets/
├── Scripts/
│   └── Player/
│       ├── PlayerHealth.cs
│       └── PlayerMovement.cs
└── Tests/
    ├── EditMode/
    │   ├── Tests.EditMode.asmdef
    │   └── Player/
    │       ├── PlayerHealthTests.cs
    │       └── PlayerMovementTests.cs
    └── PlayMode/
        ├── Tests.PlayMode.asmdef
        └── Player/
            └── PlayerMovementPlayTests.cs
```

### テストファイル命名規則

| 規則 | 例 |
|------|-----|
| クラス名 | `<対象クラス>Tests` → `PlayerHealthTests` |
| メソッド名 | `<メソッド>_<条件>_<期待結果>` → `TakeDamage_WhenHealthIsZero_ShouldTriggerDeath` |

---

## Assembly Definition 設定

### Tests.EditMode.asmdef

```json
{
    "name": "Tests.EditMode",
    "rootNamespace": "",
    "references": [
        "GUID:<プロダクションコードの asmdef GUID>"
    ],
    "includePlatforms": [
        "Editor"
    ],
    "excludePlatforms": [],
    "allowUnsafeCode": false,
    "overrideReferences": true,
    "precompiledReferences": [
        "nunit.framework.dll"
    ],
    "defineConstraints": [
        "UNITY_INCLUDE_TESTS"
    ]
}
```

### Tests.PlayMode.asmdef

```json
{
    "name": "Tests.PlayMode",
    "rootNamespace": "",
    "references": [
        "GUID:<プロダクションコードの asmdef GUID>"
    ],
    "includePlatforms": [],
    "excludePlatforms": [],
    "allowUnsafeCode": false,
    "overrideReferences": true,
    "precompiledReferences": [
        "nunit.framework.dll"
    ],
    "defineConstraints": [
        "UNITY_INCLUDE_TESTS"
    ]
}
```

---

## テスト実行

### Unity Test Runner CLI

```bash
# EditMode テストの実行
Unity -runTests -batchmode -projectPath . \
  -testPlatform EditMode \
  -testResults test-results/editmode-results.xml

# PlayMode テストの実行
Unity -runTests -batchmode -projectPath . \
  -testPlatform PlayMode \
  -testResults test-results/playmode-results.xml

# 特定のテストクラスのみ実行
Unity -runTests -batchmode -projectPath . \
  -testPlatform EditMode \
  -testFilter "PlayerHealthTests" \
  -testResults test-results/junit.xml
```

### Unity Editor 上での実行

1. Window → General → Test Runner を開く
2. EditMode / PlayMode タブを切り替え
3. Run All または個別テストを実行

---

## 使用例

```
/unity-tdd PlayerHealth
/unity-tdd InventorySystem
/unity-tdd "プレイヤーのダメージ計算"
```

対象の機能名またはクラス名を指定して TDD ワークフローを開始する。
