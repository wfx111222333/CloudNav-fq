# CloudNav 6 项功能增强实现计划

## Context

用户请求 6 项功能改进：文件管理系统、视图模式持久化、标题闪烁修复、全站排序、图标大小可配置、便签/文件助手登录可见。当前代码存在视图模式只存 localStorage 不存 KV、标题加载闪烁、图标尺寸硬编码、侧边栏功能未做登录门控等问题。

## 实现顺序

按冲突最小化排序：#6 → #3 → #2 → #5 → #4 → #1

---

## 1. 便签/文件助手登录可见（Req #6）

**文件**: `App.tsx` 侧边栏 (lines 2113-2135)

**改动**: 将便签和文件传输助手按钮用 `{authToken && (...)}` 包裹，与设置按钮（line 2237）模式一致。"所有网站"保持公开。

---

## 2. 标题闪烁修复（Req #3）

**文件**: `index.html`

**改动**: 在 `<head>` 中 `<title>` 之后添加内联脚本，同步从 `localStorage('cloudnav_site_settings')` 读取并设置 `document.title` 和 favicon，在 React 挂载前消除闪烁。保留现有 `useEffect`（App.tsx 705-722）处理后续 KV 更新。

---

## 3. 视图模式持久化修复（Req #2）

**文件**: `App.tsx` `handleViewModeChange` (lines 736-741)

**改动**: 在现有 localStorage 写入后，当 `authToken` 存在时追加 KV 同步：
```js
fetch('/api/storage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-auth-password': authToken },
  body: JSON.stringify({ saveConfig: 'website', config: newSiteSettings })
}).catch(e => console.error(e));
```
KV 读取合并逻辑已存在（lines 590-597, 832-839），只需补全写入路径。

---

## 4. 图标大小可配置（Req #5）

**文件**: `types.ts`, `App.tsx`, `components/SettingsModal.tsx`

### types.ts
- `SiteSettings` 添加 `iconSize?: number;`（默认 32）

### App.tsx
- useState 初始化 (line 95-109)：添加 `iconSize: 32`
- KV 合并 (lines 590-597, 832-839)：两处都添加 `iconSize: websiteConfigData.iconSize || prev.iconSize`
- 渲染计算（line 1806 附近）：
  ```
  const iconContainerSize = siteSettings.iconSize || 32;
  const iconImgSize = Math.round(iconContainerSize * 0.625);
  ```
- 替换 3 处硬编码（用 inline style 替代 `w-8 h-8` / `w-5 h-5`，保留 rounded/gradient 类）：
  - `SortableLinkCard` lines 1854-1857
  - `renderLinkCard` 批量编辑 lines 1916-1919
  - `renderLinkCard` 正常 lines 1955-1958

### SettingsModal.tsx
- `localSiteSettings` 初始化 (lines 66-72)：添加 `iconSize`
- 网站设置标签页 (line 1118 后)：添加滑块控件（range 24-48），调用 `handleSiteChange('iconSize', value)`，加入即时 KV 保存分支（同 `passwordExpiryDays`）

---

## 5. 全站列表排序（Req #4）

**文件**: `types.ts`, `App.tsx`

### types.ts
- `LinkItem` 添加 `clickCount?: number;`

### App.tsx
1. **排序状态** (line 134 附近)：添加 `allSortMode` state，类型 `'category' | 'name' | 'date' | 'frequency' | 'manual'`，默认 `'category'`

2. **点击统计**：添加 `handleLinkClick(link)` 函数
   - 在 `renderLinkCard` 的 `<a>` 标签添加 `onClick`（不 preventDefault）
   - 立即更新 state + localStorage，防抖 1.5s 同步 KV

3. **排序逻辑**：`displayedLinks` useMemo (line 1726) 当 `selectedCategory === 'all' && allSortMode !== 'category'` 时按选定模式排序

4. **排序工具栏**：`selectedCategory === 'all'` 时显示按钮组（默认/名称/日期/频率/手动）
   - `'category'` 模式：渲染现有分类网格
   - 其他模式：渲染扁平网格
   - `'manual'` 模式：启用 DnD 拖拽排序（复用 `handleDragEnd`，已支持 `selectedCategory === 'all'`）

5. **条件渲染**：分类网格守卫添加 `allSortMode === 'category'` 条件

---

## 6. 文件管理系统（Req #1）

**文件**: 新建 API 路由 + 改造 `TransferModal.tsx` + `types.ts`

### 新建 API 文件

**`functions/api/transfer/messages/[id].ts`**（参考 `notes/[id].ts`）：
- `onRequestDelete`：认证 → 读 KV `transfer_messages` → 过滤删除 → 写回
- `onRequestPut`：认证 → 读 body → 找到消息 → 合并更新（主要用于 `folder` 字段）→ 写回
- `onRequestOptions`：CORS

**修改 `functions/api/transfer/file/[name].ts`**：
- 添加 `PASSWORD` 到 Env，添加 `authenticate` 辅助函数
- 添加 `onRequestDelete`：认证 → `env.CLOUDNAV_R2.delete(params.name)`
- GET 保持公开（图床链接需公开访问）

**修改 `functions/api/transfer/upload/index.ts`**：
- 读取 `formData.get('folder')`，存入消息 metadata

### types.ts
- `TransferMessage` 添加 `folder?: string;`

### TransferModal.tsx 改造
- 添加 `activeTab: 'messages' | 'files'` 状态
- 标题栏下方添加标签切换（复用 SettingsModal 样式）
- **消息标签**：现有聊天 UI 不变
- **文件管理标签**：
  - 从 `messages.filter(m => m.type !== 'text')` 派生文件列表
  - 视图模式：网格/列表切换
  - 搜索框：按文件名过滤
  - 文件夹导航：从消息 `folder` 字段派生 + "新建文件夹"按钮
  - 文件卡片：缩略图（图片）/图标、文件名、大小、下载、删除、移动到文件夹
  - `deleteFile(message)`：DELETE 消息 + DELETE R2 文件
  - `moveFile(message, folder)`：PUT 消息更新 `folder`
  - 上传时携带当前文件夹信息

---

## 验证方法

1. `npx tsc --noEmit` 通过编译
2. 本地 `npm run dev` 测试：
   - 未登录时侧边栏不显示便签/文件助手
   - 刷新页面标题无闪烁
   - 切换简约/详情视图后刷新保持
   - 设置中调整图标大小后立即生效
   - 全站列表各排序模式正常
   - 文件管理标签页的增删移查功能正常
3. `git push` 触发 Cloudflare Pages 部署，在生产环境验证
