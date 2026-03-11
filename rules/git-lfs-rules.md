# Git LFS Rules

Unity プロジェクトにおける Git LFS 設定とバイナリアセット管理に関する必須ルール。

---

## 1. .gitattributes テンプレート

プロジェクトルートに配置する `.gitattributes`。Unity プロジェクトで LFS 追跡すべきファイル拡張子を網羅する。

```gitattributes
# ============================================================
# Unity Git LFS Configuration
# ============================================================

# --- 3D Models ---
*.fbx filter=lfs diff=lfs merge=lfs -text
*.obj filter=lfs diff=lfs merge=lfs -text
*.blend filter=lfs diff=lfs merge=lfs -text
*.dae filter=lfs diff=lfs merge=lfs -text
*.3ds filter=lfs diff=lfs merge=lfs -text
*.max filter=lfs diff=lfs merge=lfs -text
*.ma filter=lfs diff=lfs merge=lfs -text
*.mb filter=lfs diff=lfs merge=lfs -text

# --- Textures / Images ---
*.png filter=lfs diff=lfs merge=lfs -text
*.psd filter=lfs diff=lfs merge=lfs -text
*.tga filter=lfs diff=lfs merge=lfs -text
*.tif filter=lfs diff=lfs merge=lfs -text
*.tiff filter=lfs diff=lfs merge=lfs -text
*.exr filter=lfs diff=lfs merge=lfs -text
*.hdr filter=lfs diff=lfs merge=lfs -text
*.bmp filter=lfs diff=lfs merge=lfs -text
*.jpg filter=lfs diff=lfs merge=lfs -text
*.jpeg filter=lfs diff=lfs merge=lfs -text
*.gif filter=lfs diff=lfs merge=lfs -text
*.svg filter=lfs diff=lfs merge=lfs -text

# --- Audio ---
*.wav filter=lfs diff=lfs merge=lfs -text
*.mp3 filter=lfs diff=lfs merge=lfs -text
*.ogg filter=lfs diff=lfs merge=lfs -text
*.aiff filter=lfs diff=lfs merge=lfs -text
*.flac filter=lfs diff=lfs merge=lfs -text

# --- Video ---
*.mp4 filter=lfs diff=lfs merge=lfs -text
*.mov filter=lfs diff=lfs merge=lfs -text
*.avi filter=lfs diff=lfs merge=lfs -text
*.webm filter=lfs diff=lfs merge=lfs -text

# --- Fonts ---
*.ttf filter=lfs diff=lfs merge=lfs -text
*.otf filter=lfs diff=lfs merge=lfs -text
*.woff filter=lfs diff=lfs merge=lfs -text
*.woff2 filter=lfs diff=lfs merge=lfs -text

# --- Unity Specific ---
*.cubemap filter=lfs diff=lfs merge=lfs -text
*.unitypackage filter=lfs diff=lfs merge=lfs -text
*.asset filter=lfs diff=lfs merge=lfs -text
*.lighting filter=lfs diff=lfs merge=lfs -text

# --- Archives ---
*.zip filter=lfs diff=lfs merge=lfs -text
*.7z filter=lfs diff=lfs merge=lfs -text
*.rar filter=lfs diff=lfs merge=lfs -text
*.tar.gz filter=lfs diff=lfs merge=lfs -text

# --- Compiled / Libraries ---
*.dll filter=lfs diff=lfs merge=lfs -text
*.so filter=lfs diff=lfs merge=lfs -text
*.dylib filter=lfs diff=lfs merge=lfs -text
*.a filter=lfs diff=lfs merge=lfs -text

# --- Unity YAML (text, not LFS) ---
*.unity text eol=lf merge=unityyamlmerge
*.prefab text eol=lf merge=unityyamlmerge
*.mat text eol=lf
*.meta text eol=lf
*.anim text eol=lf
*.controller text eol=lf
*.overrideController text eol=lf
*.physicMaterial text eol=lf
*.physicsMaterial2D text eol=lf
*.playable text eol=lf
*.mask text eol=lf
*.brush text eol=lf
*.flare text eol=lf
*.fontsettings text eol=lf
*.guiskin text eol=lf
*.giparams text eol=lf
*.renderTexture text eol=lf
*.spriteatlas text eol=lf
*.terrainlayer text eol=lf
*.mixer text eol=lf
*.shadervariants text eol=lf
*.preset text eol=lf
*.signal text eol=lf

# --- Scripts (text) ---
*.cs text eol=lf diff=csharp
*.shader text eol=lf
*.hlsl text eol=lf
*.cginc text eol=lf
*.compute text eol=lf
```

---

## 2. LFS vs 通常 Git の判断基準

| 基準 | 通常 Git | LFS |
|------|---------|------|
| ファイルサイズ | < 1 MB | >= 1 MB |
| バイナリファイル | テキストベース | バイナリ |
| 変更頻度 | 高い（テキスト diff が有用） | 低い〜中程度 |
| マージ可能性 | マージ可能 | マージ不可能 |
| 例 | `.cs`, `.shader`, `.meta`, `.unity` | `.fbx`, `.png`, `.wav` |

### 例外ケース

| ファイル | サイズ | 判断 | 理由 |
|---------|--------|------|------|
| `.unity` (Scene) | 大きい場合あり | 通常 Git | YAML テキスト、マージ可能 |
| `.prefab` | 通常 < 1 MB | 通常 Git | YAML テキスト、マージ可能 |
| `.asset` (SO) | 通常 < 1 MB | LFS | バイナリ含む可能性 |
| `.png` (64x64 icon) | < 10 KB | LFS | 拡張子ベースで統一管理 |

**原則:** 拡張子ベースで統一する。個別ファイルのサイズで例外を作らない。

---

## 3. LFS 設定手順

```bash
# 1. Git LFS のインストール（初回のみ）
git lfs install

# 2. .gitattributes の配置（上記テンプレートを使用）
# プロジェクトルートに配置

# 3. 既存リポジトリに LFS を追加する場合
git lfs migrate import --include="*.fbx,*.png,*.psd,*.wav,*.mp3,*.ogg"

# 4. LFS で追跡中のファイルを確認
git lfs ls-files

# 5. LFS の状態を確認
git lfs status

# 6. LFS ストレージ使用量を確認（GitHub）
git lfs env
```

### チーム新規メンバーの手順

```bash
# 1. Git LFS をインストール
git lfs install

# 2. リポジトリをクローン（LFS ファイルも自動ダウンロード）
git clone <repository-url>

# 3. LFS ファイルが正しくダウンロードされたか確認
git lfs pull
```

---

## 4. 大容量アセットの管理戦略

### 戦略比較

| 戦略 | 適用場面 | メリット | デメリット |
|------|---------|---------|-----------|
| Git LFS | チーム全員が必要 | シンプル | ストレージコスト |
| Addressables Remote | ランタイムロード | リポジトリ軽量化 | CDN 設定が必要 |
| 外部ストレージ (S3 等) | 超大容量 (> 10 GB) | コスト効率 | 手動管理 |
| Git Submodule | アセットパック分離 | リポジトリ分割 | 運用複雑 |

### Addressables Remote のフォルダ分離

```
Assets/
├── _Project/
│   ├── BundledAssets/          # Addressables Remote（LFS 不要）
│   │   ├── Cutscenes/
│   │   ├── VoiceOver/
│   │   └── HighResTextures/
│   └── LocalAssets/            # ビルドに含める（LFS 管理）
│       ├── Characters/
│       └── Core/
```

---

## 5. Unity Smart Merge Tool 設定

### UnityYAMLMerge の設定

Unity YAML ファイル（Scene, Prefab）のマージを支援する公式ツール。

```bash
# .gitconfig または .git/config に追加
[merge "unityyamlmerge"]
    name = Unity YAML Merge
    driver = '<Unity Editor Path>/Data/Tools/UnityYAMLMerge' merge -p %O %A %B %A
    recursive = binary
```

### プラットフォーム別パス

| OS | Unity Editor パス例 |
|----|---------------------|
| Windows | `C:/Program Files/Unity/Hub/Editor/2022.3.x/Editor/Data/Tools/UnityYAMLMerge.exe` |
| macOS | `/Applications/Unity/Hub/Editor/2022.3.x/Unity.app/Contents/Tools/UnityYAMLMerge` |
| Linux | `/opt/unity/Editor/Data/Tools/UnityYAMLMerge` |

---

## 6. Scene / Prefab のマージ戦略

Scene / Prefab ファイルは YAML テキストだが、実質的にマージが困難な場合が多い。

### マージ回避のルール

| ルール | 理由 |
|--------|------|
| 1 Scene を同時に 2 人が編集しない | コンフリクト頻発 |
| Scene を小さく分割する（Additive Loading） | 競合範囲を最小化 |
| Prefab の Nested Prefab を活用 | 独立した変更単位 |
| Scene の変更は短いブランチで | 長期ブランチは競合リスク増大 |
| コンフリクト時は片方を採用 | 手動マージは危険 |

### Scene ロックの運用（Git LFS File Locking）

```bash
# Scene ファイルをロック（編集開始前）
git lfs lock Assets/_Project/Scenes/SCN_Level_01.unity

# ロック中のファイルを確認
git lfs locks

# ロックを解除（編集完了後）
git lfs unlock Assets/_Project/Scenes/SCN_Level_01.unity

# 他者のロックを強制解除（管理者のみ）
git lfs unlock --force Assets/_Project/Scenes/SCN_Level_01.unity
```

---

## 7. .gitignore テンプレート（Unity 用）

```gitignore
# ============================================================
# Unity .gitignore
# ============================================================

# --- Unity Generated ---
/[Ll]ibrary/
/[Tt]emp/
/[Oo]bj/
/[Bb]uild/
/[Bb]uilds/
/[Ll]ogs/
/[Uu]ser[Ss]ettings/

# --- Memory Profiler ---
/MemoryCaptures/

# --- Asset Bundles ---
/*.csproj
/*.unityproj
/*.sln
/*.suo
/*.tmp
/*.user
/*.userprefs
/*.pidb
/*.booproj
/*.svd
/*.pdb
/*.mdb
/*.opendb
/*.VC.db

# --- OS ---
.DS_Store
Thumbs.db
desktop.ini

# --- IDE ---
/.idea/
/.vs/
/.vscode/
*.swp
*.swo

# --- Rider ---
.idea/
*.DotSettings.user

# --- Builds ---
*.apk
*.aab
*.ipa
*.exe
*.app

# --- Crashlytics ---
crashlytics-build.properties

# --- Addressables Build ---
/[Aa]ssets/[Aa]ddressable[Aa]ssets[Dd]ata/*/*.bin*
/[Aa]ssets/[Ss]treamingAssets/aa.meta
/[Aa]ssets/[Ss]treamingAssets/aa/*

# --- Test Results ---
test-results/

# --- Packaging ---
*.unitypackage
```

---

## 8. ブランチ運用とバイナリアセット

| ブランチ戦略 | バイナリ扱い |
|-------------|-------------|
| `main` | 安定版のアセットのみ |
| `develop` | 開発中アセットを含む |
| `feature/art-*` | アート系変更は専用ブランチ |
| `feature/code-*` | コードのみ（アセット変更なし） |

**コードとアートの変更を同じブランチに混ぜない。** LFS の差分管理が効率化される。

---

## チェックリスト

### プロジェクトセットアップ時
- [ ] `.gitattributes` を配置し、LFS 追跡ルールを設定したか
- [ ] `.gitignore` が Unity 用テンプレートに準拠しているか
- [ ] チーム全員が `git lfs install` を実行したか
- [ ] UnityYAMLMerge が設定されているか
- [ ] Editor Settings で Version Control Mode が `Visible Meta Files` か
- [ ] Editor Settings で Asset Serialization Mode が `Force Text` か

### 日常運用
- [ ] Scene 編集前に `git lfs lock` でロックしたか
- [ ] 編集完了後に `git lfs unlock` で解除したか
- [ ] コードとアートの変更を別ブランチで管理しているか
- [ ] 大容量アセット（> 100 MB）は外部ストレージを検討したか

### レビュー時
- [ ] 新しいバイナリ拡張子が `.gitattributes` に追加されているか
- [ ] LFS ストレージ使用量が上限に近づいていないか
- [ ] `.meta` ファイルがコミットに含まれているか
