# GitHub Pages + Supabase 部署手册（先准备、用户授权后执行）

## A. 创建 Supabase 项目（需要用户自己登录）

1. 登录 https://supabase.com/dashboard ，创建项目并保管数据库密码。建议按主要客户所在地区选择合适区域。免费套餐有配额和闲置暂停风险，不保证 24×7 可用；正式销售前评估付费套餐及成本。
2. 在 **SQL Editor** 执行 `supabase/migrations/202610180001_init.sql`，生成数据表、事务函数和 RLS 策略。
3. 在 Project Settings / API 找到 `Project URL` 与可公开的 `anon / publishable key`。这两个可以放入前端配置；**service_role/secret key 绝不能放进 GitHub Pages 文件或提交仓库**。
4. 用 Supabase CLI 在项目根目录链接你的项目并部署 Edge Function：
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <你的_PROJECT_REF>
   supabase secrets set CODE_HASH_PEPPER="<随机至少32字符>" ALLOWED_ORIGINS="https://<用户名>.github.io,https://<自定义域名>"
   supabase functions deploy fate-api --no-verify-jwt
   ```
   说明：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 通常由 Supabase Functions 运行环境自动提供。务必在实际项目检查该环境变量可用；切勿手动传到浏览器。`CODE_HASH_PEPPER` 一旦设置，后续不能随意改变，否则已有兑换码与已签发的会话无法验证。
5. 把 `web/config.js` 的 `apiUrl` 填为 `https://<project-ref>.supabase.co/functions/v1/fate-api`，`anonKey` 填公开 anon/publishable key（供管理员登录），其他业务接口无需公开密钥。
6. 本地验证：在 `web/` 目录执行 `python -m http.server 8000` 并访问 `http://localhost:8000`；如果首次配置只允许线上域名，调试时在 `ALLOWED_ORIGINS` 中增加 `http://localhost:8000`，调试完成后去掉。

## B. 管理员登录与发码

1. 在 Supabase Auth Dashboard 创建管理员邮箱用户，配置安全密码，完成邮箱确认。
2. 查出管理员 `auth.users.id`（Dashboard -> Authentication -> Users），在 SQL Editor 执行：
   ```sql
   insert into public.admin_users(user_id) values ('<管理员 UID>');
   ```
3. 打开 `https://你的网页地址/admin.html` 登录。
4. 先测试生成 2 枚码并导出 CSV。**明文码只在生成操作响应中出现一次**；请妥善保存原始 CSV，避免公开提交仓库。
5. 将实际订单号手动绑定至码，按小红书许可的发货方式交付。测试退款时可冻结码；冻结期间无法新启动游戏。
6. 当前未调用小红书订单 API，也未实现自动发货；是否允许“码 + 站外 H5”模式交付，要先确认平台类目与履约规则。

## C. 推送 GitHub Pages（需要用户自己登录或明确授权）

1. 创建 GitHub repository，把本项目整体推送到 `main` 分支。注意 `web/config.js` 只能包含**公开配置**，不能包含任何管理员凭据、兑换码列表、数据库服务密钥。
2. 打开 `Settings -> Pages -> Build and deployment -> Source`，设为 **GitHub Actions**。
3. 已提供 `.github/workflows/pages.yml`，只发布 `web/`，不公开 Supabase 迁移、函数或测试源码为网站静态文件（Git 仓库本身仍依访问权限决定可见范围）。
4. 首次部署完成后，在 `Settings -> Pages` 取得网址：通常是 `https://<username>.github.io/<repo>/`。前端使用相对资源路径，支持这个子目录。
5. 验证手机打开、兑换码粘贴、一个码三次测评、断点续玩、匿名分享、长图保存。分享链接使用 `#share=...`，兼容 GitHub Pages 子目录。
6. 若为自定义域名：在 Pages 设置中绑定域名并完成 DNS/HTTPS；同步修改 Supabase `ALLOWED_ORIGINS`。

## D. 生产上线检查

- **实际对接验证前不允许向买家承诺已经上线。** 用户尚未提供 GitHub 仓库和 Supabase 项目授权，本交付包只包含部署材料。
- GitHub Pages、Supabase 的地区网络可达性、国内用户访问延迟、配额或限制需要在目标用户真实网络下测试；不能保证中国大陆所有网络持续可访问。公网 HTTPS、可用域名和支付/履约类目均需实际确认。
- GitHub Pages 是静态公开托管：发布在 `web/` 中的剧情数据和前端评分代码可以被懂技术的访问者查看；服务端额度、报告归属、分享令牌仍由 Supabase 强制校验。若以后要对付费内容本身做更严格的保密，应将题库/结局正文改为后端鉴权后下发。
- 兑换码验证限频为基础防刷手段；有高流量前要加边缘 WAF、服务端速率限制监控与黑名单；兑换码生成批次需审计与订单核对。
- `CODE_HASH_PEPPER` 丢失或变更会使既有码失效，需要备份于安全密钥管理位置；不能上传 GitHub。
- 兑换码默认为**生成之日起 90 天**有效，与“支付之日起 90 天”不同。上线前需要在用户商品页同步说明或进一步实现发货时激活有效期。
- 页面不包含“好评返现”或任何评价奖励。价格仅在小红书平台收取，无网站二次支付。
- 提供售后/隐私政策文本、用户可撤销分享、数据删除和备份制度，按实际经营地合规要求完善。