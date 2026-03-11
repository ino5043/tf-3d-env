# Scene Management

Unity のシーン管理に関する必須ルール。シーン分割戦略、Additive Loading、データ受け渡しパターンを定義する。

---

## 1. シーン分割戦略

### 分割パターン比較

| 戦略 | 説明 | 適用場面 |
|------|------|---------|
| 機能別 | ゲームプレイ、UI、オーディオ等で分割 | 中〜大規模プロジェクト |
| レベル別 | ステージ/マップごとに 1 シーン | リニアなゲーム進行 |
| レイヤー別 | 地形、建物、エフェクト等レイヤーで分割 | オープンワールド |

### 推奨シーン構成

```
Scenes/
├── SCN_Boot.unity              # 初期化専用（DontDestroyOnLoad 生成）
├── SCN_Title.unity             # タイトル画面
├── SCN_Loading.unity           # ローディング画面
├── Gameplay/
│   ├── SCN_Gameplay_Base.unity # ゲームプレイ共通（カメラ、UI、マネージャー）
│   ├── SCN_Level_01.unity      # レベルデータのみ
│   ├── SCN_Level_02.unity
│   └── SCN_Level_Boss.unity
├── UI/
│   ├── SCN_HUD.unity           # ゲーム中 UI
│   ├── SCN_Pause.unity         # ポーズメニュー
│   └── SCN_Inventory.unity     # インベントリ画面
└── Test/
    └── SCN_Test_Combat.unity   # テスト用（ビルドに含めない）
```

### 分割の原則

| 原則 | 説明 |
|------|------|
| Boot シーンは最小限 | DontDestroyOnLoad マネージャー生成のみ |
| レベルデータとロジックを分離 | Gameplay_Base + Level_XX の Additive Loading |
| UI は独立シーン | 単体テスト可能にする |
| Test シーンはビルド除外 | Build Settings に含めない |

---

## 2. Additive Scene Loading パターン

### 基本的な Additive Loading

```csharp
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.SceneManagement;

public class SceneLoader : MonoBehaviour
{
    /// <summary>
    /// ベースシーンにレベルシーンを追加ロードする
    /// </summary>
    public async Task LoadLevelAsync(string levelSceneName)
    {
        var operation = SceneManager.LoadSceneAsync(
            levelSceneName,
            LoadSceneMode.Additive
        );

        operation.allowSceneActivation = true;

        while (!operation.isDone)
        {
            // 進捗通知（0〜0.9 がロード、0.9〜1.0 がアクティベーション）
            float progress = Mathf.Clamp01(operation.progress / 0.9f);
            OnProgressChanged?.Invoke(progress);
            await Task.Yield();
        }

        // ロード完了後、追加シーンをアクティブにする
        var loadedScene = SceneManager.GetSceneByName(levelSceneName);
        SceneManager.SetActiveScene(loadedScene);
    }

    /// <summary>
    /// レベルシーンをアンロードする
    /// </summary>
    public async Task UnloadLevelAsync(string levelSceneName)
    {
        var scene = SceneManager.GetSceneByName(levelSceneName);
        if (!scene.isLoaded) return;

        var operation = SceneManager.UnloadSceneAsync(scene);
        while (!operation.isDone)
        {
            await Task.Yield();
        }

        // アンロード後にメモリ解放
        await Resources.UnloadUnusedAssets();
    }

    public event Action<float> OnProgressChanged;
}
```

### レベル切り替え（旧レベル → ロード画面 → 新レベル）

```csharp
public class LevelTransition : MonoBehaviour
{
    [SerializeField] private string _loadingSceneName = "SCN_Loading";
    [SerializeField] private string _gameplayBaseScene = "SCN_Gameplay_Base";

    private string _currentLevelScene;

    public async Task TransitionToLevel(string newLevelScene)
    {
        // 1. ローディング画面を表示
        await SceneManager.LoadSceneAsync(_loadingSceneName, LoadSceneMode.Additive);

        // 2. 現在のレベルをアンロード
        if (!string.IsNullOrEmpty(_currentLevelScene))
        {
            await UnloadSceneAsync(_currentLevelScene);
        }

        // 3. Gameplay Base が未ロードならロード
        if (!SceneManager.GetSceneByName(_gameplayBaseScene).isLoaded)
        {
            await SceneManager.LoadSceneAsync(
                _gameplayBaseScene, LoadSceneMode.Additive);
        }

        // 4. 新レベルをロード
        var loadOp = SceneManager.LoadSceneAsync(
            newLevelScene, LoadSceneMode.Additive);
        loadOp.allowSceneActivation = false;

        while (loadOp.progress < 0.9f)
        {
            await Task.Yield();
        }

        // 5. ロード完了 → アクティベーション
        loadOp.allowSceneActivation = true;
        while (!loadOp.isDone) await Task.Yield();

        _currentLevelScene = newLevelScene;
        SceneManager.SetActiveScene(
            SceneManager.GetSceneByName(newLevelScene));

        // 6. ローディング画面をアンロード
        await UnloadSceneAsync(_loadingSceneName);
    }

    private async Task UnloadSceneAsync(string sceneName)
    {
        var scene = SceneManager.GetSceneByName(sceneName);
        if (scene.isLoaded)
        {
            var op = SceneManager.UnloadSceneAsync(scene);
            while (!op.isDone) await Task.Yield();
        }
    }
}
```

---

## 3. シーン間データ受け渡し

### パターン比較表

| パターン | 永続性 | テスト容易性 | 推奨度 | 用途 |
|---------|--------|-------------|--------|------|
| ScriptableObject | シーン間で共有 | 高 | 推奨 | ゲーム設定、プレイヤーステータス |
| DI Container | Scope 制御可能 | 高 | 推奨 | サービス、マネージャー |
| Static クラス | アプリ終了まで | 低 | 限定的 | 簡易なフラグ |
| DontDestroyOnLoad | シーン跨ぎ | 中 | 限定的 | オーディオマネージャー等 |
| PlayerPrefs | ディスク永続 | 低 | 非推奨 | セーブデータ以外には使わない |

### ScriptableObject でのデータ共有

```csharp
// 共有データを ScriptableObject で定義
[CreateAssetMenu(menuName = "Game/Player Runtime Data")]
public class PlayerRuntimeData : ScriptableObject
{
    [SerializeField] private int _maxHealth = 100;

    // ランタイムで変化するデータ
    [NonSerialized] private int _currentHealth;
    [NonSerialized] private Vector3 _lastCheckpoint;

    public int MaxHealth => _maxHealth;
    public int CurrentHealth => _currentHealth;
    public Vector3 LastCheckpoint => _lastCheckpoint;

    public event Action<int, int> OnHealthChanged;

    public void Initialize()
    {
        _currentHealth = _maxHealth;
        _lastCheckpoint = Vector3.zero;
    }

    public void SetHealth(int value)
    {
        _currentHealth = Mathf.Clamp(value, 0, _maxHealth);
        OnHealthChanged?.Invoke(_currentHealth, _maxHealth);
    }

    public void SetCheckpoint(Vector3 position)
    {
        _lastCheckpoint = position;
    }

    // Play Mode 終了時のクリーンアップ
    private void OnEnable()
    {
        Initialize();
    }
}
```

```csharp
// 各シーンのコンポーネントが同じ ScriptableObject を参照
public class HealthBarUI : MonoBehaviour
{
    [SerializeField] private PlayerRuntimeData _playerData;
    [SerializeField] private Slider _healthSlider;

    private void OnEnable()
    {
        _playerData.OnHealthChanged += UpdateSlider;
        UpdateSlider(_playerData.CurrentHealth, _playerData.MaxHealth);
    }

    private void OnDisable()
    {
        _playerData.OnHealthChanged -= UpdateSlider;
    }

    private void UpdateSlider(int current, int max)
    {
        _healthSlider.value = (float)current / max;
    }
}
```

---

## 4. ローディング画面の実装パターン

```csharp
public class LoadingScreen : MonoBehaviour
{
    [SerializeField] private CanvasGroup _canvasGroup;
    [SerializeField] private Slider _progressBar;
    [SerializeField] private TextMeshProUGUI _progressText;
    [SerializeField] private TextMeshProUGUI _tipText;
    [SerializeField] private string[] _tips;
    [SerializeField] private float _fadeSpeed = 2f;
    [SerializeField] private float _minimumLoadTime = 1f;

    public async Task ShowAsync()
    {
        gameObject.SetActive(true);
        _progressBar.value = 0;
        _tipText.text = _tips[UnityEngine.Random.Range(0, _tips.Length)];

        // フェードイン
        _canvasGroup.alpha = 0f;
        while (_canvasGroup.alpha < 1f)
        {
            _canvasGroup.alpha += Time.unscaledDeltaTime * _fadeSpeed;
            await Task.Yield();
        }
        _canvasGroup.alpha = 1f;
    }

    public void UpdateProgress(float progress)
    {
        _progressBar.value = progress;
        _progressText.text = $"{(int)(progress * 100)}%";
    }

    public async Task HideAsync()
    {
        // 最低表示時間を確保（ちらつき防止）
        await Task.Delay((int)(_minimumLoadTime * 1000));

        // フェードアウト
        while (_canvasGroup.alpha > 0f)
        {
            _canvasGroup.alpha -= Time.unscaledDeltaTime * _fadeSpeed;
            await Task.Yield();
        }
        _canvasGroup.alpha = 0f;
        gameObject.SetActive(false);
    }
}
```

---

## 5. シーンのライフサイクル管理

### ライフサイクルイベント

```
LoadSceneAsync (Additive)
│
├─ Awake()          ← 全 GameObject の Awake が呼ばれる
├─ OnEnable()       ← 有効な GameObject の OnEnable
├─ Start()          ← 次フレームで Start
│
├─ (ゲームプレイ中)
│   ├─ Update()
│   ├─ FixedUpdate()
│   └─ LateUpdate()
│
├─ UnloadSceneAsync
│   ├─ OnDisable()  ← 全 GameObject の OnDisable
│   └─ OnDestroy()  ← 全 GameObject の OnDestroy
│
└─ Resources.UnloadUnusedAssets()  ← メモリ解放
```

### シーン初期化コントローラー

```csharp
/// <summary>
/// 各シーンに 1 つ配置し、初期化と終了処理を管理する
/// </summary>
public class SceneInitializer : MonoBehaviour
{
    [SerializeField] private SceneContext _sceneContext;

    public event Action OnSceneReady;
    public event Action OnSceneCleanup;

    private async void Start()
    {
        await InitializeAsync();
        OnSceneReady?.Invoke();
    }

    private async Task InitializeAsync()
    {
        // シーン固有の初期化
        await _sceneContext.SetupAsync();
    }

    private void OnDestroy()
    {
        // シーン固有のクリーンアップ
        OnSceneCleanup?.Invoke();
        _sceneContext.Cleanup();
    }
}
```

---

## 6. Addressable Scene のロード

```csharp
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;
using UnityEngine.ResourceManagement.ResourceProviders;

public class AddressableSceneLoader : MonoBehaviour
{
    private AsyncOperationHandle<SceneInstance> _currentSceneHandle;

    public async Task LoadSceneAsync(string sceneAddress, bool additive = true)
    {
        var loadMode = additive
            ? UnityEngine.SceneManagement.LoadSceneMode.Additive
            : UnityEngine.SceneManagement.LoadSceneMode.Single;

        _currentSceneHandle = Addressables.LoadSceneAsync(
            sceneAddress,
            loadMode,
            activateOnLoad: true
        );

        var sceneInstance = await _currentSceneHandle.Task;

        if (_currentSceneHandle.Status == AsyncOperationStatus.Succeeded)
        {
            Debug.Log($"Scene loaded: {sceneInstance.Scene.name}");
        }
        else
        {
            Debug.LogError($"Failed to load scene: {sceneAddress}");
        }
    }

    public async Task UnloadCurrentSceneAsync()
    {
        if (!_currentSceneHandle.IsValid()) return;

        var unloadOp = Addressables.UnloadSceneAsync(_currentSceneHandle);
        await unloadOp.Task;

        if (unloadOp.Status == AsyncOperationStatus.Succeeded)
        {
            Debug.Log("Scene unloaded successfully");
        }
    }

    private void OnDestroy()
    {
        if (_currentSceneHandle.IsValid())
        {
            Addressables.UnloadSceneAsync(_currentSceneHandle);
        }
    }
}
```

---

## チェックリスト

### シーン設計時
- [ ] シーン分割戦略（機能別/レベル別/レイヤー別）を決定したか
- [ ] Boot シーンで DontDestroyOnLoad マネージャーを生成しているか
- [ ] レベルデータとゲームプレイロジックが分離されているか
- [ ] Test シーンが Build Settings から除外されているか

### シーン遷移実装時
- [ ] Additive Loading を使用しているか（Single Loading は極力避ける）
- [ ] ローディング画面でフェードイン/アウトを実装したか
- [ ] シーンアンロード後に `Resources.UnloadUnusedAssets()` を呼んでいるか
- [ ] `allowSceneActivation` で表示タイミングを制御しているか

### データ受け渡し
- [ ] ScriptableObject または DI でシーン間データを共有しているか
- [ ] static 変数の乱用をしていないか
- [ ] PlayerPrefs をセーブデータ以外で使用していないか
- [ ] イベント購読/解除が OnEnable/OnDisable で対称的か

### リリース前
- [ ] シーン遷移時にメモリリークが発生していないか（Memory Profiler）
- [ ] ロード時間がプラットフォーム要件を満たしているか
- [ ] 全シーン遷移パスをテストしたか（往復含む）
