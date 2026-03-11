# Unity C# Coding Style

Unity C# コーディング規約に関する必須ルール。命名規則、MonoBehaviour 作法、パフォーマンスパターンを定義する。

---

## 1. 命名規則

| 対象 | スタイル | 例 |
|------|---------|-----|
| Public メソッド | PascalCase | `TakeDamage()`, `GetHealth()` |
| Public プロパティ | PascalCase | `MaxHealth`, `IsAlive` |
| Private フィールド | `_camelCase` | `_currentHealth`, `_moveSpeed` |
| SerializeField | `_camelCase` | `[SerializeField] private float _speed` |
| ローカル変数 | camelCase | `var enemyCount = 0;` |
| 定数 | PascalCase | `const int MaxPlayers = 4;` |
| Static フィールド | `s_camelCase` | `private static int s_instanceCount;` |
| インターフェース | `I` + PascalCase | `IDamageable`, `IInteractable` |
| Enum | PascalCase (型・値とも) | `DamageType.Fire` |
| イベント | `On` + PascalCase | `OnDeath`, `OnHealthChanged` |

```csharp
// 命名規則の統合例
public class EnemyController : MonoBehaviour, IDamageable
{
    // 定数
    private const float DefaultMoveSpeed = 5f;

    // Static
    private static int s_activeEnemyCount;

    // SerializeField（Inspector 表示 + Private）
    [SerializeField] private float _moveSpeed = DefaultMoveSpeed;
    [SerializeField] private int _maxHealth = 100;
    [SerializeField] private Transform _patrolTarget;

    // Private フィールド
    private int _currentHealth;
    private Rigidbody _rb;
    private bool _isStunned;

    // Public プロパティ
    public bool IsAlive => _currentHealth > 0;
    public float HealthRatio => (float)_currentHealth / _maxHealth;

    // イベント
    public event Action<int> OnDamaged;
    public event Action OnDeath;

    // Public メソッド
    public void TakeDamage(int amount) { /* ... */ }
}
```

---

## 2. Unity 属性の使い方

| 属性 | 用途 | 例 |
|------|------|-----|
| `[SerializeField]` | Private フィールドを Inspector に表示 | `[SerializeField] private float _speed;` |
| `[RequireComponent]` | 必須コンポーネントを自動追加 | `[RequireComponent(typeof(Rigidbody))]` |
| `[Header]` | Inspector のセクション区切り | `[Header("Movement")]` |
| `[Tooltip]` | Inspector のホバー説明 | `[Tooltip("Units per second")]` |
| `[Range]` | 数値スライダー | `[Range(0f, 100f)]` |
| `[Min]` | 最小値制限 | `[Min(0)]` |
| `[Space]` | Inspector のスペース | `[Space(10)]` |
| `[TextArea]` | 複数行テキスト入力 | `[TextArea(3, 10)]` |
| `[HideInInspector]` | Public を非表示 | `[HideInInspector] public int id;` |
| `[DisallowMultipleComponent]` | 同一 GO に複数追加を禁止 | クラスに付与 |

```csharp
[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(CapsuleCollider))]
[DisallowMultipleComponent]
public class CharacterMovement : MonoBehaviour
{
    [Header("Movement Settings")]
    [Tooltip("Maximum movement speed in units per second")]
    [SerializeField, Range(1f, 20f)] private float _maxSpeed = 8f;

    [Tooltip("Time to reach max speed from standstill")]
    [SerializeField, Min(0.01f)] private float _accelerationTime = 0.2f;

    [Header("Jump Settings")]
    [SerializeField] private float _jumpForce = 10f;
    [SerializeField] private LayerMask _groundLayer;

    [Header("Debug")]
    [SerializeField] private bool _showGizmos = true;

    // Rigidbody は RequireComponent で保証
    private Rigidbody _rb;

    private void Awake()
    {
        _rb = GetComponent<Rigidbody>(); // null にならない
    }
}
```

---

## 3. MonoBehaviour ライフサイクルメソッドの順序

コード内の記述順序を Unity のライフサイクル順に合わせる。

```csharp
public class LifecycleExample : MonoBehaviour
{
    // 1. フィールド宣言

    // 2. ライフサイクルメソッド（呼び出し順）
    private void Awake()        { /* コンポーネント参照の取得 */ }
    private void OnEnable()     { /* イベント購読 */ }
    private void Start()        { /* 初期化（他 GO の Awake 後） */ }

    private void FixedUpdate()  { /* 物理演算（固定タイムステップ） */ }
    private void Update()       { /* 毎フレーム処理 */ }
    private void LateUpdate()   { /* カメラ追従等（Update 後） */ }

    private void OnDisable()    { /* イベント購読解除 */ }
    private void OnDestroy()    { /* リソース解放 */ }

    // 3. Public メソッド
    // 4. Private メソッド
    // 5. コールバック / イベントハンドラ
}
```

---

## 4. コルーチン vs async/await vs UniTask

| 項目 | Coroutine | async/await (C#) | UniTask |
|------|-----------|------------------|---------|
| GC Alloc | `yield return` ごとに発生 | Task ごとに発生 | ゼロ Alloc（struct ベース） |
| キャンセル | `StopCoroutine` | `CancellationToken` | `CancellationToken` |
| 戻り値 | なし | `Task<T>` | `UniTask<T>` |
| エラーハンドリング | 困難 | `try-catch` | `try-catch` |
| PlayerLoop 連携 | `WaitForEndOfFrame` 等 | 不可 | `await UniTask.Yield(PlayerLoopTiming.Update)` |
| 推奨度 | レガシー | 小規模 OK | 推奨 |

```csharp
// BAD: Coroutine（GC Alloc, エラーハンドリング困難）
private IEnumerator DamageOverTime(float duration, int damagePerTick)
{
    float elapsed = 0f;
    while (elapsed < duration)
    {
        TakeDamage(damagePerTick);
        yield return new WaitForSeconds(0.5f); // GC Alloc!
        elapsed += 0.5f;
    }
}

// GOOD: UniTask（ゼロ Alloc, キャンセル対応）
private async UniTaskVoid DamageOverTimeAsync(
    float duration, int damagePerTick, CancellationToken ct)
{
    float elapsed = 0f;
    try
    {
        while (elapsed < duration)
        {
            ct.ThrowIfCancellationRequested();
            TakeDamage(damagePerTick);
            await UniTask.Delay(500, cancellationToken: ct);
            elapsed += 0.5f;
        }
    }
    catch (OperationCanceledException)
    {
        Debug.Log("Damage over time cancelled");
    }
}
```

---

## 5. null チェックパターン

### Unity null vs C# null

Unity の `Object` は `==` 演算子をオーバーロードしており、Destroy 済みオブジェクトは `== null` で true を返す。`is null` パターンマッチングや `?.` 演算子は C# ネイティブの null チェックのため、Destroy 済みオブジェクトを検出できない。

```csharp
// BAD: C# の null チェック（Destroy 済みを検出できない）
if (target is not null)   // Destroy 済みでも true になる
if (target?.gameObject)   // 同上

// GOOD: Unity の null チェック
if (target != null)       // Destroy 済みなら false
if (target)               // 暗黙的な bool 変換（同義）
```

### TryGetComponent パターン

```csharp
// BAD: GetComponent + null チェック（2 回検索の可能性）
var rb = GetComponent<Rigidbody>();
if (rb != null)
{
    rb.AddForce(Vector3.up);
}

// GOOD: TryGetComponent（1 回の検索で完了）
if (TryGetComponent<Rigidbody>(out var rb))
{
    rb.AddForce(Vector3.up);
}
```

---

## 6. イベントシステム比較

| 項目 | UnityEvent | C# event | SO Event |
|------|-----------|----------|----------|
| Inspector 設定 | 可能 | 不可 | 可能 |
| パフォーマンス | 低い（リフレクション） | 高い | 中 |
| 型安全性 | 弱い | 強い | 強い |
| シーン跨ぎ | 不可 | Singleton 経由 | 可能 |
| テスト容易性 | 低い | 高い | 高い |
| 推奨用途 | UI ボタン | コード内部通信 | シーン跨ぎ通信 |

```csharp
// C# event パターン（コード内部通信に推奨）
public class PlayerHealth : MonoBehaviour
{
    public event Action<int, int> OnHealthChanged; // (current, max)
    public event Action OnDeath;

    private int _currentHealth;
    private int _maxHealth;

    public void TakeDamage(int damage)
    {
        _currentHealth = Mathf.Max(0, _currentHealth - damage);
        OnHealthChanged?.Invoke(_currentHealth, _maxHealth);

        if (_currentHealth <= 0)
        {
            OnDeath?.Invoke();
        }
    }
}
```

---

## 7. string 比較

```csharp
// BAD: tag プロパティ比較（string Alloc + GC）
private void OnCollisionEnter(Collision collision)
{
    if (collision.gameObject.tag == "Player") // GC Alloc!
    {
        // ...
    }
}

// GOOD: CompareTag（GC Alloc なし）
private void OnCollisionEnter(Collision collision)
{
    if (collision.gameObject.CompareTag("Player")) // No Alloc
    {
        // ...
    }
}
```

---

## 8. Update() 内のベストプラクティス

```csharp
public class OptimizedBehaviour : MonoBehaviour
{
    // キャッシュ: Awake で取得し、Update で使い回す
    private Transform _cachedTransform;
    private Camera _mainCamera;
    private static readonly int AnimSpeedHash = Animator.StringToHash("Speed");

    private void Awake()
    {
        _cachedTransform = transform; // transform は毎回プロパティアクセス
        _mainCamera = Camera.main;     // Camera.main は FindWithTag 相当
    }

    private void Update()
    {
        // GOOD: キャッシュ済みの参照を使用
        Vector3 pos = _cachedTransform.position;

        // GOOD: ハッシュ化した Animator パラメータ
        _animator.SetFloat(AnimSpeedHash, _currentSpeed);

        // GOOD: sqrMagnitude で距離比較（sqrt 回避）
        float sqrDist = (target.position - pos).sqrMagnitude;
        if (sqrDist < _detectionRange * _detectionRange)
        {
            OnTargetDetected();
        }
    }
}
```

### Update() 内で避けるべき処理

| 処理 | 理由 | 代替 |
|------|------|------|
| `Find()` / `FindWithTag()` | 毎フレーム検索 | `Awake()` でキャッシュ |
| `GetComponent<T>()` | 毎フレーム検索 | フィールドにキャッシュ |
| `Camera.main` | 内部で `FindWithTag` | `Awake()` でキャッシュ |
| `new` (ヒープ確保) | GC Alloc | プーリング / `stackalloc` |
| `Vector3.Distance()` | 内部で `sqrt` | `sqrMagnitude` で比較 |
| `string` 結合 | GC Alloc | `StringBuilder` |
| `Animator.SetFloat("name")` | 文字列ハッシュ計算 | `StringToHash` でキャッシュ |
| `Debug.Log()` | 文字列生成 + IO | `#if UNITY_EDITOR` で囲む |

```csharp
// BAD: Update 内で避けるべきパターンの集約
private void Update()
{
    var player = GameObject.Find("Player");                    // Find 毎フレーム
    var health = player.GetComponent<Health>();                 // GetComponent 毎フレーム
    var cam = Camera.main;                                     // FindWithTag 内部
    float dist = Vector3.Distance(transform.position, player.transform.position); // sqrt
    _animator.SetFloat("Speed", dist);                         // 文字列ハッシュ
    Debug.Log("Distance: " + dist);                            // string 結合 + IO
}

// GOOD: 全てキャッシュ + 最適化
private Transform _playerTransform;
private Health _playerHealth;
private Camera _mainCamera;
private static readonly int SpeedHash = Animator.StringToHash("Speed");

private void Awake()
{
    _playerTransform = GameObject.Find("Player").transform;
    _playerHealth = _playerTransform.GetComponent<Health>();
    _mainCamera = Camera.main;
}

private void Update()
{
    float sqrDist = (_cachedTransform.position - _playerTransform.position).sqrMagnitude;
    _animator.SetFloat(SpeedHash, Mathf.Sqrt(sqrDist)); // sqrt は表示用のみ
}
```

---

## チェックリスト

### コーディング時
- [ ] 命名規則（PascalCase / _camelCase）に従っているか
- [ ] `[SerializeField]` で Private フィールドを公開しているか（public フィールド禁止）
- [ ] `[Header]`, `[Tooltip]`, `[Range]` で Inspector を整理しているか
- [ ] MonoBehaviour ライフサイクル順にメソッドを配置しているか
- [ ] `Update()` 内に `Find` / `GetComponent` / `Camera.main` がないか

### null チェック
- [ ] Unity オブジェクトに `is null` / `?.` を使用していないか
- [ ] `TryGetComponent` を活用しているか
- [ ] `CompareTag` を使用しているか（`tag ==` ではなく）

### イベント・非同期
- [ ] イベント購読 (`OnEnable`) と解除 (`OnDisable`) が対称的か
- [ ] 新規実装で Coroutine より UniTask を選択しているか
- [ ] `CancellationToken` でキャンセル対応しているか

### パフォーマンス
- [ ] Animator パラメータ名を `StringToHash` でキャッシュしているか
- [ ] 距離比較に `sqrMagnitude` を使用しているか
- [ ] `Debug.Log` が `#if UNITY_EDITOR` で囲まれているか（リリースビルド除外）
