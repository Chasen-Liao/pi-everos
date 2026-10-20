# 维护规则

本仓库和官方仓 [EverMind-AI/Plugins](https://github.com/EverMind-AI/Plugins) 的 [`pi/`](https://github.com/EverMind-AI/Plugins/tree/main/pi) 是同一份插件的两个副本。

| 副本 | 职责 |
| --- | --- |
| **本仓库** `Chasen-Liao/pi-everos` | npm / `pi install git:` 的安装源。Pi 不能装 git 子目录，所以这个根目录必须留下。 |
| **官方仓** `EverMind-AI/Plugins/pi` | 官方目录、CI、根 README 列表。PR：[#33](https://github.com/EverMind-AI/Plugins/pull/33)。本地在 `D:\MyProjects\Plugins\pi`。 |

## 源

行为以 **官方仓 `pi/`** 为准（评审看那里）。本仓库跟它对齐，再发 npm / 打 git tag。

## 改代码

1. 先在 `D:\MyProjects\Plugins\pi` 改，跑 `npm test`。
2. 把同一批文件拷回本仓库。两边 `extensions/`、`src/`、`schemas/`、`tests/` 必须一致。
3. 本仓库独有、**不要**拷进官方仓：`Plan.md`、`REVIEW-FIX-PLAN.md`、`scripts/`、本文件。
4. 官方仓独有、**不要**拷回这里：根 `README.md`、`.github/workflows/pi.yml`。
5. 官方仓的 `package.json` `repository.directory` 是 `"pi"`；本仓库保持自己的 git URL，不要覆盖。

## 发布

- `pi install git:github.com/Chasen-Liao/pi-everos` 继续从本仓库装。
- `npm publish` 也从本仓库发。发之前确认已与官方仓 `pi/` 同步。
- 版本号两边保持相同。
