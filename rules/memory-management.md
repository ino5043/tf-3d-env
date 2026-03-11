# Memory Management

Unity のメモリ管理に関する必須ルール。GC Alloc 削減、オブジェクトプーリング、Addressables 活用を徹底する。

---

## 1. プラットフォーム別メモリ上限

| プラットフォーム | アプリ上限目安 | Texture Memory | Mesh Memory | Audio Memory |
|----------------|---------------|----------------|-------------|-------------|
| PC High | ~8 GB | ~4 GB | ~1 GB | ~512 MB |
| PC Low | ~4 GB | ~1 GB | ~512 MB | ~256 MB |
| Mobile (iOS) | ~1.4 GB | ~400 MB | ~128 MB | ~64 MB |
| Mobile (Android Low) | ~800 MB | ~256 MB | ~64 MB | ~32 MB |
| VR (Quest 2/3) | ~2 GB | ~512 MB | ~256 MB | ~128 MB |

**注意:** iOS では OS がメモリ不足アプリを即座に KILL する。上限の 80% 以下を目標にする。

---

## 2. GC Alloc 削減パターン

### 毎フレーム GC Alloc が発生する危険パターン

| パターン | Alloc 量 | 対策 |
|---------|---------|------|
| `string` 結合 (`+`) | 結合ごとに新規 string | `StringBuilder` / `string.Format` / 補間式の限定使用 |
| `LINQ` (`.Where()`, `.Select()`) | Iterator + Delegate | `for` / `foreach` ループに置換 |
| `lambda` / クロージャ | Delegate 生成 | キャッシュまたは static lambda |
| `boxing` (struct → object) | 型変換ごとに | ジェネリック、`IEquatable<T>` 実装 |
| `GetComponent<T>()` 毎フレーム | 検索結果の object | `Awake()` でキャッシュ |
| `new List<T>()` 毎フレーム | List 生成 | フィールドに保持して `.Clear()` |
| `foreach` on `Dictionary` | Enumerator (Unity 旧版) | `foreach` は Unity 2020+ で修正済み |

### 具体的な修正例

```csharp
// BAD: 毎フレーム GC Alloc
private void Update()
{
    // string 結合（毎フレーム新規 string）
    _debugText.text = "HP: " + _currentHP + " / " + _maxHP;

    // LINQ（Iterator + Delegate 生成）
    var nearbyEnemies = _enemies.Where(e => e.IsAlive && e.Distance < 10f).ToList();

    // new List 毎フレーム
    var results = new List<RaycastHit>();
}

// GOOD: GC Alloc ゼロ
private readonly StringBuilder _sb = new(64);
private readonly List<Enemy> _nearbyEnemies = new(32);
private readonly RaycastHit[] _raycastBuffer = new RaycastHit[16];

private void Update()
{
    // StringBuilder で再利用
    _sb.Clear();
    _sb.Append("HP: ").Append(_currentHP).Append(" / ").Append(_maxHP);
    _debugText.SetText(_sb); // TMP は StringBuilder 直接受け取り可能

    // List を Clear して再利用
    _nearbyEnemies.Clear();
    for (int i = 0; i < _enemies.Count; i++)
    {
        if (_enemies[i].IsAlive && _enemies[i].Distance < 10f)
            _nearbyEnemies.Add(_enemies[i]);
    }

    // NonAlloc API を使用
    int hitCount = Physics.RaycastNonAlloc(ray, _raycastBuffer, 100f);
}
```

### Span<T> の活用（Unity 2021.2+）

```csharp
// BAD: 配列を返す → ヒープ確保
public int[] GetNeighborIndices(int index)
{
    return new int[] { index - 1, index + 1, index - _width, index + _width };
}

// GOOD: Span で stackalloc
public void ProcessNeighbors(int index)
{
    Span<int> neighbors = stackalloc int[4];
    neighbors[0] = index - 1;
    neighbors[1] = index + 1;
    neighbors[2] = index - _width;
    neighbors[3] = index + _width;

    foreach (int n in neighbors)
    {
        if (n >= 0 && n < _totalCells)
            ProcessCell(n);
    }
}
```

---

## 3. オブジェクトプーリング

### Unity ObjectPool<T>（Unity 2021+）

```csharp
using UnityEngine;
using UnityEngine.Pool;

public class BulletPool : MonoBehaviour
{
    [SerializeField] private Bullet _bulletPrefab;
    [SerializeField] private int _defaultCapacity = 50;
    [SerializeField] private int _maxSize = 200;

    private IObjectPool<Bullet> _pool;

    private void Awake()
    {
        _pool = new ObjectPool<Bullet>(
            createFunc: () =>
            {
                var bullet = Instantiate(_bulletPrefab);
                bullet.SetPool(_pool);
                return bullet;
            },
            actionOnGet: bullet =>
            {
                bullet.gameObject.SetActive(true);
            },
            actionOnRelease: bullet =>
            {
                bullet.gameObject.SetActive(false);
            },
            actionOnDestroy: bullet =>
            {
                Destroy(bullet.gameObject);
            },
            collectionCheck: true,
            defaultCapacity: _defaultCapacity,
            maxSize: _maxSize
        );
    }

    public Bullet Get() => _pool.Get();
}

public class Bullet : MonoBehaviour
{
    private IObjectPool<Bullet> _pool;

    public void SetPool(IObjectPool<Bullet> pool) => _pool = pool;

    public void ReturnToPool()
    {
        _pool.Release(this);
    }

    private void OnBecameInvisible()
    {
        ReturnToPool();
    }
}
```

### Generic Pool パターン（Unity 2020 以前対応）

```csharp
public class GenericPool<T> where T : Component
{
    private readonly T _prefab;
    private readonly Transform _parent;
    private readonly Queue<T> _available = new();
    private readonly HashSet<T> _inUse = new();

    public GenericPool(T prefab, Transform parent, int warmUpCount = 0)
    {
        _prefab = prefab;
        _parent = parent;

        for (int i = 0; i < warmUpCount; i++)
        {
            var instance = CreateInstance();
            instance.gameObject.SetActive(false);
            _available.Enqueue(instance);
        }
    }

    public T Get()
    {
        var instance = _available.Count > 0
            ? _available.Dequeue()
            : CreateInstance();

        instance.gameObject.SetActive(true);
        _inUse.Add(instance);
        return instance;
    }

    public void Return(T instance)
    {
        if (!_inUse.Remove(instance)) return;
        instance.gameObject.SetActive(false);
        _available.Enqueue(instance);
    }

    private T CreateInstance()
    {
        return Object.Instantiate(_prefab, _parent);
    }

    public int ActiveCount => _inUse.Count;
    public int AvailableCount => _available.Count;
}
```

---

## 4. Addressables によるメモリ管理

### ロード/アンロードの基本パターン

```csharp
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

public class AddressableLoader : MonoBehaviour
{
    [SerializeField] private AssetReference _prefabRef;
    private AsyncOperationHandle<GameObject> _handle;

    public async void LoadAndInstantiate()
    {
        // ロード + インスタンス化
        _handle = Addressables.InstantiateAsync(_prefabRef);
        var instance = await _handle.Task;

        if (_handle.Status == AsyncOperationStatus.Succeeded)
        {
            Debug.Log($"Loaded: {instance.name}");
        }
    }

    public void Unload()
    {
        // 必ず Release を呼ぶ（参照カウント管理）
        if (_handle.IsValid())
        {
            Addressables.ReleaseInstance(_handle);
        }
    }

    private void OnDestroy()
    {
        // MonoBehaviour 破棄時にも必ず Release
        Unload();
    }
}
```

### 参照カウントの注意

```csharp
// BAD: Release を忘れる → メモリリーク
var handle = Addressables.LoadAssetAsync<Texture2D>("T_Character_Diffuse");
var texture = await handle.Task;
// handle を Release しないと texture のメモリが解放されない

// GOOD: using / try-finally で確実に Release
public async Task<Sprite> LoadSpriteAsync(string address)
{
    var handle = Addressables.LoadAssetAsync<Sprite>(address);

    try
    {
        var sprite = await handle.Task;
        if (handle.Status != AsyncOperationStatus.Succeeded)
            throw new Exception($"Failed to load: {address}");
        return sprite;
    }
    catch
    {
        Addressables.Release(handle);
        throw;
    }
}
```

---

## 5. テクスチャメモリ管理

| 設定 | PC | Mobile | VR |
|------|-----|--------|-----|
| Max Size | 4096 | 1024〜2048 | 2048 |
| Compression | BC7 / DXT5 | ASTC 6x6 | ASTC 6x6 |
| Mipmap | ON | ON（UI 以外） | ON |
| Streaming | ON | ON | ON |
| sRGB | ON（カラー）/ OFF（データ） | 同左 | 同左 |

```csharp
// テクスチャ Streaming の確認
#if UNITY_EDITOR
[MenuItem("Tools/Check Texture Memory")]
private static void CheckTextureMemory()
{
    var textures = Resources.FindObjectsOfTypeAll<Texture2D>();
    long totalBytes = 0;

    foreach (var tex in textures)
    {
        long bytes = UnityEngine.Profiling.Profiler.GetRuntimeMemorySizeLong(tex);
        totalBytes += bytes;

        if (bytes > 4 * 1024 * 1024) // 4MB 以上の巨大テクスチャ
        {
            Debug.LogWarning(
                $"[Memory] Large texture: {tex.name} " +
                $"({bytes / (1024 * 1024f):F1} MB, {tex.width}x{tex.height})");
        }
    }

    Debug.Log($"[Memory] Total texture memory: {totalBytes / (1024 * 1024f):F1} MB");
}
#endif
```

---

## 6. メモリリーク検出パターン

| リークパターン | 原因 | 検出方法 | 対策 |
|--------------|------|---------|------|
| Addressables 未 Release | `Addressables.Release()` 忘れ | Event Viewer でカウント確認 | `OnDestroy` で必ず Release |
| イベント購読解除忘れ | `+=` したが `-=` しない | Memory Profiler で参照追跡 | `OnDisable` / `OnDestroy` で解除 |
| Coroutine の無限ループ | `while(true)` が止まらない | Profiler で Coroutine 数監視 | `StopCoroutine` / Token パターン |
| Texture の未解放 | `new Texture2D()` して Destroy しない | Memory Profiler | `Destroy(texture)` 明示呼び出し |
| Static 参照 | static フィールドに MonoBehaviour 保持 | Memory Profiler | WeakReference / イベント方式 |

```csharp
// BAD: イベント購読解除忘れ
public class HealthUI : MonoBehaviour
{
    [SerializeField] private PlayerModel _player;

    private void Start()
    {
        _player.OnDamaged += UpdateUI; // 購読
        // OnDestroy で解除しないとリーク
    }
}

// GOOD: 対称的な購読/解除
public class HealthUI : MonoBehaviour
{
    [SerializeField] private PlayerModel _player;

    private void OnEnable()
    {
        _player.OnDamaged += UpdateUI;
    }

    private void OnDisable()
    {
        _player.OnDamaged -= UpdateUI;
    }

    private void UpdateUI(int damage) { /* ... */ }
}
```

---

## 7. プロファイリングツール

### Memory Profiler パッケージ

```
Package Manager > Unity Registry > Memory Profiler
Window > Analysis > Memory Profiler
```

| 機能 | 用途 |
|------|------|
| Tree Map | メモリ消費の全体像を視覚化 |
| Table View | オブジェクトタイプ別のメモリ使用量 |
| Snapshot Comparison | 2 時点のスナップショット差分（リーク検出） |
| Reference Graph | 特定オブジェクトの参照チェーン |

### ランタイムメモリ監視

```csharp
public class MemoryMonitor : MonoBehaviour
{
    [SerializeField] private float _checkInterval = 5f;
    [SerializeField] private long _warningThresholdMB = 512;

    private void Start()
    {
        InvokeRepeating(nameof(CheckMemory), 1f, _checkInterval);
    }

    private void CheckMemory()
    {
        long totalMemory = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong();
        long reservedMemory = UnityEngine.Profiling.Profiler.GetTotalReservedMemoryLong();
        long gcMemory = System.GC.GetTotalMemory(false);

        float totalMB = totalMemory / (1024f * 1024f);
        float reservedMB = reservedMemory / (1024f * 1024f);
        float gcMB = gcMemory / (1024f * 1024f);

        if (totalMB > _warningThresholdMB)
        {
            Debug.LogWarning(
                $"[Memory] HIGH USAGE - Total: {totalMB:F1} MB, " +
                $"Reserved: {reservedMB:F1} MB, GC: {gcMB:F1} MB");
        }
    }
}
```

---

## チェックリスト

### コーディング時
- [ ] `Update()` 内で GC Alloc が発生していないか（Profiler で確認）
- [ ] `new List<T>()` / `new Dictionary<,>()` を毎フレーム生成していないか
- [ ] LINQ を Update ループ内で使用していないか
- [ ] string 結合に `StringBuilder` を使用しているか
- [ ] `Physics.RaycastNonAlloc` 等の NonAlloc API を使用しているか

### オブジェクト管理
- [ ] 頻繁に生成/破棄するオブジェクトにプーリングを適用したか
- [ ] Addressables の `Release()` を `OnDestroy()` で呼んでいるか
- [ ] イベント購読 (`+=`) に対応する解除 (`-=`) があるか
- [ ] `new Texture2D()` / `new Mesh()` に対応する `Destroy()` があるか

### テクスチャ管理
- [ ] テクスチャ圧縮形式がプラットフォームに適切か
- [ ] 不要な Mipmap が OFF になっているか（UI テクスチャ等）
- [ ] テクスチャ Streaming が有効か
- [ ] 4 MB 以上のテクスチャが存在しないか（必要性を確認）

### リリース前
- [ ] Memory Profiler でスナップショットを取り、リーク調査をしたか
- [ ] メモリ使用量がプラットフォーム上限の 80% 以下か
- [ ] GC スパイクが許容範囲内か（フレーム落ちしないか）
