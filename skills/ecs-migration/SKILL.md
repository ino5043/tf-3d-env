---
name: ecs-migration
description: Guide for migrating from MonoBehaviour to Unity DOTS/ECS with step-by-step conversion patterns and performance comparison.
---

# MonoBehaviour → DOTS/ECS 移行ガイド

MonoBehaviour ベースの設計から Unity DOTS (Data-Oriented Technology Stack) / ECS (Entity Component System) への段階的移行ガイド。移行判断基準、変換パターン、パフォーマンス比較を含む。

---

## 移行判断基準

### 移行すべきケース

| ケース | 理由 |
|--------|------|
| 同種オブジェクトが 1000 個以上 | ECS のバッチ処理が効く |
| 毎フレーム大量の演算 | Burst Compiler で高速化 |
| シミュレーション系（群衆、弾幕） | データ指向で圧倒的な性能差 |
| マルチスレッド処理が必要 | Job System との統合が容易 |
| メモリレイアウトの最適化が必要 | キャッシュ効率の改善 |

### 移行すべきでないケース

| ケース | 理由 |
|--------|------|
| オブジェクト数が少ない（< 100） | 移行コストに見合わない |
| UI ロジック | MonoBehaviour + UGUI で十分 |
| プロトタイプ段階 | 開発速度を優先 |
| チームが DOTS 未経験 | 学習コストが高い |
| エディタ拡張が必要 | MonoBehaviour のほうが扱いやすい |

---

## 段階的移行パターン

### Phase 1: データのみ ECS 化（IComponentData）

MonoBehaviour のデータ部分を IComponentData に移行する。ロジックは MonoBehaviour に残す。

```csharp
// --- BEFORE: MonoBehaviour ---
public class EnemyMono : MonoBehaviour
{
    public float health;
    public float speed;
    public float attackRange;
    public Vector3 targetPosition;
}

// --- AFTER: IComponentData ---
public struct EnemyData : IComponentData
{
    public float Health;
    public float Speed;
    public float AttackRange;
    public float3 TargetPosition;
}

// Baker で変換
public class EnemyAuthoring : MonoBehaviour
{
    public float Health;
    public float Speed;
    public float AttackRange;
}

public class EnemyBaker : Baker<EnemyAuthoring>
{
    public override void Bake(EnemyAuthoring authoring)
    {
        var entity = GetEntity(TransformUsageFlags.Dynamic);
        AddComponent(entity, new EnemyData
        {
            Health = authoring.Health,
            Speed = authoring.Speed,
            AttackRange = authoring.AttackRange,
            TargetPosition = float3.zero
        });
    }
}
```

### Phase 2: システムの移行（ISystem）

Update ロジックを ISystem に移行する。

```csharp
// --- BEFORE: MonoBehaviour.Update() ---
public class EnemyMovement : MonoBehaviour
{
    public float speed = 5f;
    private Transform _target;

    void Update()
    {
        if (_target == null) return;
        Vector3 direction =
            (_target.position - transform.position).normalized;
        transform.position += direction * speed * Time.deltaTime;
    }
}

// --- AFTER: ISystem ---
[BurstCompile]
public partial struct EnemyMovementSystem : ISystem
{
    [BurstCompile]
    public void OnUpdate(ref SystemState state)
    {
        float deltaTime = SystemAPI.Time.DeltaTime;

        foreach (var (transform, enemy)
            in SystemAPI.Query<RefRW<LocalTransform>, RefRO<EnemyData>>())
        {
            float3 direction = math.normalizesafe(
                enemy.ValueRO.TargetPosition - transform.ValueRO.Position);
            transform.ValueRW.Position +=
                direction * enemy.ValueRO.Speed * deltaTime;
        }
    }
}
```

### Phase 3: Job System 統合

大量エンティティの処理を IJobEntity でマルチスレッド化する。

```csharp
[BurstCompile]
public partial struct EnemyMovementJob : IJobEntity
{
    public float DeltaTime;

    void Execute(ref LocalTransform transform, in EnemyData enemy)
    {
        float3 direction = math.normalizesafe(
            enemy.TargetPosition - transform.Position);
        transform.Position += direction * enemy.Speed * DeltaTime;
    }
}

[BurstCompile]
public partial struct EnemyMovementSystem : ISystem
{
    [BurstCompile]
    public void OnUpdate(ref SystemState state)
    {
        var job = new EnemyMovementJob
        {
            DeltaTime = SystemAPI.Time.DeltaTime
        };
        job.ScheduleParallel();
    }
}
```

### Phase 4: Burst Compiler 最適化

`[BurstCompile]` アトリビュートを追加し、SIMD 命令や最適化を有効化する。

```csharp
[BurstCompile(FloatPrecision.Low, FloatMode.Fast)]
public partial struct HeavyCalculationSystem : ISystem
{
    [BurstCompile]
    public void OnUpdate(ref SystemState state)
    {
        foreach (var (transform, data)
            in SystemAPI.Query<RefRW<LocalTransform>, RefRO<SimulationData>>())
        {
            float3 result = math.sin(data.ValueRO.Phase)
                * data.ValueRO.Amplitude;
            transform.ValueRW.Position = result;
        }
    }
}
```

---

## MonoBehaviour と ECS の対応表

| MonoBehaviour | ECS | 備考 |
|---------------|-----|------|
| `class : MonoBehaviour` | `struct : IComponentData` | データはコンポーネント |
| フィールド変数 | IComponentData のフィールド | 値型のみ（struct） |
| `Update()` | `ISystem.OnUpdate()` | |
| `Start()` | `ISystem.OnCreate()` | |
| `OnDestroy()` | `ISystem.OnDestroy()` | |
| `Instantiate()` | `EntityManager.Instantiate()` | |
| `Destroy()` | `EntityManager.DestroyEntity()` | |
| `GetComponent<T>()` | `SystemAPI.GetComponent<T>()` | |
| `FindObjectOfType<T>()` | `SystemAPI.Query<T>()` | |
| `transform.position` | `LocalTransform.Position` | |
| `Vector3` | `float3` | Unity.Mathematics |
| `Quaternion` | `quaternion` | Unity.Mathematics |
| `Mathf` | `math` | Unity.Mathematics |
| Tag / Layer | `ISharedComponentData` | フィルタリング用 |
| `[SerializeField]` | Authoring + Baker | エディタ設定 |

---

## パフォーマンス比較

### ベンチマーク例: 10,000 個の移動オブジェクト

| 指標 | MonoBehaviour | ECS (foreach) | ECS + Jobs + Burst |
|------|:------------:|:------------:|:-----------------:|
| CPU 時間 (ms/frame) | 16.5 | 2.1 | 0.3 |
| GC Alloc | 48KB/frame | 0B | 0B |
| FPS | 45 | 400+ | 2000+ |
| メモリ配置 | 散在 (Heap) | 連続 (Chunk) | 連続 (Chunk) |

### ベンチマーク例: 50,000 個の弾丸シミュレーション

| 指標 | MonoBehaviour | ECS + Burst |
|------|:------------:|:----------:|
| CPU 時間 (ms/frame) | 85+ | 1.2 |
| 実用可能か | 不可能 | 60FPS 安定 |

---

## ハイブリッドアプローチ（MonoBehaviour + ECS 共存）

すべてを一度に移行する必要はない。以下のパターンで共存できる。

### パターン 1: ECS でデータ処理、MonoBehaviour で表示

```csharp
// ECS 側: 大量のデータ処理
[BurstCompile]
public partial struct BoidSimulationSystem : ISystem
{
    // 10,000 体の群衆シミュレーション
}

// MonoBehaviour 側: 結果を表示に反映
public class BoidRenderer : MonoBehaviour
{
    void LateUpdate()
    {
        // ECS のデータを読み取り Graphics.DrawMeshInstanced で描画
    }
}
```

### パターン 2: パフォーマンスクリティカルな部分のみ ECS

```
MonoBehaviour 層
  ・UI、メニュー、カットシーン
  ・プレイヤー操作
  ・サウンド管理
        │
        │ データ連携
        ▼
ECS + DOTS 層
  ・敵AI（大量処理）
  ・弾幕シミュレーション
  ・パーティクル計算
  ・パスファインディング
```

---

## 必要パッケージ

| パッケージ | Package Name | 用途 |
|-----------|-------------|------|
| Entities | `com.unity.entities` | ECS コア |
| Entities Graphics | `com.unity.entities.graphics` | ECS エンティティの描画 |
| Burst | `com.unity.burst` | ネイティブコード最適化 |
| Mathematics | `com.unity.mathematics` | SIMD 数学ライブラリ |
| Collections | `com.unity.collections` | NativeArray 等 |
| Jobs | `com.unity.jobs` | マルチスレッド処理 |

---

## 注意事項

- ECS のコンポーネントは値型（struct）のみ。参照型（class, string）は使用不可
- `NativeArray` や `NativeList` は手動で Dispose する必要がある
- Burst Compiler は managed type（class, interface）をサポートしない
- エディタ上のデバッグは Entities Hierarchy / Entities Inspector を使用する
- MonoBehaviour の `[SerializeField]` に相当するのは Authoring + Baker パターン
