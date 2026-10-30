#!/usr/bin/env node
/**
 * tf-3d-env インストールスクリプト
 *
 * Usage:
 *   node scripts/install.js                        # ~/.claude/ に agents/commands/skills を同期（rules は除く）
 *   node scripts/install.js --dry-run              # プレビュー（変更なし）
 *   node scripts/install.js --uninstall            # アンインストール
 *   node scripts/install.js --project <path>       # プロジェクトの CLAUDE.md に 3D セクションを追記し、.claude/rules/ にルールを配置
 *
 * 前提条件:
 *   tf-standard-env（共通コア）が先にインストールされていること。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SOURCE_DIR = path.resolve(__dirname, '..');

const COMPONENTS = [
  { src: 'agents', dest: 'agents', label: 'Agents (3D/Unity)' },
  { src: 'commands', dest: 'commands', label: 'Commands (3D/Unity)' },
  { src: 'skills', dest: 'skills', label: 'Skills (3D/Unity)' },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const projectIdx = args.indexOf('--project');
  return {
    dryRun: args.includes('--dry-run'),
    uninstall: args.includes('--uninstall'),
    project: projectIdx !== -1 ? args[projectIdx + 1] : null,
  };
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyDir(src, dest, dryRun) {
  const files = fs.readdirSync(src);
  let copied = 0;
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      if (!dryRun) ensureDir(destPath);
      copied += copyDir(srcPath, destPath, dryRun);
    } else {
      const action = fs.existsSync(destPath) ? 'update' : 'create';
      console.log(`  ${action === 'create' ? '+' : '~'} ${path.relative(CLAUDE_DIR, destPath)}`);
      if (!dryRun) {
        ensureDir(path.dirname(destPath));
        fs.copyFileSync(srcPath, destPath);
      }
      copied++;
    }
  }
  return copied;
}

function getAllFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      files.push(...getAllFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function checkTfseInstalled() {
  const tfseMarkers = [
    path.join(CLAUDE_DIR, 'rules', 'solid-principles.md'),
    path.join(CLAUDE_DIR, 'agents', 'planner.md'),
  ];
  const installed = tfseMarkers.some(f => fs.existsSync(f));
  if (!installed) {
    console.warn('\n⚠ tf-standard-env（共通コア）が検出されませんでした。');
    console.warn('  先に tf-standard-env をインストールしてください:');
    console.warn('  cd tf-standard-env && npm run install:env\n');
  }
  return installed;
}

// ルールはグローバル (~/.claude/rules) ではなくプロジェクト単位 (<project>/.claude/rules) で配布する。
// ドメイン別ルールをグローバルに置くと全プロジェクトで毎回読み込まれ、指示ファイルの上限を超えるため。
const RULES_SRC = path.join(SOURCE_DIR, 'rules');
const GLOBAL_RULES_DIR = path.join(CLAUDE_DIR, 'rules');

function listRuleFiles() {
  if (!fs.existsSync(RULES_SRC)) return [];
  return fs.readdirSync(RULES_SRC).filter((f) => f.endsWith('.md'));
}

function copyRulesToProject(targetPath, dryRun) {
  const destDir = path.join(targetPath, '.claude', 'rules');
  const files = listRuleFiles();
  if (!dryRun) ensureDir(destDir);
  for (const file of files) {
    const destPath = path.join(destDir, file);
    console.log(`  ${fs.existsSync(destPath) ? '~' : '+'} .claude/rules/${file}`);
    if (!dryRun) fs.copyFileSync(path.join(RULES_SRC, file), destPath);
  }
  return files.length;
}

// 旧方式でグローバルに入ったルールを削除する。グローバル側が編集されていれば残して警告する。
function removeGlobalRules(dryRun) {
  let removed = 0;
  for (const file of listRuleFiles()) {
    const globalPath = path.join(GLOBAL_RULES_DIR, file);
    if (!fs.existsSync(globalPath)) continue;
    const same = fs.readFileSync(globalPath).equals(fs.readFileSync(path.join(RULES_SRC, file)));
    if (!same) {
      console.warn(`  ! rules/${file}: グローバル版がソースと異なるため残しました（手動で確認してください）`);
      continue;
    }
    console.log(`  - rules/${file}`);
    if (!dryRun) fs.unlinkSync(globalPath);
    removed++;
  }
  return removed;
}

function install(options) {
  const { dryRun } = options;
  const mode = dryRun ? '[DRY RUN] ' : '';
  console.log(`\n${mode}tf-3d-env インストール`);
  console.log(`${'─'.repeat(40)}`);
  console.log(`ソース: ${SOURCE_DIR}`);
  console.log(`宛先:   ${CLAUDE_DIR}\n`);
  checkTfseInstalled();
  let totalFiles = 0;
  for (const comp of COMPONENTS) {
    const srcPath = path.join(SOURCE_DIR, comp.src);
    const destPath = path.join(CLAUDE_DIR, comp.dest);
    if (!fs.existsSync(srcPath)) {
      console.log(`⚠ ${comp.label}: ソースが見つかりません (${srcPath})`);
      continue;
    }
    console.log(`${comp.label}:`);
    if (!dryRun) ensureDir(destPath);
    totalFiles += copyDir(srcPath, destPath, dryRun);
    console.log();
  }
  console.log('Rules（旧方式のグローバル配置を削除。ルールは --project <path> で配置）:');
  removeGlobalRules(dryRun);
  console.log();
  console.log(`${'─'.repeat(40)}`);
  console.log(`${mode}${totalFiles} ファイルを処理しました`);
  if (dryRun) console.log('\n--dry-run なし で実行すると実際にインストールされます');
}

function uninstall() {
  console.log('\ntf-3d-env アンインストール');
  console.log(`${'─'.repeat(40)}`);
  let removed = 0;
  for (const comp of COMPONENTS) {
    const srcPath = path.join(SOURCE_DIR, comp.src);
    if (!fs.existsSync(srcPath)) continue;
    const files = getAllFiles(srcPath);
    for (const file of files) {
      const relative = path.relative(srcPath, file);
      const destFile = path.join(CLAUDE_DIR, comp.dest, relative);
      if (fs.existsSync(destFile)) {
        console.log(`  - ${path.relative(CLAUDE_DIR, destFile)}`);
        fs.unlinkSync(destFile);
        removed++;
      }
    }
  }
  removed += removeGlobalRules(false);
  console.log(`${'─'.repeat(40)}`);
  console.log(`${removed} ファイルを削除しました（共通コアは維持）`);
}

const MARKER = '## Development Workflow（TFSE-3D 準拠）';
const SECTION = `
---

## Development Workflow（TFSE-3D 準拠）

このプロジェクトには TFSE-3D がインストールされています。
共通ルールは tf-standard-env、3D/Unity 固有ルールは tf-3d-env から提供されます。

### Unity 開発ワークフロー

| ステップ | コマンド | 用途 |
|---------|---------|------|
| 1. 計画 | \`/plan\` | 機能設計を確認してから着手 |
| 2. Unity レビュー | \`/unity-review\` | アーキ + シェーダーレビュー |
| 3. TDD | \`/unity-tdd\` | EditMode / PlayMode テスト |
| 4. パフォーマンス | \`/perf-check\` | FPS, Draw Call, メモリ分析 |
| 5. アセット監査 | \`/asset-audit\` | 命名規約・サイズ・重複チェック |

### 設計原則

- **パフォーマンスバジェット**: プラットフォーム別 FPS / Draw Call / メモリ上限
- **GC 回避**: オブジェクトプーリング、構造体活用
- **Addressables**: Resources フォルダの使用を最小限に
- **Git LFS**: テクスチャ、モデル、音声は LFS で管理

### Git Workflow

- **ブランチ戦略**: \`feature/xxx\` → PR → \`main\`
- **コミット形式**: \`feat:\`, \`fix:\`, \`refactor:\`, \`docs:\`, \`test:\`, \`chore:\`
- **LFS**: \`.fbx\`, \`.png\`, \`.wav\`, \`.mp3\` は Git LFS 管理
`;

function initProject(projectPath) {
  const targetPath = path.resolve(projectPath);
  if (!fs.existsSync(targetPath)) {
    console.error(`\nエラー: プロジェクトパスが見つかりません: ${targetPath}`);
    process.exit(1);
  }
  const claudeMdPath = path.join(targetPath, 'CLAUDE.md');
  console.log(`\ntf-3d-env プロジェクト初期化`);
  console.log(`${'─'.repeat(40)}`);
  console.log(`プロジェクト: ${targetPath}\n`);
  console.log('Rules:');
  const ruleCount = copyRulesToProject(targetPath, false);
  console.log(`  ${ruleCount} ファイルを .claude/rules/ に配置\n`);
  if (fs.existsSync(claudeMdPath)) {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    if (content.includes(MARKER)) {
      console.log(`= CLAUDE.md: TFSE-3D セクション既存 → スキップ（冪等）`);
    } else {
      fs.appendFileSync(claudeMdPath, SECTION, 'utf8');
      console.log(`+ CLAUDE.md: TFSE-3D セクションを追記`);
    }
  } else {
    fs.writeFileSync(claudeMdPath, `# CLAUDE.md\n${SECTION}`, 'utf8');
    console.log(`+ CLAUDE.md: TFSE-3D テンプレートで新規作成`);
  }
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`完了！次のセッションから /unity-review, /unity-tdd 等が使えます。`);
}

const options = parseArgs();
if (options.uninstall) uninstall();
else if (options.project) initProject(options.project);
else install(options);
