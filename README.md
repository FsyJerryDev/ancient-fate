# 大曜命运档案 · GitHub Pages / Supabase 正式版（部署准备工程）

本仓库是基于 **已有 V3 游戏源码** 的正式版增量改造，前端使用 GitHub Pages 静态托管；Supabase Edge Functions + PostgreSQL 负责真实兑换码与数据库业务。**尚未连接任何实际云账号，尚未上线或完成真实 Supabase 联调。**

## 目录

- `web/`：可直接放上 GitHub Pages 的静态 H5、管理员入口。内容由既有 V3 生成，无须部署 Next.js 服务器。
- `supabase/migrations/`：数据库表结构、RLS、事务型扣次与结算函数。
- `supabase/functions/fate-api/`：兑换码验证、会话、答题保存、结算、分享、管理员接口。
- `supabase/functions/_shared/`：直接拷贝原 V3 `scoring.ts` / `endings.ts` / `types.ts` 的内容，只有 Deno 所需的 `.ts` 导入后缀变化。不是重写规则。
- `source-v3/`：原有 React/Next 游戏源码、题库与测试的保留快照；供后续继续迭代剧情及回归使用。
- `tests/browser_mock.py`：实际 Chromium 浏览器中使用模拟 Supabase 接口检验 16 道题全过程。
- `.github/workflows/pages.yml`：GitHub Actions 发布 `web/` 到 Pages。
- `docs/DEPLOYMENT.md`：**先看这里**，逐步部署教程和安全提示。

## 主要业务约定

- 购买：用户在小红书店铺付 ¥0.99，网站不再收款。小红书商品类目及站外网页交付方式必须事先获得允许。
- 长兑换码：`FATE-XXXXX-XXXXX-XXXXX-XXXXX`；20 位高熵随机字符，可复制粘贴，验证不扣次。
- 每码 3 次独立测评：只有开始新会话才原子扣一次，刷新/返回/同局重答不新增占用。
- 游戏：原有 4 幕、16 题、12 种结局、3～5 秒反馈弹窗、全剧 90 集不改。
- 已完成报告：服务器确定性重新结算，并只在本人权益会话下保存与读取；分享需主动生成随机 URL，可撤销。
- 管理后台：Supabase Auth 用户白名单，批量生成 CSV、订单号人工绑定、冻结/解冻；未接入小红书自动发货。
- 完全不含返现、好评奖励与相关 UI。

## 不部署账号也能执行的检查

```bash
node --check web/game.js
node --check web/api.js
node --check web/admin.js
# 需要 python playwright + 本机 Chromium：
python tests/browser_mock.py
```

静态页没配置 Supabase 时**不会假装完成兑换**，首页会直接显示“尚未连接 Supabase”提示。

## 非目标/待后续做

Supabase 真实部署与数据库事务联调；小红书平台类目审核及自动化发货 API；国内公网体验验收；异常风控升级；长图在多种内嵌浏览器中的保存测试；隐私和正式售后信息。相关账号操作需要用户登录或授权。

## 线上阶段说明

- [离线试玩版](https://fsyjerrydev.github.io/ancient-fate/demo.html)：已有完整剧情，不需要兑换码，只用于演示。
- [正式版入口](https://fsyjerrydev.github.io/ancient-fate/)：需要 Supabase 数据库、Edge Function 和 `web/config.js` 配置后才能兑换。
- 代码推送不会自动配置 Supabase，也没有接入任何小红书订单。正式运营前要完成云端、安全与手机端联调。