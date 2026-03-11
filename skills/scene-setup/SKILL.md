---
name: scene-setup
description: Generate Unity scene setup templates with standard lighting, camera, UI Canvas, and EventSystem configuration.
---

# Scene Setup テンプレート生成

Unity シーンの初期構成テンプレートを生成するスキル。URP 対応の標準ライティング、カメラ、UI Canvas、EventSystem を含む。

---

## シーン階層構成テンプレート

新規シーン作成時、以下の階層構成をベースにする。

```
Scene Root
├── --- MANAGERS ---
│   ├── GameManager
│   ├── AudioManager
│   └── UIManager
├── --- ENVIRONMENT ---
│   ├── Lighting
│   │   ├── Directional Light
│   │   └── Post Processing Volume
│   ├── Skybox
│   └── Level
│       ├── Terrain
│       └── Static Props
├── --- CHARACTERS ---
│   ├── Player
│   └── NPCs
├── --- UI ---
│   ├── Canvas (Screen Space - Overlay)
│   │   ├── HUD
│   │   ├── Menus
│   │   └── Popups
│   └── EventSystem
└── --- CAMERAS ---
    ├── Main Camera
    └── Cinemachine Virtual Camera
```

区切りオブジェクト（`--- MANAGERS ---` 等）は空の GameObject で作成し、シーン内の視認性を高める。

---

## 標準ライティング設定（URP）

### Directional Light

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Mode | Mixed | Static + Dynamic 対応 |
| Color | #FFF4D6 | 暖色系の自然光 |
| Intensity | 1.0 | シーンに応じて調整 |
| Shadow Type | Soft Shadows | モバイルでは Hard Shadows に変更 |
| Shadow Resolution | 2048 | モバイルでは 1024 |

### Environment Lighting

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Source | Skybox | Gradient でも可 |
| Intensity Multiplier | 1.0 | |
| Ambient Mode | Baked | リアルタイムは負荷が高い |

### Post Processing Volume

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Is Global | true | シーン全体に適用 |
| Priority | 0 | ローカルボリュームは 1 以上 |
| Bloom | Threshold: 0.9, Intensity: 0.5 | 控えめに設定 |
| Color Adjustments | Post Exposure: 0, Contrast: 10 | |
| Tonemapping | Mode: ACES | 映画的なトーン |

---

## カメラ設定

### Main Camera

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Render Type | Base | |
| Projection | Perspective | 2D の場合は Orthographic |
| FOV | 60 | |
| Clipping Near | 0.3 | Z-fighting 防止 |
| Clipping Far | 1000 | シーン規模に応じて調整 |
| HDR | Use Graphics Settings | |
| Anti-aliasing | MSAA (4x) | モバイルでは 2x または Off |

### Cinemachine Virtual Camera

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Body | Transposer | 3人称: Framing Transposer |
| Aim | Composer | |
| Follow Offset | (0, 5, -10) | ゲームジャンルで調整 |
| Damping | 1.0 | スムーズな追従 |
| Dead Zone | Width: 0.1, Height: 0.1 | |

---

## UI Canvas 基本設定

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Render Mode | Screen Space - Overlay | 3D UI は World Space |
| Canvas Scaler Mode | Scale With Screen Size | |
| Reference Resolution | 1920 x 1080 | |
| Screen Match Mode | Match Width Or Height | |
| Match | 0.5 | 縦横バランス |

---

## EventSystem 設定

Input System Package を使用する場合、EventSystem に `InputSystemUIInputModule` をアタッチする。

| 項目 | 設定 |
|------|------|
| Component | InputSystemUIInputModule |
| Point Action | UI/Point |
| Click Action | UI/Click |
| Scroll Action | UI/ScrollWheel |

レガシー Input Manager の場合は `StandaloneInputModule` を使用する。

---

## C# スクリプトテンプレート

### GameManager.cs

```csharp
using UnityEngine;

/// <summary>
/// ゲーム全体のライフサイクルを管理する Singleton
/// </summary>
public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("Game State")]
    [SerializeField] private GameState _currentState = GameState.MainMenu;

    public GameState CurrentState => _currentState;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    public void ChangeState(GameState newState)
    {
        var previousState = _currentState;
        _currentState = newState;
        Debug.Log($"[GameManager] State changed: {previousState} -> {newState}");
    }
}

public enum GameState
{
    MainMenu,
    Loading,
    Playing,
    Paused,
    GameOver
}
```

### AudioManager.cs

```csharp
using UnityEngine;

/// <summary>
/// BGM/SE の再生を管理する
/// </summary>
public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance { get; private set; }

    [Header("Audio Sources")]
    [SerializeField] private AudioSource _bgmSource;
    [SerializeField] private AudioSource _sfxSource;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    public void PlayBGM(AudioClip clip, float volume = 1f)
    {
        _bgmSource.clip = clip;
        _bgmSource.volume = volume;
        _bgmSource.loop = true;
        _bgmSource.Play();
    }

    public void PlaySFX(AudioClip clip, float volume = 1f)
    {
        _sfxSource.PlayOneShot(clip, volume);
    }
}
```

---

## 使用手順

1. 新規シーンを作成する
2. 上記の階層構成に従い空 GameObject を配置する
3. Directional Light、Post Processing Volume を設定する
4. Main Camera + Cinemachine Virtual Camera を配置する
5. UI Canvas + EventSystem を追加する
6. GameManager、AudioManager スクリプトをアタッチする
7. URP Asset の設定を確認する（Quality Settings → Render Pipeline Asset）

---

## 注意事項

- Cinemachine は Package Manager からインストールが必要（`com.unity.cinemachine`）
- Post Processing は URP に統合済み（Volume コンポーネントを使用）
- Input System Package を使用する場合、Project Settings → Player → Active Input Handling を「Both」または「Input System Package (New)」に設定する
