---
description: Run unity-architect and shader-reviewer agents in parallel for comprehensive Unity project review.
---

# Unity Project Review

Unity プロジェクトの包括的レビューを実行する。unity-architect エージェントと shader-reviewer エージェントを並列起動し、統合レビューレポートを生成する。

---

## 実行手順

以下の 2 つのレビューを **並列** で実行する。

### 1. アーキテクチャレビュー（unity-architect エージェント）

以下の観点でプロジェクト構造をレビューする。

| 観点 | チェック内容 |
|------|-------------|
| MonoBehaviour 設計 | 単一責任の原則、God Class の検出 |
| 依存性注入 (DI) | VContainer / Zenject の使用状況、Service Locator の排除 |
| Assembly Definition (.asmdef) | モジュール分割、循環参照の検出 |
| シーン構成 | 階層の整理、命名規約の遵守 |
| ScriptableObject 活用 | 設定データの外部化、ハードコード値の検出 |
| イベントシステム | UnityEvent / C# Event / MessageBus の適切な使い分け |
| エラーハンドリング | try-catch の適切な使用、null チェック |

### 2. シェーダーレビュー（shader-reviewer エージェント）

以下の観点でシェーダーをレビューする。

| 観点 | チェック内容 |
|------|-------------|
| SRP Batcher 互換性 | CBUFFER_START/END の正しい使用 |
| シェーダーバリアント | multi_compile / shader_feature の過剰使用 |
| モバイル最適化 | half 精度の使用、テクスチャサンプル数 |
| パフォーマンス | 不要な計算、分岐の最小化 |
| Shader Graph | ノードの複雑さ、カスタムファンクションの品質 |

---

## 統合レビューレポート

2 つのレビュー結果を統合し、以下のフォーマットで出力する。

```markdown
## Unity Project Review Report

### Summary
- Critical: N 件
- High: N 件
- Medium: N 件
- Low: N 件

### Architecture Issues
1. [CRITICAL] 問題の説明 → 修正提案
2. [HIGH] 問題の説明 → 修正提案

### Shader Issues
1. [CRITICAL] 問題の説明 → 修正提案
2. [HIGH] 問題の説明 → 修正提案

### Recommendations
- 推奨事項のリスト
```

---

## 使用例

```
/unity-review
/unity-review Assets/Scripts/
/unity-review Assets/Shaders/
```

引数なしで実行するとプロジェクト全体をレビューする。パスを指定すると対象を限定できる。
