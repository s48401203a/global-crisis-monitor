# Phase 0 需要你完成的操作（硬门槛）

规格要求：未通过 Phase 0 验收前不得写业务依赖安装/跑采集。  
当前代码与脚本已落盘到 `D:\crisis\`，但环境三项未就绪，**必须先由你处理**。

## 现状

| 检查项 | 当前值 | 要求 |
|--------|--------|------|
| LongPathsEnabled | **0** | 必须为 **1**，且**重启后**再 pip |
| PGSUPERPASS | **未设置** | 会话或用户级环境变量 |
| 管理员权限 | Agent 无 | 安装 PG / 改注册表 / Defender 排除 |
| PostgreSQL | 未安装 | 17.10 + PostGIS 3.6.2 |

## 请你按顺序做

### 1. 设置超级用户密码（不要发给我明文也可，只要环境变量有）

在 **PowerShell** 中（建议用户级持久）：

```powershell
# 用户级持久（新开终端也有效）
[Environment]::SetEnvironmentVariable('PGSUPERPASS', '你的强密码', 'User')
# 当前会话立刻可用
$env:PGSUPERPASS = '你的强密码'
```

### 2. 管理员 PowerShell 执行步骤 1，然后重启

1. 开始菜单 → 右键 Windows Terminal / PowerShell → **以管理员身份运行**
2. 执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
& D:\crisis\setup\01-system-prereq.ps1
```

3. 看到「步骤 1 完成。请重启机器后继续步骤 2。」后 **立即重启机器**。  
4. **不要在重启前** 执行 `pip` / `uv pip install`（否则会踩红线 #6，报假的 METADATA 错误）。

### 3. 重启后验证长路径

```powershell
(Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem").LongPathsEnabled
# 必须输出 1
```

### 4. 回来告诉我

回复例如：

> 已重启，LongPathsEnabled=1，PGSUPERPASS 已设置。请继续 Phase 0 步骤 2。

我将继续：安装 PostgreSQL 17.10 + PostGIS 3.6.2 → 建库 → venv → **逐条跑 Phase 0 验收**，通过后再进 Phase 1。

---

## 已完成（无需你重做）

- 规格代码已落到 `D:\crisis\app`（采集器/去重/告警/API/前端/WinSW 配置）
- 安装脚本：`D:\crisis\setup\01~05`
- 目录：`app / pgdata / logs / service / backups / secrets`
