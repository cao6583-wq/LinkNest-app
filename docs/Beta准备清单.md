# LinkNest Beta 准备清单

## 当前状态

已完成 MVP 原型主流程：

- 附近发现页
- 书籍详情
- 登录 / 注册演示流程
- Supabase client 接线
- 数据库 schema
- 图书发布
- 附近查询
- 借阅状态机
- 消息通知
- 好友系统
- 我的书架
- 隐私、举报和安全说明
- 核心流程测试清单
- 后端联调状态面板
- 举报提交写入流程

## Beta 前必须完成

### 1. 真实 Supabase 项目

必须完成：

- 创建 Supabase 项目。
- 配置 `.env.local`。
- 执行 `supabase/migrations/20260518000000_initial_schema.sql`。
- 执行 `supabase/migrations/20260519000000_real_data_sync.sql`。
- 创建测试用户。
- 按需执行 `supabase/seed.example.sql`。
- 在真实项目里测试 RLS。

`.env.local` 示例：

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

不要把 service role key 放进前端。

### 2. 手机测试

Web 手机测试：

```bash
npm run dev:lan
```

然后用同一 Wi-Fi 下的手机访问终端显示的 Network URL。

Expo Go 原生测试：

```bash
npm run start
```

用 Expo Go 扫码打开。

### 3. GitHub

已完成：

- 代码已推送到 `https://github.com/cao6583-wq/LinkNest-app`
- 默认分支为 `main`
- 初始提交包含 App 原型源码、Supabase schema、文档和 `package-lock.json`
- 已添加 GitHub Actions CI：每次 push / pull request 自动执行 `npm ci` 和 `npm run check`

推到 GitHub 的目的不是手机测试，而是：

- 备份代码
- 版本管理
- 后续部署
- Pull Request 审查
- CI 检查

推荐分支：

```bash
main
```

首个提交建议包含：

- App 原型源码
- Supabase schema
- 文档
- package-lock

不要提交：

- `.env`
- `.env.local`
- `.expo`
- `dist`
- `node_modules`

### 4. 部署选择

Web Beta 可选：

- Vercel
- Netlify
- Supabase hosting 替代方案

移动端 Beta 可选：

- Expo Go 内测
- EAS Build
- TestFlight
- Google Play Internal Testing

当前阶段建议：

1. 先用 `npm run dev:lan` 做手机浏览器测试。
2. 再用 Expo Go 做原生体验测试。
3. 最后再考虑 EAS Build / TestFlight。

### 5. 监控和分析

Beta 前建议接入：

- Crash：Sentry
- Analytics：PostHog、Amplitude 或 Supabase 事件表
- 基础事件：
  - 打开 App
  - 浏览书籍详情
  - 搜索 / 筛选
  - 登录成功
  - 发布图书
  - 申请借阅
  - 同意借阅
  - 完成归还
  - 发送好友申请
  - 举报

### 6. 数据和内容审核

Beta 前至少确认：

- 举报表可写入，书籍详情和出借者资料页已接入 `reports` 写入流程。
- book-covers bucket 文件大小有限制。
- 用户不能修改别人的书。
- 用户不能读取非参与方借阅申请。
- 用户不能读取非成员会话消息。
- 位置不会直接展示精确坐标。

当前 App 行为：

- 未配置 Supabase 或使用演示用户时，举报写入本地演示记录。
- 配置 Supabase 且真实登录后，举报写入 `reports` 表。
- “我的”页会显示 Supabase 配置、当前会话、图书数据源和举报写入目标。
- 配置 Supabase 且真实登录后，收藏、借阅申请、好友关系会从真实表读取。
- 借阅状态变化会通过数据库 trigger 同步到 `books.status`。

## Beta 测试任务

建议邀请 5-10 个测试用户，每人完成：

- 发布 2 本书。
- 收藏 2 本书。
- 申请借阅 1 本书。
- 处理 1 个借阅申请。
- 添加 1 个好友。
- 发起 1 次举报演练。

## Beta 通过标准

可以进入下一阶段的标准：

- 主流程无阻塞 bug。
- 发布书籍后可被附近发现。
- 借阅状态不会卡住。
- 消息通知能跟随状态变化。
- 隐私设置入口清晰。
- 手机端主要页面无明显布局错位。
- Supabase RLS 验证通过。

## 当前已验证

命令级验证已通过：

```bash
npm run typecheck
npm run build
npm run check
curl -I http://127.0.0.1:5176/
curl -I http://127.0.0.1:5177/
```

版本管理已完成：

- `main` 已推送到 GitHub。
- GitHub Actions CI 配置已加入仓库。

第 16 步已完成：

- 已添加后端联调状态面板。
- 已将举报入口接入真实 `reports` 写入流程。

仍需手动验证：

- 手机浏览器布局
- Expo Go 原生体验
- 真实 Supabase 登录、举报写入和 RLS
- 真实 Supabase 收藏、借阅申请、好友关系读取
- GitHub Actions 首次远程运行结果
- Web Beta 部署流水线
