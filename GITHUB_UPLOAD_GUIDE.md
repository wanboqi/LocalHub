# LocalHub 上传 GitHub 与版本更新完整攻略

本地准备工作**已经全部完成**，你只需要按顺序做下面的网页操作 + 复制命令即可。

---

## 当前本地状态

| 项目 | 状态 |
| --- | --- |
| Git 仓库 | 已在 `localhub` 目录初始化，主分支 `main` |
| 已提交 | 2 个 commit，共 38 个文件（源码 + 主页 + 截图） |
| 仓库体积 | 约 1 MB（不含 node_modules 和构建产物） |
| 已被排除 | `node_modules/`、`out/`、`dist/`、`dist-electron/`、`.staging/`、日志文件 |
| 未推送 | 还没有连接任何远程仓库 |

用 `git status` 应该显示「nothing to commit, working tree clean」。

> 注意：`D:\Academic-Research` 也是一个 Git 仓库（空的）。我已在它的 `.gitignore` 里加了忽略 LocalHub 的一行，两者互不影响。

---

# 第一部分：首次上传

## 步骤 1 · 在 GitHub 上创建空仓库

打开 <https://github.com/new>，填写：

| 字段 | 填写内容 |
| --- | --- |
| Repository name | `localhub` |
| Description | `本地文件与软件管理器 · Electron + React + TypeScript` |
| 类型 | **Public**（公开） |
| Add a README file | **不要勾**（留空） |
| Add .gitignore | **不要勾**（本地已经有了） |
| Choose a license | **不要勾**（下一步手动加） |

**关键点：这三项都不要勾**，否则远程仓库不为空，你 push 时会因为「本地没有远程的新提交」而失败，还要多一步 pull 合并。

点 **Create repository**，页面会跳到一个「Quick setup」引导页，**先别关**，下一步要用它给的提示。

## 步骤 2 · 生成访问令牌（Token）

从 2021 年起 GitHub 不再接受账号密码推送，必须用 Token。

1. 点右上角头像 → **Settings**
2. 左侧最下面 → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. 右上角 **Generate new token** → 选 **Generate new token (classic)**
5. 配置：
   - **Note**：填 `localhub-push`（随便起，方便你以后认出它）
   - **Expiration**：建议选 `90 days`（90 天过期，安全性好；过期后重新生成即可）
   - **Select scopes**：只勾 **`repo`** 这一项（它会自动勾上它下面的子项）
6. 拉到最下面点 **Generate token**
7. **立刻复制生成的字符串**（以 `ghp_` 开头的一长串），粘贴到记事本临时保存

> ⚠️ 这个字符串**只显示这一次**，关掉页面就再也看不到了（只能重新生成）。
> 全程不要发给任何人、不要提交到代码里。

## 步骤 3 · 把 README 里的占位用户名换掉（别漏）

README 里的下载按钮目前写的是 `https://github.com/YOUR-NAME/localhub/releases/latest`，
**不替换的话别人点进去是 404**。用下面的命令一键换（把 `<你的用户名>` 换成实际用户名）：

```bash
cd "D:/Academic-Research/计算机/文件管理软件开发/localhub"
sed -i 's/YOUR-NAME/<你的用户名>/g' README.md
```

习惯用编辑器的也可以：用 VS Code 打开 `README.md`，`Ctrl + H` 查找 `YOUR-NAME` 全部替换为你的用户名。
确认一下替换后变成了正确的地址，再做下一步。<br>
同理检查 `docs/index.html` 里是否手动写死了用户名——它没有写死，是根据 Pages 域名自动推导的，这块不用管。

## 步骤 4 · 在本地执行推送命令

打开 **Git Bash**（或 PowerShell），进入项目目录后依次执行。
**把两处 `<你的用户名>` 换成你的 GitHub 用户名**（比如 `zhangsan`）：

```bash
cd "D:/Academic-Research/计算机/文件管理软件开发/localhub"

# 1) 绑定远程仓库（只需做一次）
git remote add origin https://github.com/<你的用户名>/localhub.git

# 2) 确认分支名是 main
git branch -M main

# 3) 推送
git push -u origin main
```

执行第 3 条时会弹出一个窗口（或命令行提示）要求登录：

- **用户名**：填你的 GitHub 用户名（不是邮箱）
- **密码**：**粘贴刚才那串 `ghp_` 开头的 Token**（粘贴时屏幕不显示内容，正常的，直接回车）

看到类似下面的输出就成功了：

```
Enumerating objects: 45, done.
Writing objects: 100% (45/45), 1.02 MiB | 2.10 MiB/s, done.
To https://github.com/<你的用户名>/localhub.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
```

> 如果 Windows 没有弹出登录框，而是报 `could not read Username`，
> 说明凭据管理器没起来，改用这条把 Token 直接写进远程地址（同样只需做一次）：
> ```bash
> git remote set-url origin https://<你的用户名>:<你的Token>@github.com/<你的用户名>/localhub.git
> git push -u origin main
> ```

## 步骤 5 · 验证

刷新 GitHub 仓库页面，应该能看到：

- `src/`、`electron/`、`tools/`、`docs/`、`public/` 五个目录
- `README.md` 直接渲染在下面，点击标签、**看见 LTS 的版本号 v1.3.1**
- 右上角绿色的 **Code** 按钮

**检查项**：确认列表里**没有** `node_modules` 和 `out`。
如果出现了，说明 `.gitignore` 没生效，先别慌，告诉我来处理。

## 步骤 6 · 补一个开源协议（可选但推荐）

在 GitHub 仓库首页点 **Add file → Create new file**，文件名填 `LICENSE`，
右侧会自动出现 **Choose a license template** 按钮 → 选 **MIT License** → 填年份和你的名字 → Commit changes。

之后本地执行 `git pull` 把它同步下来即可。

---

# 第二部分：开启项目主页（GitHub Pages）

你的主页已经做好了，放在 `docs/` 目录里，`index.html` 是入口，**不需要额外构建**。

1. 仓库页面 → **Settings**（右上角的标签页）
2. 左侧 **Pages**
3. **Source** 选 `Deploy from a branch`
4. **Branch** 选 `main`，右侧文件夹选 **`/docs`**，点 Save
5. 等 **1~3 分钟**，刷新页面，顶部会出现一行绿色提示：
   `Your site is live at https://<你的用户名>.github.io/localhub/`

访问那个链接就是你的项目主页了。主页里的「下载」和「源码」链接会**自动指向你的仓库**，不需要手动改任何代码（它是从 Pages 域名反推出用户名的）。

> 如果打开是 404：等 5 分钟再试；还不行就去 Settings → Pages 看有没有红色报错，
> 通常是「找不到 /docs/index.html」，检查文件名是不是拼错了。

---

# 第三部分：发布第一个版本（Release）—— 让别人能下载

安装包**不放在 Git 仓库里**（108 MB，超过 GitHub 的单文件建议大小），而是作为 Release 附件。

1. 仓库页面右侧 → **Releases** → **Create a new release**（或点 `+ Create a new release`）
2. 配置：
   - **Choose a tag**：输入 `v1.3.1`，然后点 **Create new tag**（发布时会自动打标签）
   - **Release title**：`v1.3.1`
   - 描述框里粘贴下面这段（就是软件的更新日志）：

```markdown
### 修复
- 打包后任务栏、开始菜单、资源管理器里显示的是 Electron 默认的原子图标

### 优化
- exe 内嵌图标补齐 256/128/64/48/32/16 六个尺寸，高 DPI 下也清晰
- exe 属性面板显示正确的产品名与版本号
```

3. 最下面的 **Attach binaries** 区域：**用鼠标把下面这个文件拖进去**

```
D:\Academic-Research\计算机\文件管理软件开发\localhub\out\LocalHub-1.3.1-Setup.exe
```

上传要几分钟（108 MB，进度条走完再操作）。

4. 勾选 **Set as the latest release**
5. 点 **Publish release**

发布完成后，主页上的「下载安装包」按钮指向 `.../releases/latest`，
**会自动跳到这个 Release 页面**，永远指向你最新发布的版本。

---

# 第四部分：以后发新版本的完整流程

假设要发 **v1.4.0**，按顺序做（命令都在 `localhub` 目录执行）：

### 1. 改版本号

编辑 `package.json`，把 `"version": "1.3.1"` 改成 `"version": "1.4.0"`。
> 版本号**只有这一个来源**，界面上的版本号是运行时从里面读的，改这一处就够。

### 2. 写更新日志

编辑 `src/changelog.ts`，在 `CHANGELOG` 数组**最前面**插入一条：

```ts
{
  version: '1.4.0',
  date: '2026-11-05',
  summary: '一句话说明这个版本解决了什么问题',
  changes: [
    { tag: 'new', text: '新增了某个功能' },
    { tag: 'improve', text: '优化了某个体验' },
    { tag: 'fix', text: '修复了某个问题' },
  ],
},
```

> `version` 必须和 `package.json` 里的完全一致，否则软件里的「当前版本」高亮会出错。

### 3. 重新打包

```bash
npm run build        # 先做一次构建，顺便看看有没有报错
npm run dist:manual  # 一键出包：装配 + 生成 Setup.exe 和 Portable.exe
```

产物在 `out/`，文件名会自动带上新版本号。

### 4. 把新版本号写进对外文案

有三处 **v1.3.1** 需要改成 **v1.4.0**，用编辑器的「全部替换」最快：

| 文件 | 要改的东西 |
| --- | --- |
| `README.md` | 下载表格里的两行标题和文件名 `LocalHub-1.3.1-Setup.exe`、更新日志表新增一行 |
| `docs/index.html` | `<span class="nav-ver">`、`<code>LocalHub-1.3.1-Setup.exe</code>`、页脚 `<span>LocalHub v1.3.1</span>` |
| `docs/index.html` | 更新日志区：把 v1.4.0 插到最前面，`class="rel current"` 挪给它，去掉原来那条上的 `current` |

如果需要新截图，替换 `docs/assets/` 里对应的 PNG（**文件名保持一致就不用改 HTML**）。

### 5. 提交并推送

```bash
git add .
git commit -m "发布 v1.4.0：一句话主题"
git push
```

> 此时 `out/` 被 .gitignore 排除了，所以 108 MB 的安装包**不会**进仓库，很干净。

### 6. 网页上发布新 Release

重复第三部分的步骤：**Releases → Create a new release**，
tag 填 `v1.4.0`，拖入新的 Setup.exe，发布。

软件会自动做剩下的事：用户在旧版本上启动新版本后，
**第一次运行会自动弹出「本次更新内容」**（因为数据文件里记了上次看到的版本号）。

---

# 第五部分：日常同步命令速查

在 `localhub` 目录下：

| 想做什么 | 命令 |
| --- | --- |
| 看改了哪些文件 | `git status` |
| 提交改动 | `git add . && git commit -m "说明"` |
| 推送到 GitHub | `git push` |
| 拉取远程更新 | `git pull` |
| 看提交历史 | `git log --oneline` |
| 撤销未提交的改动 | `git checkout -- 文件名` |
| 已提交错了想重来 | `git reset --soft HEAD~1` |

---

# 常见问题

**Q：push 时提示 `Support for password authentication was removed`？**
A：你在密码栏填了账号密码。密码栏必须填 Token（`ghp_` 开头），账号名才是用户名。

**Q：提示 `remote: Repository not found` 或输入 Token 后还是 403？**
A：Token 的 scope 里没有勾 `repo`，回去重新生成一个勾选了 `repo` 的 Token。

**Q：提示 `src refspec main does not match any`？**
A：本地还没有 commit。先 `git add . && git commit -m "init"`。

**Q：提示 `failed to push some refs`（远程有本地没有的内容）？**
A：说明建仓库时勾了 README 或 LICENSE。先 `git pull --rebase origin main` 再 `git push`。

**Q：Pages 显示 404？**
A：确认 Settings → Pages 里 Source 是 `Deploy from a branch`、Branch 是 `main` + `/docs`。改完等 3 分钟。

**Q：Token 不小心泄露了怎么办？**
A：立刻去 Settings → Developer settings → Tokens (classic)，找到那个 Token 点 **Delete**。
然后把远程地址里的 Token 去掉：`git remote set-url origin https://github.com/<用户名>/localhub.git`，下次 push 时用新 Token。

**Q：想把 108 MB 的安装包也备份到 GitHub 行不行？**
A：可以，放到 Release 附件里就是最合适的方式（单文件上限 2 GB）。
但**不要**用 `git push` 把 exe 提交进仓库——仓库会迅速膨胀到几百 MB，clone 变慢，而且 GitHub 会发警告邮件。

---

# 需要告诉我的

做完第一步建好仓库后，把你的 **GitHub 用户名**告诉我（不用给 Token），
我可以帮你核对 remote 地址、检查 Pages 链接是否正确。
