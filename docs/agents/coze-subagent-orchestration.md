# Codex 主控 + Coze 子 Agent 协同设计

本文档用于把 Codex 作为主控、开发制定者和最终集成者，把 Coze 空间实例作为执行子 agent。核心原则是：Codex 派发边界清晰的任务单，Coze 只在独立分支执行一个任务，完成后返回交付报告，由 Codex 统一 review、验证和集成。

## 角色分工

### Codex 主控

- 维护总计划、依赖顺序、任务优先级和集成顺序。
- 为每个子任务指定任务文件、建议分支、允许修改文件、禁止修改文件、验收标准和测试命令。
- 检查 Coze 返回的交付报告、diff、测试结果和风险。
- 负责最终合并、冲突处理、全量验证和 PR。

### Coze 子 Agent

- 每个 Coze 空间实例只接收一个任务单。
- 开始前必须检查实例空间是否已有代码、Git 远端是否正确、工作区是否干净。
- 只在自己的任务分支修改任务单允许范围内的文件。
- 不合并 main，不推送 main，不修改其他 worker 的分支。
- 完成后只返回交付报告和分支信息。

## 第一阶段：实例空间检查与代码同步

Coze 子 agent 收到任务后，第一步不写代码，先执行空间检查。

### 检查目标

1. 当前目录是否已有项目代码。
2. 是否是 Git 仓库。
3. `origin` 是否指向正确仓库。
4. 当前工作区是否干净。
5. 是否已经同步到 `origin/main`。
6. 是否已经切到本任务独立分支。
7. 依赖是否可安装，项目基础命令是否可运行。

### 推荐启动流程

```bash
pwd
ls
git status --short --branch
git remote -v
git fetch origin main
git checkout -B <task-branch> origin/main
pnpm install --frozen-lockfile
```

如果当前目录没有代码，则先 clone：

```bash
git clone https://github.com/xiangzhi2022/erpv1.git .
git fetch origin main
git checkout -B <task-branch> origin/main
pnpm install --frozen-lockfile
```

如果 `git status --short` 显示已有未提交改动，Coze 必须停止并汇报，不要 stash、不要覆盖、不要自动继续。

## 任务派发格式

Codex 给 Coze 的每次派发都使用下面这段 text 模板。

```text
你是 Coze 执行子 agent，不是主控。Codex 是主控和最终集成者。

仓库：xiangzhi2022/erpv1
基础分支：origin/main
本任务分支：<task-branch>
角色文档：docs/agents/<role-agent>.md
任务文件：docs/agents/assignments/<task-file>.md

第一步必须做空间检查：
1. 检查当前目录是否已有代码。
2. 如果没有代码，clone 仓库到当前空间。
3. 检查 git remote -v，确认 origin 指向 xiangzhi2022/erpv1。
4. 检查 git status --short --branch。
5. 如果工作区不干净，立即停止并返回状态，不要覆盖、不 stash、不继续写代码。
6. git fetch origin main。
7. git checkout -B <task-branch> origin/main。
8. pnpm install --frozen-lockfile。

执行规则：
- 只使用 pnpm，禁止 npm 和 yarn。
- 只处理任务文件中允许范围内的文件。
- 不要修改禁止文件。
- 不要处理任务外 warnings 或重构。
- 不要提交 .env 或密钥。
- 不要合并 main。
- 不要推送 main。

完成后验证：
- 按任务文件中的测试命令运行。
- 如果命令失败，先尝试修复任务范围内的问题。
- 如果失败原因超出任务范围，停止并在报告中说明。

完成后只返回：
## 分支
- <task-branch>

## 修改文件
- ...

## 实现说明
- ...

## 验证
- 已运行: ...
- 未运行及原因: ...

## 风险
- ...
```

## 分支与同步规则

- 每个 Coze 子 agent 使用一个独立分支，例如 `codex/lint-blockers`、`codex/orders-module-hardening`。
- 子 agent 只能从 `origin/main` 创建任务分支。
- 子 agent 完成后可以推送自己的任务分支：`git push -u origin <task-branch>`。
- 子 agent 不能推送 `main`。
- Codex 主控统一决定哪些分支进入最终集成。

## 与当前 `.coze` 配置的关系

当前 `.coze` 的 `validate` 链路会调用 `scripts/sync.sh`，而 `scripts/sync.sh` 默认提交并推送到 `origin main`。这适合单实例自动同步，不适合多 agent 并行开发。

多 agent 模式建议：

- Coze 执行阶段只运行任务指定验证命令，不自动调用会推送 main 的 sync 脚本。
- 如果需要自动推送，应改为推送当前任务分支，而不是 main。
- main 的提交、合并和 PR 交付只由 Codex 主控或最终 `github-agent` 执行。

## 推荐协同流程

1. Codex 先读 `docs/agents/assignments/README.md`，确定派发顺序。
2. Codex 选一个任务单，填好派发 text。
3. Coze 子 agent 执行空间检查和分支初始化。
4. Coze 子 agent 完成任务范围内代码修改和验证。
5. Coze 返回交付报告。
6. Codex review diff 和验证结果。
7. Codex 按依赖顺序集成多个任务分支。
8. Codex 运行最终 `pnpm ts-check`、`pnpm test`、`pnpm lint`。
9. Codex 交给 review/github agent 做最终 PR 描述和交付。

## 失败处理规则

- 空间没有代码且 clone 失败：返回 clone 错误，不继续。
- remote 不正确：停止并返回 `git remote -v`。
- 工作区不干净：停止并返回 `git status --short --branch`。
- 分支创建失败：停止并返回错误。
- 依赖安装失败：返回 pnpm 错误，不改用 npm。
- 验证失败且超出任务范围：停止并汇报，不扩大修改范围。
