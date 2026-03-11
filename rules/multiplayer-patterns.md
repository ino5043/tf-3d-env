# Multiplayer Patterns

Unity Netcode for GameObjects を用いたマルチプレイヤー設計に関する必須ルール。同期パターン、権限モデル、遅延補償を定義する。

---

## 1. Netcode for GameObjects 基本設計

### アーキテクチャ概要

```
┌──────────────────────────────────────────────────────────┐
│                        Server                            │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Network  │  │ Game State   │  │ Authority Logic    │ │
│  │ Manager  │  │ (Single      │  │ (Validation,       │ │
│  │          │  │  Source of   │  │  Anti-Cheat)       │ │
│  │          │  │  Truth)      │  │                    │ │
│  └──────────┘  └──────────────┘  └────────────────────┘ │
│        │                │                                │
│        ▼                ▼                                │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Transport Layer (UTP)                  │ │
│  └──────────────────────┬──────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Client 1 │   │ Client 2 │   │ Client 3 │
    │ (Owner)  │   │          │   │          │
    └──────────┘   └──────────┘   └──────────┘
```

### NetworkManager セットアップ

```csharp
using Unity.Netcode;
using UnityEngine;

public class GameNetworkManager : MonoBehaviour
{
    [SerializeField] private NetworkManager _networkManager;

    private void Start()
    {
        _networkManager.OnClientConnectedCallback += OnClientConnected;
        _networkManager.OnClientDisconnectCallback += OnClientDisconnected;
    }

    public void StartHost()
    {
        _networkManager.StartHost();
        Debug.Log("Host started");
    }

    public void StartClient()
    {
        _networkManager.StartClient();
        Debug.Log("Connecting to server...");
    }

    public void StartServer()
    {
        _networkManager.StartServer();
        Debug.Log("Dedicated server started");
    }

    private void OnClientConnected(ulong clientId)
    {
        Debug.Log($"Client connected: {clientId}");
    }

    private void OnClientDisconnected(ulong clientId)
    {
        Debug.Log($"Client disconnected: {clientId}");
    }

    private void OnDestroy()
    {
        if (_networkManager != null)
        {
            _networkManager.OnClientConnectedCallback -= OnClientConnected;
            _networkManager.OnClientDisconnectCallback -= OnClientDisconnected;
        }
    }
}
```

---

## 2. 同期パターン比較

### State Synchronization vs RPC

| 項目 | State Sync (NetworkVariable) | RPC (ServerRpc / ClientRpc) |
|------|-----------------------------|-----------------------------|
| 用途 | 継続的な状態同期 | 一時的なアクション・イベント |
| 帯域消費 | 変更時のみ送信（差分） | 呼び出しごとに送信 |
| 新規接続 | 自動的に最新状態を取得 | 受信できない（過去のイベント） |
| 例 | HP, 位置, 装備 | 攻撃, スキル発動, チャット |
| データ方向 | Server → All Clients | Client → Server / Server → Clients |

### 使い分け判断フロー

```
同期するデータは?
│
├─ 常に最新値が必要（状態）
│   └─ NetworkVariable を使用
│       例: HP, 弾数, チーム, 位置
│
├─ 一度だけ発生するイベント
│   └─ RPC を使用
│       例: 攻撃, ジャンプ, エモート
│
└─ 大量のデータ更新
    └─ Custom Message / NetworkList を使用
        例: インベントリ, リーダーボード
```

---

## 3. NetworkVariable の使い方

```csharp
using Unity.Netcode;
using UnityEngine;

public class PlayerStats : NetworkBehaviour
{
    // Server のみ書き込み可能（デフォルト）
    private readonly NetworkVariable<int> _health = new(
        100,
        NetworkVariableReadPermission.Everyone,
        NetworkVariableWritePermission.Server
    );

    private readonly NetworkVariable<int> _score = new(
        0,
        NetworkVariableReadPermission.Everyone,
        NetworkVariableWritePermission.Server
    );

    // Owner のみ書き込み可能
    private readonly NetworkVariable<PlayerInput> _playerInput = new(
        default,
        NetworkVariableReadPermission.Everyone,
        NetworkVariableWritePermission.Owner
    );

    public override void OnNetworkSpawn()
    {
        // 値変更時のコールバック登録
        _health.OnValueChanged += OnHealthChanged;
        _score.OnValueChanged += OnScoreChanged;

        if (IsOwner)
        {
            Debug.Log("Local player spawned");
        }
    }

    public override void OnNetworkDespawn()
    {
        _health.OnValueChanged -= OnHealthChanged;
        _score.OnValueChanged -= OnScoreChanged;
    }

    private void OnHealthChanged(int previousValue, int newValue)
    {
        Debug.Log($"Health: {previousValue} -> {newValue}");
        // UI 更新などクライアント側処理
    }

    private void OnScoreChanged(int previousValue, int newValue)
    {
        Debug.Log($"Score: {previousValue} -> {newValue}");
    }

    // Server 上でのみ呼び出す
    public void ApplyDamage(int damage)
    {
        if (!IsServer) return;
        _health.Value = Mathf.Max(0, _health.Value - damage);
    }

    public void AddScore(int points)
    {
        if (!IsServer) return;
        _score.Value += points;
    }
}

// カスタム構造体を NetworkVariable で使用
public struct PlayerInput : INetworkSerializable
{
    public float Horizontal;
    public float Vertical;
    public bool Jump;
    public bool Fire;

    public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
    {
        serializer.SerializeValue(ref Horizontal);
        serializer.SerializeValue(ref Vertical);
        serializer.SerializeValue(ref Jump);
        serializer.SerializeValue(ref Fire);
    }
}
```

---

## 4. 権限モデル

### Server Authoritative vs Client Authoritative 比較表

| 項目 | Server Authoritative | Client Authoritative |
|------|---------------------|---------------------|
| チート耐性 | 高い（Server が検証） | 低い（Client を信頼） |
| レスポンシブ性 | 低い（RTT 分の遅延） | 高い（即座に反映） |
| 帯域消費 | 中 | 低い |
| サーバー負荷 | 高い | 低い |
| 実装複雑度 | 高い | 低い |
| 推奨用途 | 競技性の高いゲーム | 協力プレイ、カジュアルゲーム |

### Server Authoritative の実装

```csharp
public class ServerAuthoritativeMovement : NetworkBehaviour
{
    [SerializeField] private float _moveSpeed = 5f;
    [SerializeField] private float _maxAllowedSpeed = 10f;

    private readonly NetworkVariable<Vector3> _networkPosition = new(
        Vector3.zero,
        NetworkVariableReadPermission.Everyone,
        NetworkVariableWritePermission.Server
    );

    private readonly NetworkVariable<Quaternion> _networkRotation = new(
        Quaternion.identity,
        NetworkVariableReadPermission.Everyone,
        NetworkVariableWritePermission.Server
    );

    private void Update()
    {
        if (IsOwner)
        {
            // Client: 入力を Server に送信
            var input = new MoveInput
            {
                Horizontal = Input.GetAxisRaw("Horizontal"),
                Vertical = Input.GetAxisRaw("Vertical")
            };
            MoveServerRpc(input);
        }
        else
        {
            // 他プレイヤー: NetworkVariable の値に補間
            transform.position = Vector3.Lerp(
                transform.position,
                _networkPosition.Value,
                Time.deltaTime * 15f
            );
            transform.rotation = Quaternion.Slerp(
                transform.rotation,
                _networkRotation.Value,
                Time.deltaTime * 15f
            );
        }
    }

    [ServerRpc]
    private void MoveServerRpc(MoveInput input)
    {
        // Server: 入力を検証して移動を適用
        var direction = new Vector3(input.Horizontal, 0, input.Vertical).normalized;

        // チート検出: 不正な速度を検出
        if (direction.magnitude > 1.1f)
        {
            Debug.LogWarning($"Suspicious input from {OwnerClientId}");
            return;
        }

        Vector3 newPosition = transform.position + direction * _moveSpeed * Time.deltaTime;
        transform.position = newPosition;

        // NetworkVariable を更新 → 全 Client に自動同期
        _networkPosition.Value = newPosition;
        _networkRotation.Value = transform.rotation;
    }
}

public struct MoveInput : INetworkSerializable
{
    public float Horizontal;
    public float Vertical;

    public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
    {
        serializer.SerializeValue(ref Horizontal);
        serializer.SerializeValue(ref Vertical);
    }
}
```

---

## 5. 遅延補償パターン

### Client-Side Prediction

```csharp
public class ClientSidePrediction : NetworkBehaviour
{
    [SerializeField] private float _moveSpeed = 5f;

    // Server の権威的な位置
    private readonly NetworkVariable<Vector3> _serverPosition = new();

    // Client 側の予測位置
    private Vector3 _predictedPosition;
    private readonly Queue<InputSnapshot> _pendingInputs = new();
    private uint _inputSequence;

    private void Update()
    {
        if (!IsOwner) return;

        // 1. 入力を取得
        var input = new InputSnapshot
        {
            Sequence = _inputSequence++,
            Direction = new Vector3(
                Input.GetAxisRaw("Horizontal"),
                0,
                Input.GetAxisRaw("Vertical")
            ).normalized,
            DeltaTime = Time.deltaTime
        };

        // 2. Client 側で即座に予測適用（レスポンシブ）
        _predictedPosition += input.Direction * _moveSpeed * input.DeltaTime;
        transform.position = _predictedPosition;

        // 3. 入力を保存して Server に送信
        _pendingInputs.Enqueue(input);
        SendInputServerRpc(input);
    }

    [ServerRpc]
    private void SendInputServerRpc(InputSnapshot input)
    {
        // Server: 入力を適用して権威的な位置を更新
        _serverPosition.Value += input.Direction * _moveSpeed * input.DeltaTime;

        // Client に確認番号を返す
        ConfirmInputClientRpc(input.Sequence, _serverPosition.Value);
    }

    [ClientRpc]
    private void ConfirmInputClientRpc(uint confirmedSequence, Vector3 serverPos)
    {
        if (!IsOwner) return;

        // Reconciliation: Server の結果と比較
        // 確認済みの入力を破棄
        while (_pendingInputs.Count > 0 &&
               _pendingInputs.Peek().Sequence <= confirmedSequence)
        {
            _pendingInputs.Dequeue();
        }

        // Server の位置から未確認の入力を再適用
        _predictedPosition = serverPos;
        foreach (var pending in _pendingInputs)
        {
            _predictedPosition += pending.Direction * _moveSpeed * pending.DeltaTime;
        }

        transform.position = _predictedPosition;
    }
}

public struct InputSnapshot : INetworkSerializable
{
    public uint Sequence;
    public Vector3 Direction;
    public float DeltaTime;

    public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
    {
        serializer.SerializeValue(ref Sequence);
        serializer.SerializeValue(ref Direction);
        serializer.SerializeValue(ref DeltaTime);
    }
}
```

---

## 6. ロビーシステム設計

```csharp
using Unity.Services.Lobbies;
using Unity.Services.Lobbies.Models;
using Unity.Services.Authentication;

public class LobbyManager : MonoBehaviour
{
    private Lobby _currentLobby;
    private float _heartbeatTimer;
    private const float HeartbeatInterval = 15f;

    public async Task<Lobby> CreateLobby(string lobbyName, int maxPlayers)
    {
        try
        {
            var options = new CreateLobbyOptions
            {
                IsPrivate = false,
                Data = new Dictionary<string, DataObject>
                {
                    {
                        "GameMode", new DataObject(
                            DataObject.VisibilityOptions.Public,
                            "Deathmatch"
                        )
                    },
                    {
                        "Map", new DataObject(
                            DataObject.VisibilityOptions.Public,
                            "Arena_01"
                        )
                    }
                }
            };

            _currentLobby = await LobbyService.Instance.CreateLobbyAsync(
                lobbyName, maxPlayers, options);

            Debug.Log($"Lobby created: {_currentLobby.Id} ({_currentLobby.LobbyCode})");
            return _currentLobby;
        }
        catch (LobbyServiceException e)
        {
            Debug.LogError($"Failed to create lobby: {e.Message}");
            throw;
        }
    }

    public async Task<Lobby> JoinLobbyByCode(string lobbyCode)
    {
        try
        {
            _currentLobby = await LobbyService.Instance.JoinLobbyByCodeAsync(lobbyCode);
            Debug.Log($"Joined lobby: {_currentLobby.Name}");
            return _currentLobby;
        }
        catch (LobbyServiceException e)
        {
            Debug.LogError($"Failed to join lobby: {e.Message}");
            throw;
        }
    }

    public async Task<List<Lobby>> QueryLobbies()
    {
        var options = new QueryLobbiesOptions
        {
            Filters = new List<QueryFilter>
            {
                new(QueryFilter.FieldOptions.AvailableSlots, "0",
                    QueryFilter.OpOptions.GT)
            },
            Order = new List<QueryOrder>
            {
                new(false, QueryOrder.FieldOptions.Created)
            }
        };

        var response = await LobbyService.Instance.QueryLobbiesAsync(options);
        return response.Results;
    }

    // Host はロビーのハートビートを定期送信する必要がある
    private void Update()
    {
        if (_currentLobby == null) return;
        if (!IsHost()) return;

        _heartbeatTimer += Time.deltaTime;
        if (_heartbeatTimer >= HeartbeatInterval)
        {
            _heartbeatTimer = 0f;
            SendHeartbeat();
        }
    }

    private async void SendHeartbeat()
    {
        try
        {
            await LobbyService.Instance.SendHeartbeatPingAsync(_currentLobby.Id);
        }
        catch (LobbyServiceException e)
        {
            Debug.LogError($"Heartbeat failed: {e.Message}");
        }
    }

    private bool IsHost()
    {
        return _currentLobby?.HostId == AuthenticationService.Instance.PlayerId;
    }

    public async Task LeaveLobby()
    {
        if (_currentLobby == null) return;

        try
        {
            await LobbyService.Instance.RemovePlayerAsync(
                _currentLobby.Id,
                AuthenticationService.Instance.PlayerId
            );
            _currentLobby = null;
        }
        catch (LobbyServiceException e)
        {
            Debug.LogError($"Failed to leave lobby: {e.Message}");
        }
    }
}
```

---

## 7. Relay / Transport Layer 選択

| Transport | 用途 | NAT 越え | 推奨 |
|-----------|------|---------|------|
| Unity Transport (UTP) | 標準 Transport | 不可（直接接続） | LAN ゲーム |
| Unity Relay | NAT 越え | 可能（リレーサーバー経由） | オンラインゲーム推奨 |
| Steam Networking | Steam プラットフォーム | 可能 | Steam リリース |
| Custom WebSocket | ブラウザ対応 | 可能 | WebGL |

### Relay セットアップ

```csharp
using Unity.Services.Relay;
using Unity.Netcode;
using Unity.Netcode.Transports.UTP;

public class RelayManager : MonoBehaviour
{
    public async Task<string> CreateRelay(int maxConnections)
    {
        try
        {
            var allocation = await RelayService.Instance.CreateAllocationAsync(maxConnections);
            var joinCode = await RelayService.Instance.GetJoinCodeAsync(allocation.AllocationId);

            var transport = NetworkManager.Singleton.GetComponent<UnityTransport>();
            transport.SetRelayServerData(
                allocation.RelayServer.IpV4,
                (ushort)allocation.RelayServer.Port,
                allocation.AllocationIdBytes,
                allocation.Key,
                allocation.ConnectionData
            );

            NetworkManager.Singleton.StartHost();
            Debug.Log($"Relay created. Join code: {joinCode}");
            return joinCode;
        }
        catch (RelayServiceException e)
        {
            Debug.LogError($"Relay creation failed: {e.Message}");
            throw;
        }
    }

    public async Task JoinRelay(string joinCode)
    {
        try
        {
            var joinAllocation = await RelayService.Instance.JoinAllocationAsync(joinCode);

            var transport = NetworkManager.Singleton.GetComponent<UnityTransport>();
            transport.SetClientRelayData(
                joinAllocation.RelayServer.IpV4,
                (ushort)joinAllocation.RelayServer.Port,
                joinAllocation.AllocationIdBytes,
                joinAllocation.Key,
                joinAllocation.ConnectionData,
                joinAllocation.HostConnectionData
            );

            NetworkManager.Singleton.StartClient();
            Debug.Log("Joined relay successfully");
        }
        catch (RelayServiceException e)
        {
            Debug.LogError($"Failed to join relay: {e.Message}");
            throw;
        }
    }
}
```

---

## 8. RPC パターン

```csharp
public class CombatSystem : NetworkBehaviour
{
    [SerializeField] private int _maxHealth = 100;
    private readonly NetworkVariable<int> _currentHealth = new(100);

    // Client → Server: クライアントがサーバーにアクション要求
    [ServerRpc]
    public void AttackServerRpc(ulong targetNetworkObjectId, ServerRpcParams rpcParams = default)
    {
        // Server で検証
        ulong attackerClientId = rpcParams.Receive.SenderClientId;

        if (!ValidateAttack(attackerClientId, targetNetworkObjectId))
        {
            Debug.LogWarning($"Invalid attack from client {attackerClientId}");
            return;
        }

        // ダメージ適用
        var target = GetNetworkObject(targetNetworkObjectId);
        if (target != null && target.TryGetComponent<CombatSystem>(out var combat))
        {
            combat.ApplyDamage(25);

            // 全 Client にヒットエフェクトを通知
            PlayHitEffectClientRpc(
                target.transform.position,
                target.transform.forward
            );
        }
    }

    // Server → All Clients: 全クライアントにエフェクト再生を通知
    [ClientRpc]
    private void PlayHitEffectClientRpc(Vector3 position, Vector3 direction)
    {
        // 全 Client でエフェクトを再生
        SpawnHitEffect(position, direction);
    }

    // Server → Specific Client: 特定クライアントにのみ通知
    [ClientRpc]
    private void NotifyDamageClientRpc(int damage, ClientRpcParams rpcParams = default)
    {
        // 指定された Client のみ実行
        ShowDamageNumber(damage);
    }

    private void ApplyDamage(int damage)
    {
        if (!IsServer) return;

        _currentHealth.Value = Mathf.Max(0, _currentHealth.Value - damage);

        if (_currentHealth.Value <= 0)
        {
            HandleDeathServerSide();
        }
    }

    private bool ValidateAttack(ulong attackerClientId, ulong targetNetworkObjectId)
    {
        // Server 側でのバリデーション
        // - 攻撃者が生存しているか
        // - 攻撃距離が妥当か
        // - クールダウン中でないか
        return true;
    }

    private NetworkObject GetNetworkObject(ulong networkObjectId)
    {
        NetworkManager.Singleton.SpawnManager.SpawnedObjects
            .TryGetValue(networkObjectId, out var networkObject);
        return networkObject;
    }

    private void SpawnHitEffect(Vector3 position, Vector3 direction) { /* VFX */ }
    private void ShowDamageNumber(int damage) { /* UI */ }
    private void HandleDeathServerSide() { /* Death logic */ }
}
```

---

## チェックリスト

### 設計時
- [ ] Server Authoritative か Client Authoritative かを決定したか
- [ ] 各データの同期方式（NetworkVariable vs RPC）を選定したか
- [ ] 競技性の高いゲームなら Server Authoritative を選択しているか
- [ ] ロビーシステムの要件（最大人数、マッチメイキング）を定義したか

### 実装時
- [ ] NetworkVariable に適切な Read/Write Permission を設定したか
- [ ] `OnNetworkSpawn` / `OnNetworkDespawn` でイベント登録/解除をしているか
- [ ] ServerRpc で入力を検証（バリデーション）しているか
- [ ] Client-Side Prediction が必要な箇所に実装したか
- [ ] Relay を設定し、NAT 越えをテストしたか

### テスト時
- [ ] ホスト + 複数クライアントでの動作を確認したか
- [ ] 遅延シミュレーション（Network Simulator）でテストしたか
- [ ] 切断/再接続のハンドリングが実装されているか
- [ ] ロビーのハートビートが正常に送信されているか

### セキュリティ
- [ ] Server 側で全ての重要なゲームロジックを検証しているか
- [ ] 不正な入力（異常な速度、範囲外値）をサーバーで拒否しているか
- [ ] NetworkVariable の Write Permission が適切か（Owner or Server）
