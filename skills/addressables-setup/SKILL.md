---
name: addressables-setup
description: Set up Unity Addressables with group configuration, remote catalog design, and memory-efficient asset loading patterns.
---

# Addressables 初期設定ガイド

Unity Addressables のグループ構成設計、リモートカタログ設計、メモリ効率的なロード/アンロードパターンを提供する。

---

## 初期設定手順

1. Package Manager から `Addressables` をインストール（`com.unity.addressables`）
2. Window → Asset Management → Addressables → Groups を開く
3. 「Create Addressables Settings」を実行
4. `AddressableAssetSettings.asset` が `Assets/AddressableAssetsData/` に生成される

### 基本設定

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| Build Remote Catalog | true | リモート更新対応 |
| Send Profiler Events | true (開発) / false (リリース) | Event Viewer 用 |
| Log Runtime Exceptions | true | デバッグ用 |
| Catalog Download Timeout | 30 | 秒 |
| Max Concurrent Web Requests | 3 | モバイル回線考慮 |

---

## グループ構成設計

### 推奨グループ構成

| グループ名 | 説明 | Build Path | Load Path |
|-----------|------|-----------|-----------|
| Default Local Group | 起動時に必須のアセット | LocalBuildPath | LocalLoadPath |
| Core UI | 共通 UI アセット | LocalBuildPath | LocalLoadPath |
| Level_01 ~ Level_N | レベルごとのアセット | RemoteBuildPath | RemoteLoadPath |
| Characters | キャラクターモデル・アニメ | RemoteBuildPath | RemoteLoadPath |
| Audio_BGM | BGM（サイズ大） | RemoteBuildPath | RemoteLoadPath |
| Audio_SFX | 効果音 | LocalBuildPath | LocalLoadPath |
| DLC_Pack_01 | 追加コンテンツ | RemoteBuildPath | RemoteLoadPath |

### グループ設計の原則

```
Local Groups（アプリに同梱、初回起動で利用可能）
  ├── Default Local: 起動必須アセット
  ├── Core UI: 共通 UI スプライト・フォント
  └── Audio SFX: 効果音

Remote Groups（CDN から配信、必要時にダウンロード）
  ├── Levels: レベルごとに分割
  ├── Characters: キャラクター単位
  ├── Audio BGM: 楽曲単位
  └── DLC: パック単位
```

---

## ラベル設計

### 用途別ラベル

| ラベル | 用途 | 例 |
|-------|------|-----|
| `preload` | アプリ起動時にプリロード | ロード画面 UI、共通シェーダー |
| `level-01` ~ `level-N` | レベル進入時にロード | レベルごとのアセット |
| `character-player` | プレイヤー選択時にロード | プレイヤーモデル |
| `character-enemy` | 敵キャラ出現時にロード | 敵モデル |
| `audio-bgm` | BGM 再生時にロード | 楽曲 |
| `dlc-pack-01` | DLC 購入後にダウンロード | 追加コンテンツ |

### ラベルの命名規則

```
<カテゴリ>-<識別子>
例: level-01, character-warrior, audio-battle-bgm
```

---

## リモートカタログ設計（CDN 配信）

### ビルドパス設定

```
Remote Build Path:  ServerData/[BuildTarget]
Remote Load Path:   https://cdn.example.com/assets/[BuildTarget]
```

### CDN 構成

```
https://cdn.example.com/assets/
├── Android/
│   ├── catalog_YYYY.MM.DD.HH.mm.ss.hash
│   ├── catalog_YYYY.MM.DD.HH.mm.ss.json
│   └── bundles/
│       ├── level_01_xxxx.bundle
│       ├── characters_xxxx.bundle
│       └── ...
├── iOS/
│   └── (同様)
└── StandaloneWindows64/
    └── (同様)
```

### カタログ更新フロー

```
アプリ起動
  ├→ Addressables.InitializeAsync()
  ├→ カタログ更新チェック
  │     ├→ 更新あり → 新カタログダウンロード
  │     └→ 更新なし → ローカルカタログ使用
  └→ ゲーム開始
```

---

## ロード/アンロードパターン

### 基本ロードパターン

```csharp
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;
using System.Threading.Tasks;

/// <summary>
/// Addressables のロード/アンロードを管理する
/// </summary>
public class AssetLoader
{
    /// <summary>
    /// 単一アセットをロードする
    /// </summary>
    public async Task<T> LoadAssetAsync<T>(string address) where T : Object
    {
        var handle = Addressables.LoadAssetAsync<T>(address);
        await handle.Task;

        if (handle.Status == AsyncOperationStatus.Succeeded)
        {
            return handle.Result;
        }

        Debug.LogError($"[AssetLoader] Failed to load: {address}");
        Addressables.Release(handle);
        return null;
    }

    /// <summary>
    /// ラベルで複数アセットをロードする
    /// </summary>
    public async Task<System.Collections.Generic.IList<T>>
        LoadAssetsByLabelAsync<T>(string label) where T : Object
    {
        var handle = Addressables.LoadAssetsAsync<T>(label, null);
        await handle.Task;

        if (handle.Status == AsyncOperationStatus.Succeeded)
        {
            return handle.Result;
        }

        Debug.LogError($"[AssetLoader] Failed to load label: {label}");
        Addressables.Release(handle);
        return null;
    }

    /// <summary>
    /// GameObject をインスタンス化する
    /// </summary>
    public async Task<GameObject> InstantiateAsync(
        string address, Transform parent = null)
    {
        var handle = Addressables.InstantiateAsync(address, parent);
        await handle.Task;

        if (handle.Status == AsyncOperationStatus.Succeeded)
        {
            return handle.Result;
        }

        Debug.LogError($"[AssetLoader] Failed to instantiate: {address}");
        return null;
    }

    /// <summary>
    /// インスタンスを解放する
    /// </summary>
    public void ReleaseInstance(GameObject instance)
    {
        if (instance != null)
        {
            Addressables.ReleaseInstance(instance);
        }
    }
}
```

### プリロード戦略

```csharp
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;
using System.Collections.Generic;
using System.Threading.Tasks;

/// <summary>
/// レベル遷移時のプリロードを管理する
/// </summary>
public class LevelPreloader
{
    private readonly List<AsyncOperationHandle> _handles = new();

    /// <summary>
    /// レベルのアセットをプリロードする
    /// </summary>
    public async Task PreloadLevelAsync(
        string levelLabel, System.Action<float> onProgress = null)
    {
        var sizeHandle = Addressables.GetDownloadSizeAsync(levelLabel);
        await sizeHandle.Task;
        long downloadSize = sizeHandle.Result;
        Addressables.Release(sizeHandle);

        if (downloadSize > 0)
        {
            Debug.Log($"[Preloader] Downloading: "
                + $"{downloadSize / 1024f / 1024f:F1}MB");

            var downloadHandle =
                Addressables.DownloadDependenciesAsync(levelLabel);
            while (!downloadHandle.IsDone)
            {
                onProgress?.Invoke(downloadHandle.PercentComplete);
                await Task.Yield();
            }
            _handles.Add(downloadHandle);
        }

        var loadHandle = Addressables.LoadAssetsAsync<Object>(
            levelLabel, null);
        await loadHandle.Task;
        _handles.Add(loadHandle);

        Debug.Log($"[Preloader] Level preloaded: {levelLabel}");
    }

    /// <summary>
    /// プリロードしたアセットをすべて解放する
    /// </summary>
    public void UnloadAll()
    {
        foreach (var handle in _handles)
        {
            Addressables.Release(handle);
        }
        _handles.Clear();
        Debug.Log("[Preloader] All preloaded assets released.");
    }
}
```

### 参照カウント管理

Addressables は参照カウント方式でメモリを管理する。

```
LoadAssetAsync("enemy")   → refCount = 1
LoadAssetAsync("enemy")   → refCount = 2
Release(handle1)          → refCount = 1  (まだメモリに残る)
Release(handle2)          → refCount = 0  (メモリから解放)
```

ルール:
- `LoadAssetAsync` したら必ず対応する `Release` を呼ぶ
- `InstantiateAsync` したら `ReleaseInstance` で解放する
- シーン遷移時は `UnloadAll` で一括解放する

---

## トラブルシューティング

### ロード失敗

| 症状 | 原因 | 対策 |
|------|------|------|
| `InvalidKeyException` | アドレスが存在しない | Addressables Groups でアドレスを確認 |
| `RemoteProviderException` | CDN からダウンロード失敗 | URL、CORS、証明書を確認 |
| `OperationException` | バンドルの互換性エラー | カタログを再ビルド |

### メモリリーク

| 症状 | 原因 | 対策 |
|------|------|------|
| メモリが増加し続ける | Release 漏れ | Event Viewer で refCount 確認 |
| シーン遷移でメモリが減らない | Handle 未解放 | UnloadAll を実装 |
| 同じアセットが複数回ロード | キャッシュ未使用 | ロード結果をキャッシュ |

### Event Viewer での確認

1. Window → Asset Management → Addressables → Event Viewer を開く
2. Play モードで実行
3. 確認項目:
   - ロード/アンロードの対応が取れているか
   - refCount が 0 に戻っているか
   - 不要なアセットが残っていないか

---

## 注意事項

- Addressables は非同期 API のため、同期ロード（`WaitForCompletion`）は避ける
- WebGL では `UnityWebRequest` ベースのため、CORS 設定が必要
- バンドルのビルドは時間がかかるため、開発中は "Use Asset Database (fastest)" モードを使用する
- リモートカタログの URL を変更する場合、既存ユーザーのキャッシュに注意する
