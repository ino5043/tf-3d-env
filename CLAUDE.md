# CLAUDE.md — tf-3d-env

## Project Overview

3D/Unity 開発向けの Claude Code 標準環境パッケージ。
tf-standard-env（共通コア）の上に、Unity/3D 固有のエージェント・ルール・スキル・コマンドを追加する。

## Prerequisites

- tf-standard-env >= 2.0.0 がインストール済みであること

## Install

```bash
# 共通コアが未インストールの場合
cd ../10_tf-standard-env && npm run install:env

# 3D パッケージをインストール（agents / commands / skills を ~/.claude/ に配置）
npm run install:env

# プロジェクトに CLAUDE.md を初期化し、ルールを <project>/.claude/rules/ に配置
npm run install:env -- --project /path/to/unity-project
```

> **ルールはプロジェクト単位で配布します**（TFSE-009）。
> `npm run install:env` だけでは領域ルールは読み込まれません。対象プロジェクトごとに `--project` を実行してください。
> 旧方式で `~/.claude/rules/` に入った領域ルールは、`npm run install:env` 実行時に自動で削除されます。

## Components

| カテゴリ | 数 | 内容 |
|---------|---|------|
| Agents | 5 | unity-architect, shader-reviewer, performance-profiler, asset-pipeline-advisor, 3d-tdd-guide |
| Rules | 9 | unity-architecture, performance-budget, shader-standards, asset-naming, memory-management, scene-management, unity-coding-style, git-lfs-rules, multiplayer-patterns |
| Skills | 6 | scene-setup, optimization-checklist, build-pipeline, shader-template, ecs-migration, addressables-setup |
| Commands | 4 | /unity-review, /perf-check, /asset-audit, /unity-tdd |

## Key Principles

1. **パフォーマンスバジェット**: プラットフォーム別 FPS / Draw Call / メモリ上限を厳守
2. **ECS vs MonoBehaviour**: 規模に応じた適切な選択
3. **アセット管理**: Addressables でのメモリ効率的なアセットロード
4. **GC 回避**: オブジェクトプーリング、構造体活用で GC Alloc 最小化

## Claude Code の支援範囲

| レベル | 対象 |
|--------|------|
| 最適 | C# スクリプト、シェーダーコード、設定ファイル |
| 可能 | テストコード、ビルドスクリプト、CI/CD |
| 限定的 | Scene/Prefab の YAML 直接編集 |
| 不可 | Unity Editor GUI 操作、3D モデリング |
