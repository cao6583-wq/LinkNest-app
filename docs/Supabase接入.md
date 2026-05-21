# Supabase 接入步骤

## 1. 创建 Supabase 项目

在 Supabase 控制台创建新项目，区域建议选择离主要用户更近的区域。

创建完成后，到 Project Settings -> API 复制：

- Project URL
- anon public key

## 2. 配置本地环境变量

复制 `.env.example` 为 `.env.local`，然后填入真实值：

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

`EXPO_PUBLIC_` 前缀会被 Expo 暴露给客户端。不要把 service role key 放进前端环境变量。

## 3. 执行数据库脚本

打开 Supabase SQL Editor，执行：

```text
supabase/migrations/20260518000000_initial_schema.sql
supabase/migrations/20260519000000_real_data_sync.sql
```

这个脚本会创建：

- profiles
- books
- borrow_requests
- friendships
- conversations
- conversation_members
- messages
- reviews
- favorites
- book-covers storage bucket
- avatars storage bucket
- RLS policies
- nearby_books 查询函数
- 借阅双方读取借阅相关图书的 RLS policy
- 借阅申请状态同步图书 `status` 的 trigger

数据库结构说明见：

```text
docs/数据库Schema.md
```

如果要填充开发数据，先在 Auth 中创建测试用户，再按 `supabase/seed.example.sql` 顶部说明替换 UUID 并执行。

## 4. 打开 Auth

第一版建议先启用 Email 登录：

- Authentication -> Providers -> Email
- 开启 Email provider
- 开发阶段可以先关闭 Confirm email，加快测试

正式上线前再打开邮箱验证。

## 5. 验证前端连接

本地启动：

```bash
npm run web
```

后续第三步会把 mock 数据替换成 Supabase 查询。当前已完成 Supabase client 和数据库 schema 接线。

配置 Supabase 后，前端会自动切换到真实数据：

- 游客发现页读取 `nearby_books` 返回的 `available` 图书。
- 登录用户额外读取自己的图书、借阅相关图书、收藏、借阅申请和好友关系。
- 发布图书写入 `books`。
- 收藏写入 / 删除 `favorites`。
- 借阅申请写入 `borrow_requests`，数据库 trigger 会同步 `books.status`。
- 举报写入 `reports`。

如果 Supabase 查询失败，发现页会显示提示并回退到本地示例数据，方便继续本地开发。
