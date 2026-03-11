# Performance Budget

プラットフォーム別パフォーマンスバジェットの定義と監視に関する必須ルール。フレームレートの安定を最優先とする。

---

## 1. プラットフォーム別バジェット表

| 項目 | PC High | PC Low | Mobile | VR |
|------|---------|--------|--------|-----|
| Target FPS | 60 / 120 | 30 / 60 | 30 / 60 | 72 / 90 |
| Frame Budget | 8.3 / 16.6 ms | 16.6 / 33.3 ms | 16.6 / 33.3 ms | 11.1 / 13.8 ms |
| Draw Calls | ~5,000 | ~2,000 | ~200 | ~500 |
| Triangles/frame | ~5M | ~1M | ~200K | ~1M |
| Texture Memory | ~4 GB | ~1 GB | ~256 MB | ~1 GB |
| Total Memory | ~8 GB | ~4 GB | ~1 GB | ~4 GB |
| SetPass Calls | ~500 | ~200 | ~50 | ~100 |

**VR は最も厳しいバジェット。** フレーム落ちは酔いに直結するため、バジェット内に余裕（20%）を確保する。

---

## 2. フレームバジェット配分

60 FPS (16.6 ms) の場合の推奨配分:

```
┌─────────────────────────────────────────────────┐
│                 16.6 ms / frame                 │
├───────────────────────┬─────────────────────────┤
│ Rendering   6.6 ms    │ ████████████ 40%        │
│ Scripts     4.2 ms    │ ████████     25%        │
│ Physics     2.5 ms    │ █████        15%        │
│ Animation   1.7 ms    │ ███          10%        │
│ UI          1.7 ms    │ ███          10%        │
└───────────────────────┴─────────────────────────┘
```

| カテゴリ | 配分 | 含まれる処理 |
|---------|------|-------------|
| Rendering | 40% | Draw Calls, GPU Processing, Post-Processing |
| Scripts | 25% | Update, FixedUpdate, LateUpdate, Coroutines |
| Physics | 15% | Rigidbody, Collider, Raycast |
| Animation | 10% | Animator, Blend Tree, IK |
| UI | 10% | Canvas Rebuild, Layout, Batching |

---

## 3. CPU バウンド vs GPU バウンド 判別フロー

```
フレームレートが目標を下回っている
│
├─ Unity Profiler を開く
│
├─ CPU 時間 > Frame Budget?
│   ├─ YES → CPU バウンド
│   │   ├─ Scripts が支配的 → ロジック最適化
│   │   ├─ Physics が支配的 → Physics Layer 見直し
│   │   ├─ Rendering が支配的 → バッチング改善
│   │   └─ Animation が支配的 → Animator 最適化
│   │
│   └─ NO → GPU バウンド
│       ├─ Overdraw が多い → 描画順序、透明度削減
│       ├─ Fragment 負荷高 → シェーダー簡略化
│       ├─ Vertex 負荷高 → メッシュ LOD 追加
│       └─ Fillrate 不足 → 解像度スケーリング
│
└─ どちらも Budget 内 → VSync / ターゲット FPS 設定を確認
```

---

## 4. バジェット超過時の対処法（優先順位付き）

### CPU 最適化（優先順位順）

| 優先度 | 対策 | 効果 | コスト |
|-------|------|------|--------|
| 1 | `Update()` の処理を間引く（フレーム分散） | 高 | 低 |
| 2 | Object Pooling でインスタンス化を削減 | 高 | 低 |
| 3 | Physics Layer Matrix で不要な衝突判定を除外 | 高 | 低 |
| 4 | Static/Dynamic Batching を有効化 | 中 | 低 |
| 5 | LOD Group を設定 | 中 | 中 |
| 6 | Occlusion Culling を設定 | 中 | 中 |
| 7 | Job System で並列化 | 高 | 高 |
| 8 | Burst Compiler でホットパスを最適化 | 高 | 高 |

### GPU 最適化（優先順位順）

| 優先度 | 対策 | 効果 | コスト |
|-------|------|------|--------|
| 1 | テクスチャ圧縮形式の最適化 | 高 | 低 |
| 2 | Mipmap の有効化 | 中 | 低 |
| 3 | 不要な Post-Processing エフェクト無効化 | 高 | 低 |
| 4 | シェーダーの half precision 化 | 中 | 中 |
| 5 | SRP Batcher 互換にする | 高 | 中 |
| 6 | Dynamic Resolution を導入 | 高 | 中 |
| 7 | GPU Instancing で同一メッシュを一括描画 | 高 | 中 |

---

## 5. プロファイリング手順

### Unity Profiler

```csharp
// コードからプロファイラーマーカーを追加
using Unity.Profiling;

public class EnemyManager : MonoBehaviour
{
    static readonly ProfilerMarker s_UpdateEnemies =
        new ProfilerMarker("EnemyManager.UpdateEnemies");

    static readonly ProfilerMarker s_PathFinding =
        new ProfilerMarker("EnemyManager.PathFinding");

    private void Update()
    {
        using (s_UpdateEnemies.Auto())
        {
            foreach (var enemy in _enemies)
            {
                using (s_PathFinding.Auto())
                {
                    enemy.UpdatePath();
                }
                enemy.Move();
            }
        }
    }
}
```

### Frame Debugger チェックポイント

1. Window > Analysis > Frame Debugger を開く
2. Draw Call 数を確認
3. バッチが壊れている箇所を特定（異なる Material, Shader Variant）
4. SetPass Calls を確認（シェーダー切り替え回数）

---

## 6. 自動バジェットチェック Editor スクリプト

```csharp
#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

[InitializeOnLoad]
public static class PerformanceBudgetChecker
{
    private const int MaxDrawCalls = 2000;
    private const int MaxTriangles = 1000000;
    private const int MaxSetPassCalls = 200;

    static PerformanceBudgetChecker()
    {
        EditorApplication.playModeStateChanged += OnPlayModeChanged;
    }

    private static void OnPlayModeChanged(PlayModeStateChange state)
    {
        if (state == PlayModeStateChange.EnteredPlayMode)
        {
            EditorApplication.update += CheckBudget;
        }
        else if (state == PlayModeStateChange.ExitingPlayMode)
        {
            EditorApplication.update -= CheckBudget;
        }
    }

    private static float _lastCheckTime;

    private static void CheckBudget()
    {
        if (Time.realtimeSinceStartup - _lastCheckTime < 5f) return;
        _lastCheckTime = Time.realtimeSinceStartup;

        var stats = UnityStats.drawCalls;
        if (stats > MaxDrawCalls)
        {
            Debug.LogWarning(
                $"[Budget] Draw Calls: {stats} (limit: {MaxDrawCalls})");
        }

        var tris = UnityStats.triangles;
        if (tris > MaxTriangles)
        {
            Debug.LogWarning(
                $"[Budget] Triangles: {tris} (limit: {MaxTriangles})");
        }
    }
}
#endif
```

---

## 7. フレーム分散パターン

大量のオブジェクトの処理を複数フレームに分散する。

```csharp
public class StaggeredUpdater : MonoBehaviour
{
    [SerializeField] private int _updatesPerFrame = 10;
    private readonly List<IUpdatable> _targets = new();
    private int _currentIndex;

    private void Update()
    {
        int count = Mathf.Min(_updatesPerFrame, _targets.Count);
        for (int i = 0; i < count; i++)
        {
            _currentIndex = (_currentIndex + 1) % _targets.Count;
            _targets[_currentIndex].OnStaggeredUpdate();
        }
    }
}
```

---

## 8. プラットフォーム別品質設定

```csharp
public static class QualityPresets
{
    public static void ApplyMobilePreset()
    {
        QualitySettings.shadows = ShadowQuality.HardOnly;
        QualitySettings.shadowResolution = ShadowResolution.Low;
        QualitySettings.shadowDistance = 30f;
        QualitySettings.antiAliasing = 0;
        QualitySettings.vSyncCount = 0;
        Application.targetFrameRate = 30;
    }

    public static void ApplyPCHighPreset()
    {
        QualitySettings.shadows = ShadowQuality.All;
        QualitySettings.shadowResolution = ShadowResolution.VeryHigh;
        QualitySettings.shadowDistance = 150f;
        QualitySettings.antiAliasing = 4;
        QualitySettings.vSyncCount = 1;
        Application.targetFrameRate = -1; // VSync に委ねる
    }

    public static void ApplyVRPreset()
    {
        QualitySettings.shadows = ShadowQuality.HardOnly;
        QualitySettings.shadowResolution = ShadowResolution.Medium;
        QualitySettings.shadowDistance = 50f;
        QualitySettings.antiAliasing = 4; // VR では MSAA 推奨
        QualitySettings.vSyncCount = 0;
        // VR SDK が FPS を管理
    }
}
```

---

## チェックリスト

### プロジェクト開始時
- [ ] ターゲットプラットフォームのバジェット表を定義したか
- [ ] Quality Settings を各プラットフォーム用に設定したか
- [ ] プロファイラーマーカーをホットパスに追加したか

### マイルストーンごと
- [ ] Unity Profiler でフレーム時間を計測したか
- [ ] Frame Debugger で Draw Calls を確認したか
- [ ] CPU バウンド / GPU バウンドを判別したか
- [ ] バジェット超過箇所に対策を実施したか
- [ ] 最低スペック端末で 30 FPS 以上を維持しているか

### リリース前
- [ ] 各プラットフォームで目標 FPS を安定して達成しているか
- [ ] メモリ使用量がプラットフォーム上限の 80% 以下か
- [ ] ロードスパイク（GC, シーンロード）を抑制したか
- [ ] VR の場合、フレーム落ちが 0.1% 以下か
