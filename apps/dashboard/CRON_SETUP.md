# 定时任务（Cron）配置

家庭驾驶舱有三个内部 API 路由需要外部 cron 服务触发。

## 路由列表

| 端点 | 用途 | 推荐频率 |
|------|------|---------|
| `/api/cron/daily-briefing?cron_token=xxx` | 每日 AI 简报推送 | 每天 1 次（早 7:00） |
| `/api/cron/health-reminder?cron_token=xxx` | 健康提醒检查推送 | 每天 1 次（早 8:00） |
| `/api/cron/reminder?cron_token=xxx` | 通用提醒检查推送 | 每天 2 次（早 8:00、晚 20:00） |

## 认证

所有 cron 端点使用 URL query 参数 `cron_token` 认证，对应环境变量 `FAMILY_CRON_TOKEN`。
在 `.env.local` 中设置一个随机字符串：

```
FAMILY_CRON_TOKEN=$(openssl rand -hex 32)
```

## 使用 cron-job.org

1. 注册 [cron-job.org](https://cron-job.org)
2. 创建定时任务，URL 格式：
   ```
   https://your-domain.com/api/cron/daily-briefing?cron_token=xxx
   ```
3. 设置频率（如每天 7:00）
4. 保存

## 使用本地 cron（Linux/macOS）

```bash
# 编辑 crontab
crontab -e

# 添加以下行（替换 your-domain.com 和 xxx）
0 7 * * * curl -s "http://localhost:3000/api/cron/daily-briefing?cron_token=xxx" >/dev/null 2>&1
0 8 * * * curl -s "http://localhost:3000/api/cron/health-reminder?cron_token=xxx" >/dev/null 2>&1
0 8,20 * * * curl -s "http://localhost:3000/api/cron/reminder?cron_token=xxx" >/dev/null 2>&1
```
