---
name: optimization-checklist
description: Platform-specific optimization checklists covering rendering, memory, physics, and audio with Unity Profiler verification steps.
---

# 最適化チェックリスト

プラットフォーム別の最適化チェックリスト。レンダリング、メモリ、物理、オーディオ、スクリプトの各領域をカバーし、Unity Profiler での確認手順を含む。

---

## プラットフォーム別バジェット

| 指標 | Mobile | PC | Console |
|------|--------|----|---------|
| Target FPS | 30 / 60 | 60 / 120 | 30 / 60 |
| Draw Calls | < 100 | < 500 | < 300 |
| Triangles/Frame | < 100K | < 1M | < 500K |
| Memory (Runtime) | < 512MB | < 2GB | < 1.5GB |
| Texture Memory | < 200MB | < 1GB | < 512MB |
| Audio Memory | < 50MB | < 200MB | < 100MB |
| Build Size | < 200MB | < 2GB | < 5GB |

---

## 1. レンダリング最適化

### Static Batching

- [ ] 動かないオブジェクトに `Static` フラグを設定しているか
- [ ] Batches Saved を Frame Debugger で確認したか

| 設定 | 値 | 備考 |
|------|-----|------|
| Static フラグ | Batching Static | Inspector → Static チェック |
| 確認方法 | Frame Debugger | Window → Analysis → Frame Debugger |

### Dynamic Batching

- [ ] 小さなメッシュ（頂点数 < 300）で有効化しているか
- [ ] URP Asset → Dynamic Batching を確認したか

### GPU Instancing

- [ ] 同一マテリアルの大量オブジェクトに GPU Instancing を有効化しているか
- [ ] マテリアルの Inspector → Enable GPU Instancing をチェックしたか
- [ ] シェーダーが `#pragma multi_compile_instancing` を含んでいるか

### SRP Batcher 互換性

- [ ] URP Asset → SRP Batcher が有効か
- [ ] シェーダーが SRP Batcher 互換か（Frame Debugger で確認）
- [ ] CBUFFER ブロックでプロパティを宣言しているか

```hlsl
CBUFFER_START(UnityPerMaterial)
    float4 _BaseColor;
    float4 _BaseMap_ST;
CBUFFER_END
```

### LOD Group

- [ ] 遠景オブジェクトに LOD Group を設定しているか
- [ ] LOD レベルは 3 段階（LOD0: 100%, LOD1: 50%, LOD2: 25%）を基準にしているか
- [ ] Cull の割合を設定しているか（通常 10% 以下でカリング）

### Occlusion Culling

- [ ] 屋内シーンで Occlusion Culling を有効化しているか
- [ ] Occluder / Occludee Static フラグを適切に設定しているか
- [ ] Bake 後に Occlusion Visualization で確認したか

---

## 2. メモリ最適化

### テクスチャ圧縮

| プラットフォーム | 推奨フォーマット | 備考 |
|----------------|-----------------|------|
| Android | ASTC 6x6 | 品質とサイズのバランス |
| iOS | ASTC 6x6 | |
| PC | BC7 (DXT5) | 高品質 |
| WebGL | ETC2 / ASTC | ブラウザ対応確認 |

- [ ] Max Size がコンテンツに対して適切か（UI: 1024, 背景: 2048, キャラ: 4096）
- [ ] sRGB が正しく設定されているか（カラーテクスチャ: ON, Normal Map: OFF）
- [ ] Read/Write Enabled が不要なテクスチャで OFF になっているか

### Mipmap

- [ ] 3D シーンのテクスチャで Mipmap が有効か
- [ ] UI テクスチャで Mipmap が無効か（画面固定サイズのため不要）
- [ ] Mipmap Streaming が大規模シーンで有効か

### Audio 圧縮

| 用途 | Load Type | Compression | 備考 |
|------|-----------|-------------|------|
| BGM | Streaming | Vorbis (Quality: 70%) | メモリ節約 |
| SE (短い) | Decompress On Load | ADPCM | 低レイテンシ |
| SE (長い) | Compressed In Memory | Vorbis (Quality: 50%) | バランス |
| 環境音 | Streaming | Vorbis (Quality: 50%) | |

- [ ] Force To Mono が不要なステレオ音源で有効か
- [ ] Sample Rate Setting が Optimize Sample Rate になっているか

### Addressables

- [ ] 起動時に全ロードせず、必要時にロードしているか
- [ ] 不要になったアセットを `Addressables.Release()` しているか
- [ ] Event Viewer でメモリリークを確認したか

---

## 3. 物理最適化

### Fixed Timestep

| 設定 | 推奨値 | 備考 |
|------|--------|------|
| Fixed Timestep | 0.02 (50Hz) | デフォルト |
| Maximum Allowed Timestep | 0.1 | スパイク防止 |
| モバイル向け | 0.04 (25Hz) | 物理精度を犠牲にして負荷軽減 |

- [ ] Project Settings → Time で確認したか

### Layer-based Collision Matrix

- [ ] 不要なレイヤー間の衝突を無効化しているか
- [ ] Project Settings → Physics → Layer Collision Matrix を確認したか
- [ ] 衝突が不要なオブジェクト同士（例: UI と環境）を分離しているか

### Rigidbody 設定

- [ ] 動かないコライダーに Rigidbody がアタッチされていないか（Static Collider）
- [ ] Rigidbody.sleepThreshold が適切か（デフォルト: 0.005）
- [ ] Interpolation が必要なオブジェクトのみで有効か
- [ ] Continuous Collision Detection は高速移動オブジェクトのみで使用しているか

---

## 4. スクリプト最適化

### GC Allocation 削減

```csharp
// BAD: 毎フレーム GC Alloc
void Update()
{
    string status = $"HP: {hp}/{maxHp}";  // 文字列生成
    var enemies = FindObjectsOfType<Enemy>();  // 配列生成
    var nearby = enemies.Where(e => e.IsNear(transform.position)).ToList();
}

// GOOD: GC Alloc 回避
private readonly StringBuilder _sb = new();
private readonly List<Enemy> _enemyCache = new();

void Update()
{
    _sb.Clear();
    _sb.Append("HP: ").Append(hp).Append('/').Append(maxHp);
    // _enemyCache は事前に取得・更新
}
```

- [ ] Update() 内で文字列結合をしていないか
- [ ] LINQ の ToList() / ToArray() を毎フレーム呼んでいないか
- [ ] FindObjectOfType を毎フレーム呼んでいないか

### Object Pooling

- [ ] 頻繁に生成・破棄するオブジェクト（弾丸、エフェクト）にプーリングを使用しているか
- [ ] `UnityEngine.Pool.ObjectPool<T>` または自作プールを使用しているか

### Update() 最適化

- [ ] 不要な Update() を削除しているか
- [ ] 毎フレーム不要な処理を一定間隔に変更しているか（Coroutine, InvokeRepeating）
- [ ] Camera.main のキャッシュをしているか

---

## 5. Profiler での確認手順

### CPU Profiler

1. Window → Analysis → Profiler を開く
2. CPU Usage モジュールを選択
3. `Deep Profile` を有効化（詳細分析時のみ、負荷に注意）
4. 確認項目:
   - PlayerLoop 以下の処理時間
   - GC.Alloc の発生箇所
   - Physics.FixedUpdate の処理時間

### Memory Profiler

1. Package Manager から `Memory Profiler` をインストール
2. Window → Analysis → Memory Profiler を開く
3. `Take Snapshot` を実行
4. 確認項目:
   - Total Memory Usage がバジェット内か
   - Texture メモリが適切か
   - 不要なオブジェクトが残っていないか

### Frame Debugger

1. Window → Analysis → Frame Debugger を開く
2. Enable を押す
3. 確認項目:
   - Draw Call 数がバジェット内か
   - Batching が効いているか
   - SRP Batcher が "Compatible" か

### GPU Profiler（実機）

1. Development Build で実機にデプロイ
2. Profiler を Autoconnect で接続
3. GPU Usage モジュールを確認
4. 確認項目:
   - Vertex / Fragment シェーダーの処理時間
   - Overdraw の発生箇所

---

## 最適化の優先順位

1. **Draw Call 削減** - Batching, SRP Batcher, GPU Instancing
2. **テクスチャ最適化** - 圧縮、Max Size、Mipmap
3. **GC Alloc 削減** - Update 内のアロケーション排除
4. **物理最適化** - Collision Matrix, Fixed Timestep
5. **LOD / Culling** - 遠景の描画負荷削減
