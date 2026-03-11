# Asset Naming & Folder Structure

アセット命名規約とフォルダ構成に関する必須ルール。チーム全体で一貫性を保ち、検索性と管理性を最大化する。

---

## 1. プレフィックス規約表

| Type | Prefix | Example | 備考 |
|------|--------|---------|------|
| Texture | `T_` | `T_Character_Diffuse` | 用途サフィックス必須 |
| Material | `M_` | `M_Stone_Wet` | |
| Mesh / Model | `SM_` | `SM_Rock_01` | Static Mesh |
| Skeletal Mesh | `SK_` | `SK_Character_Male` | ボーン付きメッシュ |
| Animation Clip | `A_` | `A_Character_Walk` | |
| Animator Controller | `AC_` | `AC_Character_Main` | |
| Prefab | `PF_` | `PF_Enemy_Goblin` | |
| ScriptableObject | `SO_` | `SO_WeaponData_Sword` | |
| Shader | `SH_` | `SH_ToonLit` | |
| Shader Graph | `SHG_` | `SHG_Water_Surface` | |
| UI Sprite | `UI_` | `UI_Button_Primary` | |
| SFX (効果音) | `SFX_` | `SFX_Explosion_01` | |
| BGM (音楽) | `BGM_` | `BGM_Battle_Theme` | |
| Scene | `SCN_` | `SCN_Level_01` | |
| Timeline | `TL_` | `TL_Cutscene_Intro` | |
| Render Texture | `RT_` | `RT_MiniMap` | |
| Physical Material | `PM_` | `PM_Ice` | Physics Material |
| Particle System | `PS_` | `PS_Fire_Torch` | |
| Font | `FNT_` | `FNT_MainUI` | |
| Video Clip | `VID_` | `VID_Intro_Cinematic` | |
| Terrain Layer | `TL_` | `TL_Grass_01` | |

---

## 2. テクスチャサフィックス規約

| サフィックス | 用途 | 例 |
|-------------|------|-----|
| `_Diffuse` / `_D` | ディフューズ / ベースカラー | `T_Brick_Diffuse` |
| `_Normal` / `_N` | ノーマルマップ | `T_Brick_Normal` |
| `_Metallic` / `_M` | メタリックマップ | `T_Brick_Metallic` |
| `_Roughness` / `_R` | ラフネスマップ | `T_Brick_Roughness` |
| `_AO` | アンビエントオクルージョン | `T_Brick_AO` |
| `_Emission` / `_E` | エミッションマップ | `T_Brick_Emission` |
| `_Height` / `_H` | ハイトマップ | `T_Brick_Height` |
| `_Mask` | マスクマップ（パッキング済み） | `T_Brick_Mask` |
| `_Alpha` / `_A` | アルファマップ | `T_Leaf_Alpha` |

---

## 3. 命名の一般ルール

### 基本形式

```
[Prefix]_[Category]_[Descriptor]_[Variant]
```

| 要素 | ルール | 例 |
|------|--------|-----|
| Prefix | アセット種別（上記表参照） | `T_`, `SM_`, `PF_` |
| Category | 所属カテゴリ | `Character`, `Environment`, `UI` |
| Descriptor | 具体的な説明 | `Goblin`, `Stone_Wall`, `Health_Bar` |
| Variant | バリエーション番号 | `_01`, `_02`, `_Red`, `_Large` |

### 禁止事項

| 禁止 | 理由 | 例 |
|------|------|-----|
| スペース | Unity の一部 API で問題 | `My Texture.png` |
| 日本語 | パス長問題、ビルドエラー | `キャラクター_攻撃.anim` |
| 特殊文字 (`!@#$%`) | OS 互換性 | `effect#1.prefab` |
| 連続アンダースコア | 可読性低下 | `T__Wall__01` |
| 大文字始まりでないワード | PascalCase 統一 | `T_wall_brick` |

```
// BAD
My Character Texture.png
キャラクター_idle.anim
SM_rock_small_01.fbx

// GOOD
T_Character_Diffuse.png
A_Character_Idle.anim
SM_Rock_Small_01.fbx
```

---

## 4. フォルダ構成テンプレート

```
Assets/
├── _Project/                    # プロジェクト固有アセット（先頭 _ で最上部に）
│   ├── Art/
│   │   ├── Characters/
│   │   │   ├── Player/
│   │   │   │   ├── Meshes/
│   │   │   │   ├── Textures/
│   │   │   │   ├── Materials/
│   │   │   │   └── Animations/
│   │   │   └── Enemies/
│   │   ├── Environment/
│   │   │   ├── Props/
│   │   │   ├── Terrain/
│   │   │   └── Vegetation/
│   │   ├── UI/
│   │   │   ├── Sprites/
│   │   │   ├── Fonts/
│   │   │   └── Prefabs/
│   │   ├── VFX/
│   │   │   ├── Particles/
│   │   │   ├── Shaders/
│   │   │   └── Textures/
│   │   └── Audio/
│   │       ├── SFX/
│   │       ├── BGM/
│   │       └── Mixers/
│   ├── Scripts/
│   │   ├── Runtime/
│   │   │   ├── Core/
│   │   │   ├── Gameplay/
│   │   │   ├── UI/
│   │   │   └── Infrastructure/
│   │   └── Editor/
│   ├── Prefabs/
│   │   ├── Characters/
│   │   ├── Environment/
│   │   └── UI/
│   ├── Scenes/
│   │   ├── Levels/
│   │   ├── UI/
│   │   └── Test/
│   ├── ScriptableObjects/
│   │   ├── GameData/
│   │   ├── Events/
│   │   └── Settings/
│   ├── Settings/
│   │   ├── Input/
│   │   ├── Rendering/
│   │   └── Quality/
│   └── Addressables/
│       └── Groups/
├── Plugins/                     # ネイティブプラグイン
└── ThirdParty/                  # サードパーティアセット（変更しない）
    ├── TextMeshPro/
    └── DOTween/
```

### フォルダ構成の原則

| 原則 | 説明 |
|------|------|
| 機能別 > 型別 | `Characters/Player/Textures/` > `Textures/Characters/Player/` |
| `_Project` プレフィックス | プロジェクト固有アセットを最上部に |
| `ThirdParty` 分離 | サードパーティは変更しない前提で隔離 |
| `Editor` 分離 | Editor スクリプトはビルドに含めない |
| 階層は最大 5 段 | 深すぎるとパスが長くなる |

---

## 5. .meta ファイル管理ルール

| ルール | 理由 |
|--------|------|
| `.meta` ファイルは必ず Git にコミット | GUID 管理。欠落するとアセット参照が壊れる |
| アセット移動は Unity Editor 内で行う | Explorer/Finder で移動すると `.meta` が追従しない |
| `.meta` ファイルのみの削除は禁止 | アセットの GUID が失われ、全参照が壊れる |
| フォルダにも `.meta` が存在する | フォルダ削除時は `.meta` も削除する |
| Version Control Mode は `Visible Meta Files` | Project Settings > Editor |

```
// .gitattributes で .meta をテキストとして扱う
*.meta text eol=lf
```

---

## 6. バリアント・LOD の命名

### LOD レベル

```
SM_Rock_01_LOD0.fbx    # 最高品質（カメラ近距離）
SM_Rock_01_LOD1.fbx    # 中品質
SM_Rock_01_LOD2.fbx    # 低品質（カメラ遠距離）
SM_Rock_01_LOD3.fbx    # 最低品質 / Billboard
```

### カラーバリアント / サイズバリアント

```
M_Fabric_Red.mat
M_Fabric_Blue.mat
M_Fabric_Green.mat

SM_Crate_Small.fbx
SM_Crate_Medium.fbx
SM_Crate_Large.fbx

T_Wood_Light_Diffuse.png
T_Wood_Dark_Diffuse.png
```

### プラットフォーム別テクスチャ

```
T_Character_Diffuse.png       # デフォルト（PC）
T_Character_Diffuse_Mobile.png  # モバイル用（低解像度）
```

---

## 7. 命名規約の強制（Editor スクリプト）

```csharp
#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using System.IO;
using System.Text.RegularExpressions;

public class AssetNamingValidator : AssetPostprocessor
{
    private static readonly (string extension, string prefix)[] Rules =
    {
        (".png", "T_"), (".tga", "T_"), (".psd", "T_"),
        (".mat", "M_"),
        (".fbx", "SM_"),  // SK_ も許容
        (".prefab", "PF_"),
        (".asset", "SO_"),
        (".shader", "SH_"),
        (".unity", "SCN_"),
        (".wav", "SFX_"),  // BGM_ も許容
        (".mp3", "BGM_"),
    };

    private void OnPreprocessAsset()
    {
        string fileName = Path.GetFileName(assetPath);
        string ext = Path.GetExtension(assetPath).ToLower();

        // ThirdParty は除外
        if (assetPath.Contains("ThirdParty/")) return;
        if (assetPath.Contains("Packages/")) return;

        foreach (var (extension, prefix) in Rules)
        {
            if (ext == extension && !fileName.StartsWith(prefix))
            {
                // SK_ や BGM_ など代替プレフィックスもチェック
                if (ext == ".fbx" && fileName.StartsWith("SK_")) continue;
                if (ext == ".wav" && fileName.StartsWith("BGM_")) continue;

                Debug.LogWarning(
                    $"[Naming] '{fileName}' should start with '{prefix}'. " +
                    $"Path: {assetPath}");
            }
        }

        // スペース検出
        if (fileName.Contains(" "))
        {
            Debug.LogError(
                $"[Naming] '{fileName}' contains spaces. " +
                $"Use underscores instead. Path: {assetPath}");
        }
    }
}
#endif
```

---

## チェックリスト

### アセット追加時
- [ ] プレフィックス規約に従っているか
- [ ] テクスチャにサフィックス（`_Diffuse`, `_Normal` 等）が付いているか
- [ ] ファイル名にスペースや日本語が含まれていないか
- [ ] 適切なフォルダに配置したか（機能別構成）
- [ ] `.meta` ファイルが Git に含まれているか

### LOD / バリアント追加時
- [ ] LOD 命名 (`_LOD0`, `_LOD1`) に従っているか
- [ ] バリアント命名が一貫しているか（`_Red`, `_01` 等）
- [ ] LOD Group コンポーネントの設定が正しいか

### レビュー時
- [ ] フォルダ階層が 5 段以下か
- [ ] ThirdParty アセットが隔離されているか
- [ ] Editor スクリプトが `Editor/` フォルダ内にあるか
- [ ] Version Control Mode が `Visible Meta Files` に設定されているか
