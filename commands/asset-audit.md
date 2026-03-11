---
description: Audit Unity project assets for naming convention violations, oversized files, duplicates, and import setting issues.
---

# Asset Audit

Unity プロジェクトのアセットを監査する。命名規約違反、ファイルサイズ超過、重複アセット、Import Settings の不備を検出する。

---

## 監査項目

### 1. 命名規約チェック

| アセット種別 | 命名規則 | 例 |
|-------------|---------|-----|
| テクスチャ | `T_<Name>_<Suffix>` | `T_Character_D` (Diffuse), `T_Wall_N` (Normal) |
| マテリアル | `M_<Name>` | `M_Character_Body` |
| メッシュ | `SM_<Name>` / `SK_<Name>` | `SM_Rock_01` (Static), `SK_Character` (Skeletal) |
| アニメーション | `A_<Name>_<Action>` | `A_Character_Walk` |
| プレハブ | `P_<Name>` | `P_Enemy_Goblin` |
| シェーダー | `S_<Name>` | `S_ToonLit` |
| スクリプト | PascalCase | `PlayerController.cs` |
| シーン | PascalCase | `MainMenu.unity` |
| ScriptableObject | `SO_<Name>` | `SO_WeaponData` |

違反を検出した場合、正しい名前の候補を提示する。

### 2. ファイルサイズチェック

| アセット種別 | 警告閾値 | エラー閾値 |
|-------------|---------|-----------|
| テクスチャ (Max Size) | > 2048 | > 4096 |
| テクスチャ (ファイルサイズ) | > 5MB | > 20MB |
| メッシュ (三角形数) | > 50K tri | > 100K tri |
| オーディオ (ファイルサイズ) | > 10MB | > 50MB |
| アニメーション (キーフレーム) | > 1000 keys | > 5000 keys |
| プレハブ (ネスト深度) | > 5 levels | > 10 levels |

### 3. 重複アセット検出

以下の基準で重複を検出する。

- 同一ハッシュ値のテクスチャ / メッシュ
- 同一名で異なるフォルダに存在するアセット
- 類似名のアセット（Levenshtein 距離ベース）

### 4. Import Settings チェック

| アセット | チェック項目 | 推奨設定 |
|---------|-------------|---------|
| テクスチャ | Read/Write Enabled | OFF（特別な理由がない限り） |
| テクスチャ | Generate Mipmaps | 3D: ON, UI: OFF |
| テクスチャ | sRGB | Color: ON, Normal/Mask: OFF |
| テクスチャ | Compression | プラットフォーム別圧縮設定あり |
| メッシュ | Read/Write Enabled | OFF |
| メッシュ | Optimize Mesh | ON |
| メッシュ | Mesh Compression | Medium 以上 |
| オーディオ | Force To Mono | 効果音: ON |
| オーディオ | Load Type | BGM: Streaming, SE: Decompress On Load |

### 5. 未使用アセット検出

- Build に含まれないアセットの検出
- どのシーン / プレハブからも参照されていないアセットの検出
- `Resources/` フォルダ内の未使用アセット

---

## レポート出力フォーマット

```markdown
## Asset Audit Report

### Summary
- Errors: N 件
- Warnings: N 件
- Info: N 件
- Total Assets Scanned: N 件

### Naming Convention Violations (N 件)
| ファイル | 現在の名前 | 推奨名 | 重要度 |
|---------|-----------|--------|--------|
| Assets/Textures/wall.png | wall | T_Wall_D | WARNING |

### Oversized Assets (N 件)
| ファイル | サイズ | 閾値 | 重要度 |
|---------|--------|------|--------|
| Assets/Textures/bg.png | 8192x8192 | 4096 | ERROR |

### Duplicate Assets (N 件)
| アセット A | アセット B | 類似度 |
|-----------|-----------|--------|
| Assets/Textures/rock.png | Assets/Old/rock.png | 100% |

### Import Setting Issues (N 件)
| ファイル | 項目 | 現在値 | 推奨値 |
|---------|------|--------|--------|
| Assets/UI/icon.png | Mipmaps | ON | OFF |

### Unused Assets (N 件)
| ファイル | 最終更新 | サイズ |
|---------|---------|--------|
| Assets/Old/unused.prefab | 2025-01-01 | 1.2MB |
```

---

## 使用例

```
/asset-audit
/asset-audit Assets/Textures/
/asset-audit --fix-naming
```

`--fix-naming` オプションで命名規約違反を自動修正する（確認プロンプトあり）。
