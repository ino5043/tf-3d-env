# Unity Architecture Patterns

Unity プロジェクトのアーキテクチャ設計に関する必須ルール。プロジェクト規模と要件に応じて適切なパターンを選択する。

---

## 1. MonoBehaviour ベースアーキテクチャ（小〜中規模）

小〜中規模プロジェクト（エンティティ数 1,000 以下）では MonoBehaviour ベースで構成する。

### レイヤー構造

```
┌─────────────────────────────────────────────────┐
│               Presentation Layer                │
│        (MonoBehaviour, UI, Input Handler)        │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│               Application Layer                 │
│          (GameManager, State Machine)            │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│                 Domain Layer                    │
│        (Pure C# Classes, ScriptableObject)      │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│              Infrastructure Layer               │
│       (SaveSystem, Network, AssetLoading)        │
└─────────────────────────────────────────────────┘
```

```csharp
// Presentation Layer: MonoBehaviour はビューに徹する
public class PlayerView : MonoBehaviour
{
    [SerializeField] private Animator _animator;
    [SerializeField] private ParticleSystem _hitEffect;

    private PlayerModel _model;

    public void Initialize(PlayerModel model)
    {
        _model = model;
        _model.OnHealthChanged += UpdateHealthUI;
    }

    private void UpdateHealthUI(int current, int max)
    {
        _animator.SetFloat("HealthRatio", (float)current / max);
    }

    private void OnDestroy()
    {
        if (_model != null)
            _model.OnHealthChanged -= UpdateHealthUI;
    }
}

// Domain Layer: Pure C# でビジネスロジックを記述
public class PlayerModel
{
    public event Action<int, int> OnHealthChanged;

    private readonly int _maxHealth;
    private int _currentHealth;

    public PlayerModel(int maxHealth)
    {
        _maxHealth = maxHealth;
        _currentHealth = maxHealth;
    }

    public void TakeDamage(int damage)
    {
        if (damage < 0) throw new ArgumentException("Damage must be non-negative");

        _currentHealth = Mathf.Max(0, _currentHealth - damage);
        OnHealthChanged?.Invoke(_currentHealth, _maxHealth);
    }

    public bool IsDead => _currentHealth <= 0;
}
```

---

## 2. DOTS/ECS アーキテクチャ（大規模）

大規模プロジェクト（エンティティ数 10,000 以上、高パフォーマンス要件）では DOTS/ECS を採用する。

```csharp
// Component: データのみ、ロジックなし
public struct Health : IComponentData
{
    public int Current;
    public int Max;
}

public struct DamageEvent : IComponentData, IEnableableComponent
{
    public int Amount;
}

// System: ロジックのみ、データなし
[BurstCompile]
public partial struct DamageSystem : ISystem
{
    [BurstCompile]
    public void OnUpdate(ref SystemState state)
    {
        foreach (var (health, damage) in
            SystemAPI.Query<RefRW<Health>, RefRO<DamageEvent>>()
                .WithAll<DamageEvent>())
        {
            health.ValueRW.Current = math.max(0,
                health.ValueRO.Current - damage.ValueRO.Amount);
        }
    }
}
```

---

## 3. MonoBehaviour vs ECS 選択基準

| 観点 | MonoBehaviour | DOTS/ECS |
|------|--------------|----------|
| エンティティ数 | ~1,000 | 10,000+ |
| フレーム内処理量 | 軽量〜中程度 | 大量データ並列処理 |
| 開発速度 | 速い | 遅い（学習コスト高） |
| 学習コスト | 低い | 高い（Burst, Jobs, ECS） |
| デバッグ容易性 | Inspector で確認可能 | Entity Debugger 必要 |
| アセット互換性 | ほぼ全て対応 | 一部非対応 |
| ネットワーク連携 | Netcode 対応済み | Netcode for Entities 別途 |
| 推奨プロジェクト | インディー、モバイル、UI 重視 | RTS, シミュレーション, オープンワールド |

**判断フロー:**

```
同時処理エンティティ数は?
├─ 1,000 以下 → MonoBehaviour ベース
├─ 1,000 〜 10,000 → ハイブリッド（重い処理のみ Jobs/Burst）
└─ 10,000 以上 → DOTS/ECS
```

---

## 4. ScriptableObject 活用パターン

### データコンテナ

```csharp
[CreateAssetMenu(fileName = "WeaponData", menuName = "Game/Weapon Data")]
public class WeaponData : ScriptableObject
{
    [Header("Basic Info")]
    [SerializeField] private string _weaponName;
    [SerializeField] private Sprite _icon;

    [Header("Stats")]
    [SerializeField, Range(1, 100)] private int _damage;
    [SerializeField, Range(0.1f, 5f)] private float _attackSpeed;
    [SerializeField] private DamageType _damageType;

    // イミュータブルな公開
    public string WeaponName => _weaponName;
    public Sprite Icon => _icon;
    public int Damage => _damage;
    public float AttackSpeed => _attackSpeed;
    public DamageType DamageType => _damageType;
}
```

### ScriptableObject イベントシステム

```csharp
[CreateAssetMenu(menuName = "Events/Void Event")]
public class VoidEvent : ScriptableObject
{
    private readonly List<VoidEventListener> _listeners = new();

    public void Raise()
    {
        // 逆順でイテレート（リスナーが自身を解除する場合に安全）
        for (int i = _listeners.Count - 1; i >= 0; i--)
            _listeners[i].OnEventRaised();
    }

    public void Register(VoidEventListener listener) => _listeners.Add(listener);
    public void Unregister(VoidEventListener listener) => _listeners.Remove(listener);
}

public class VoidEventListener : MonoBehaviour
{
    [SerializeField] private VoidEvent _event;
    [SerializeField] private UnityEvent _response;

    private void OnEnable() => _event.Register(this);
    private void OnDisable() => _event.Unregister(this);

    public void OnEventRaised() => _response?.Invoke();
}
```

---

## 5. DI (Dependency Injection) 比較

| 観点 | VContainer | Zenject |
|------|-----------|---------|
| パフォーマンス | 高速（コード生成ベース） | 中程度（リフレクション） |
| GC Alloc | 少ない | 多い |
| 学習コスト | 低い | 中程度 |
| 機能の豊富さ | 必要十分 | 非常に豊富 |
| メンテナンス状況 | アクティブ | メンテナンス低下 |
| Unity バージョン対応 | 最新対応が早い | 遅延あり |
| 推奨度 | 新規プロジェクト推奨 | 既存プロジェクトで使用中なら継続 |

```csharp
// VContainer の例
public class GameLifetimeScope : LifetimeScope
{
    protected override void Configure(IContainerBuilder builder)
    {
        builder.Register<PlayerModel>(Lifetime.Singleton);
        builder.Register<IWeaponRepository, WeaponRepository>(Lifetime.Singleton);
        builder.RegisterComponentInHierarchy<PlayerView>();
    }
}
```

---

## 6. Assembly Definition (.asmdef) 設計

コンパイル時間最適化のため、機能ごとに Assembly Definition を分割する。

```
Assets/
├── Game.Core.asmdef           # ドメインロジック（Pure C#）
├── Game.Infrastructure.asmdef # 外部システム連携
├── Game.Presentation.asmdef   # MonoBehaviour, UI
├── Game.Tests.asmdef          # テストコード
└── ThirdParty/                # サードパーティ（各自 asmdef 持ち）
```

**依存方向:** `Presentation → Core ← Infrastructure`（Core は何にも依存しない）

---

## 7. アンチパターン

| アンチパターン | 問題 | 対策 |
|--------------|------|------|
| God MonoBehaviour | 1 クラスが全機能を担当、テスト不可能 | 責任分離、Pure C# でロジック抽出 |
| Singleton 乱用 | 暗黙の依存、テスト困難、初期化順序問題 | DI コンテナ、ScriptableObject |
| `Update()` 内 `Find()` | 毎フレーム検索で深刻なパフォーマンス劣化 | `Awake()` でキャッシュ |
| `GetComponent<T>()` 毎フレーム | 不要な検索コスト | フィールドにキャッシュ |
| `string` でのメソッド呼び出し | `SendMessage("Method")` はタイプセーフでない | インターフェース、イベント |
| Resources フォルダ乱用 | 起動時全インデックス化、メモリ増大 | Addressables に移行 |

```csharp
// BAD: Update 内で Find
private void Update()
{
    var player = GameObject.Find("Player"); // 毎フレーム検索
    var rb = player.GetComponent<Rigidbody>(); // 毎フレーム取得
}

// GOOD: Awake でキャッシュ
private Transform _playerTransform;
private Rigidbody _playerRb;

private void Awake()
{
    var player = GameObject.Find("Player");
    _playerTransform = player.transform;
    _playerRb = player.GetComponent<Rigidbody>();
}
```

---

## チェックリスト

### プロジェクト開始時
- [ ] プロジェクト規模に応じたアーキテクチャ（MonoBehaviour / ECS / ハイブリッド）を選択したか
- [ ] Assembly Definition でコンパイル単位を分割したか
- [ ] DI コンテナの要否を判断したか（VContainer 推奨）
- [ ] ScriptableObject のデータ管理方針を決めたか

### コードレビュー時
- [ ] MonoBehaviour にビジネスロジックが入り込んでいないか
- [ ] `Update()` 内で `Find()` / `GetComponent()` を呼んでいないか
- [ ] Singleton を新たに追加していないか（DI で代替可能か検討）
- [ ] ScriptableObject のデータが実行時に変更されていないか（共有データの汚染防止）
- [ ] Assembly Definition の依存方向が正しいか（循環依存がないか）
