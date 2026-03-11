---
description: Run performance-profiler agent to analyze FPS, draw calls, memory, and GC allocations against platform budgets.
---

# Performance Check

performance-profiler エージェントを起動し、Unity プロジェクトのパフォーマンスをプラットフォーム別バジェットと比較分析する。

---

## 実行手順

### 1. ターゲットプラットフォームの確認

ユーザーにターゲットプラットフォームを確認する。未指定の場合は Build Settings の現在のプラットフォームを使用する。

### 2. プラットフォーム別バジェット

| 指標 | Mobile | PC | Console |
|------|--------|----|---------|
| Target FPS | 30 / 60 | 60 / 120 | 30 / 60 |
| Draw Calls | < 100 | < 500 | < 300 |
| Triangles/Frame | < 100K | < 1M | < 500K |
| Memory (Runtime) | < 512MB | < 2GB | < 1.5GB |
| Texture Memory | < 200MB | < 1GB | < 512MB |
| GC Alloc/Frame | < 1KB | < 10KB | < 5KB |
| Build Size | < 200MB | < 2GB | < 5GB |

### 3. 分析項目

performance-profiler エージェントが以下を分析する。

| 分析項目 | 方法 | ツール |
|---------|------|--------|
| Draw Call 数 | シーン内のレンダラー数とバッチング効率 | Frame Debugger |
| メモリ使用量 | テクスチャ、メッシュ、オーディオのメモリ | Memory Profiler |
| GC Allocation | Update() 内のアロケーション検出 | CPU Profiler |
| シェーダー負荷 | バリアント数、命令数 | Frame Debugger |
| 物理演算負荷 | コライダー数、Fixed Timestep | Physics Debugger |
| アセットサイズ | 非圧縮テクスチャ、過大メッシュの検出 | Build Report |

### 4. ボトルネック特定

```
パフォーマンス分析フロー:
  FPS が低い
  ├→ CPU bound?
  │   ├→ Scripts (GC Alloc, Update 負荷)
  │   ├→ Physics (コライダー過多, Timestep)
  │   └→ Rendering (Batching 非効率)
  └→ GPU bound?
      ├→ Overdraw (半透明オブジェクト過多)
      ├→ Fill Rate (高解像度テクスチャ)
      └→ Shader Complexity (命令数過多)
```

### 5. 最適化提案の出力

バジェット超過項目に対して、具体的な最適化提案を出力する。

```markdown
## Performance Report

### Platform: Mobile (Android)

| 指標 | 現在値 | バジェット | 状態 |
|------|--------|-----------|------|
| Draw Calls | 150 | < 100 | OVER |
| Triangles | 80K | < 100K | OK |
| Memory | 600MB | < 512MB | OVER |
| GC Alloc | 5KB/frame | < 1KB | OVER |

### Optimization Recommendations
1. [CRITICAL] Draw Call 削減: GPU Instancing を草・木に適用
2. [HIGH] メモリ削減: テクスチャ Max Size を 2048 → 1024 に変更
3. [HIGH] GC 削減: Update() 内の string 結合を StringBuilder に変更
```

---

## Profiler データの読み方ガイド

| Profiler モジュール | 注目ポイント | 警告基準 |
|--------------------|-------------|---------|
| CPU Usage | PlayerLoop 直下の処理時間 | > 16.6ms (60FPS) |
| GPU Usage | Fragment Shader 時間 | > 8ms |
| Memory | Total Used Memory | バジェット超過 |
| GC Alloc | フレームごとのアロケーション | > 0B が毎フレーム |
| Physics | FixedUpdate 処理時間 | > 5ms |

---

## 使用例

```
/perf-check
/perf-check mobile
/perf-check pc
```
