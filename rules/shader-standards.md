# Shader Standards

シェーダー記述に関する必須ルール。SRP Batcher 互換性、バリアント管理、プラットフォーム最適化を徹底する。

---

## 1. URP / HDRP / Built-in 対応ガイド

| 項目 | URP | HDRP | Built-in |
|------|-----|------|----------|
| シェーディング言語 | HLSL | HLSL | CG (HLSLPROGRAM も可) |
| インクルード | `Packages/com.unity.render-pipelines.universal/` | `Packages/com.unity.render-pipelines.high-definition/` | `UnityCG.cginc` |
| ライティングモデル | `UniversalFragmentPBR()` | `SurfaceData` + `BSDFData` | `surf` 関数 (Surface Shader) |
| SRP Batcher | 対応必須 | 対応必須 | 非対応 |
| Shader Graph | 推奨 | 推奨 | 非対応 |
| 推奨用途 | モバイル〜PC | ハイエンド PC/コンソール | レガシープロジェクト |

```hlsl
// URP Lit シェーダーの基本構造
Shader "Custom/URP_Example"
{
    Properties
    {
        _BaseMap ("Base Map", 2D) = "white" {}
        _BaseColor ("Base Color", Color) = (1, 1, 1, 1)
        _Smoothness ("Smoothness", Range(0, 1)) = 0.5
    }

    SubShader
    {
        Tags
        {
            "RenderType" = "Opaque"
            "RenderPipeline" = "UniversalPipeline"
            "Queue" = "Geometry"
        }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS
            #pragma multi_compile _ _ADDITIONAL_LIGHTS

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            // SRP Batcher 互換: CBUFFER で囲む
            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                half4 _BaseColor;
                half _Smoothness;
            CBUFFER_END

            TEXTURE2D(_BaseMap);
            SAMPLER(sampler_BaseMap);

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float2 uv : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float3 positionWS : TEXCOORD2;
            };

            Varyings vert(Attributes input)
            {
                Varyings output;
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                return output;
            }

            half4 frag(Varyings input) : SV_Target
            {
                half4 baseMap = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv);
                half4 color = baseMap * _BaseColor;

                // ライティング計算
                InputData inputData = (InputData)0;
                inputData.positionWS = input.positionWS;
                inputData.normalWS = normalize(input.normalWS);
                inputData.viewDirectionWS = GetWorldSpaceNormalizeViewDir(input.positionWS);

                SurfaceData surfaceData = (SurfaceData)0;
                surfaceData.albedo = color.rgb;
                surfaceData.smoothness = _Smoothness;
                surfaceData.alpha = color.a;

                return UniversalFragmentPBR(inputData, surfaceData);
            }
            ENDHLSL
        }
    }
}
```

---

## 2. SRP Batcher 互換性ルール

SRP Batcher はマテリアルプロパティを GPU 上に持続的に保持し、SetPass Calls を削減する。

### 必須ルール

1. すべてのマテリアルプロパティを `CBUFFER_START(UnityPerMaterial)` で囲む
2. テクスチャは CBUFFER の外に宣言する
3. テクスチャの `_ST` 変数は CBUFFER 内に含める

```hlsl
// GOOD: SRP Batcher 互換
CBUFFER_START(UnityPerMaterial)
    float4 _BaseMap_ST;
    half4 _BaseColor;
    half _Metallic;
    half _Smoothness;
CBUFFER_END

TEXTURE2D(_BaseMap);
SAMPLER(sampler_BaseMap);
TEXTURE2D(_NormalMap);
SAMPLER(sampler_NormalMap);

// BAD: CBUFFER なし（SRP Batcher 非互換）
float4 _BaseMap_ST;
half4 _BaseColor;
sampler2D _BaseMap;
```

### 互換性確認方法

Inspector > Shader > "SRP Batcher" の表示が "compatible" であることを確認する。

---

## 3. シェーダーバリアント管理

### multi_compile vs shader_feature 比較表

| 項目 | multi_compile | shader_feature |
|------|--------------|----------------|
| ビルド時 | 全組み合わせをコンパイル | 使用中のものだけコンパイル |
| ランタイム切り替え | 可能 | 不可（ビルド時に確定） |
| バリアント数への影響 | 爆発しやすい | 最小限に抑えられる |
| 用途 | グローバルキーワード（フォグ、シャドウ） | マテリアル固有のオプション |
| 推奨 | Unity 内部キーワードのみ | カスタムキーワードはこちら |

### バリアント爆発の計算

```
// 各 multi_compile 行のキーワード数を掛け算
#pragma multi_compile _ _SHADOWS_SOFT        // 2 variants
#pragma multi_compile _ _MAIN_LIGHT_SHADOWS  // 2 variants
#pragma multi_compile _ FOG_LINEAR FOG_EXP   // 3 variants
#pragma multi_compile _ _ADDITIONAL_LIGHTS   // 2 variants

// 合計: 2 x 2 x 3 x 2 = 24 variants（この Pass だけで）
```

**削減策:**

```hlsl
// BAD: 不要なバリアントが大量生成
#pragma multi_compile _ _FEATURE_A _FEATURE_B _FEATURE_C

// GOOD: マテリアル単位なら shader_feature
#pragma shader_feature_local _ _FEATURE_A _FEATURE_B _FEATURE_C
// _local でグローバルキーワードスロット消費を防止
```

---

## 4. モバイル向け最適化

### half precision の活用

```hlsl
// GOOD: モバイルでは half を積極使用
half4 frag(Varyings input) : SV_Target
{
    half4 baseColor = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv);
    half3 normal = normalize(input.normalWS);
    half NdotL = saturate(dot(normal, _MainLightDirection.xyz));
    half3 diffuse = baseColor.rgb * NdotL * _MainLightColor.rgb;
    return half4(diffuse, baseColor.a);
}

// BAD: 不要な float（モバイル GPU で遅い）
float4 frag(Varyings input) : SV_Target
{
    float4 baseColor = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv);
    float3 normal = normalize(input.normalWS);
    // ...
}
```

### モバイルで避けるべきパターン

| パターン | 問題 | 代替 |
|---------|------|------|
| `discard` / `clip()` 乱用 | Early-Z 無効化、Tile-Based GPU で非効率 | Alpha to Coverage, Alpha Test 閾値を限定 |
| 動的分岐 (`if`) | GPU のウェーブ実行で全パス実行 | `step()` / `lerp()` で分岐除去 |
| `pow()` の過剰使用 | 高コスト数学関数 | 近似式、LUT テクスチャ |
| Fragment での normalize 多用 | 帯域消費 | Vertex で計算して補間 |
| 複雑な Post-Processing | Fillrate ボトルネック | モバイル向け軽量版を用意 |

```hlsl
// BAD: 動的分岐
if (_UseEmission > 0.5)
{
    color += emissionColor;
}

// GOOD: 分岐なしの数学的表現
color += emissionColor * step(0.5, _UseEmission);
```

---

## 5. ShaderLab プロパティ命名規約

| プロパティ名 | 用途 | 型 |
|-------------|------|-----|
| `_MainTex` / `_BaseMap` | メインテクスチャ | 2D |
| `_Color` / `_BaseColor` | メインカラー | Color |
| `_NormalMap` / `_BumpMap` | ノーマルマップ | 2D |
| `_MetallicGlossMap` | メタリック/スムースネス | 2D |
| `_Metallic` | メタリック値 | Range(0,1) |
| `_Smoothness` | スムースネス値 | Range(0,1) |
| `_EmissionMap` | エミッションマップ | 2D |
| `_EmissionColor` | エミッション色 | Color (HDR) |
| `_OcclusionMap` | アンビエントオクルージョン | 2D |
| `_Cutoff` | Alpha Cutoff 閾値 | Range(0,1) |

**命名規則:** アンダースコアプレフィックス `_` + PascalCase。URP/HDRP の標準名に合わせる。

---

## 6. Shader Graph vs コードシェーダー 判断基準

| 条件 | Shader Graph | コードシェーダー |
|------|-------------|----------------|
| アーティストが調整する | 推奨 | - |
| 複雑な数学/アルゴリズム | - | 推奨 |
| Compute Shader 連携 | - | 必須 |
| バリアント制御が必要 | - | 推奨 |
| プロトタイプ・検証 | 推奨 | - |
| パフォーマンスがクリティカル | - | 推奨（出力コードを制御可能） |
| チーム内に TA がいる | 推奨 | - |

---

## 7. シェーダーアンチパターン

| アンチパターン | 問題 | 対策 |
|--------------|------|------|
| `discard` 乱用 | Early-Z 無効化、GPU パイプライン停止 | Alpha Test は必要最小限に |
| Fragment 内の `for` ループ | GPU 占有率低下 | ループ展開、テクスチャ LUT |
| 未使用バリアントの放置 | ビルド時間・メモリ増大 | `shader_feature_local` 使用 |
| テクスチャサンプリング過多 | 帯域飽和 | チャンネルパッキング |
| Vertex Shader での `sin`/`cos` 乱用 | 高コスト | テーブル参照 or 近似 |

### チャンネルパッキングの例

```hlsl
// BAD: テクスチャ 3 枚
TEXTURE2D(_MetallicMap);   // R のみ使用
TEXTURE2D(_SmoothnessMap); // R のみ使用
TEXTURE2D(_OcclusionMap);  // R のみ使用

// GOOD: 1 枚にパッキング（R=Metallic, G=Occlusion, B=unused, A=Smoothness）
TEXTURE2D(_MaskMap);
half4 mask = SAMPLE_TEXTURE2D(_MaskMap, sampler_MaskMap, uv);
half metallic = mask.r;
half occlusion = mask.g;
half smoothness = mask.a;
```

---

## チェックリスト

### シェーダー作成時
- [ ] SRP Batcher 互換になっているか（CBUFFER_START/END）
- [ ] `multi_compile` と `shader_feature` を適切に使い分けているか
- [ ] バリアント数を計算し、爆発していないか
- [ ] モバイル向けなら half precision を使用しているか
- [ ] プロパティ名が Unity 標準命名に従っているか
- [ ] テクスチャのチャンネルパッキングを検討したか

### レビュー時
- [ ] `discard` / `clip()` の使用は必要最小限か
- [ ] Fragment シェーダーに不要な `for` ループがないか
- [ ] 動的分岐を `step()` / `lerp()` で置換できないか
- [ ] テクスチャサンプリング回数は適切か
- [ ] Shader Graph の場合、不要なノードが残っていないか
