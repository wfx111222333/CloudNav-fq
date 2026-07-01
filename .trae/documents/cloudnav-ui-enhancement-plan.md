# CloudNav 界面布局优化与功能增强计划

## Context

用户请求 6 项界面优化：卡片垂直布局、标题样式配置、背景图片、网格列数自定义、文件管理下载/弹窗优化、登录关闭按钮、移除私密标识、图片压缩显示。

## 实现顺序

types.ts → Req4(登录关闭) → Req5(移除私密标识) → Req3(文件管理优化) → Req1(卡片布局+标题样式) → Req2(背景+网格) → Req6(图片压缩)

---

## 0. 类型扩展 (types.ts)

**SiteSettings** 新增字段：
- `titleColor?: string` — 卡片标题颜色
- `titleFontSize?: number` — 卡片标题字号
- `backgroundImage?: string` — 背景图URL
- `gridColumns?: number` — 网格列数(3-6, 默认6)

**TransferMessage** 新增字段：
- `originalUrl?: string` — 原图URL(下载用)

---

## 1. Req4: 登录界面关闭按钮

**文件**: `components/AuthModal.tsx`, `App.tsx`

- AuthModal props 新增 `onClose?: () => void`
- 模态框右上角添加 X 关闭按钮
- App.tsx 传入 `onClose={() => setIsAuthOpen(false)}`

---

## 2. Req5: 移除私密标识

**文件**: `App.tsx`

- 删除 `renderLinkCard` 中两处 `EyeOff` 徽章（批量编辑模式 + 正常模式）
- 清理 `EyeOff` import（如无其他使用）
- 保留 `LinkItem.private` 字段用于过滤逻辑

---

## 3. Req3: 文件管理优化

**文件**: `components/TransferModal.tsx`

### 网格视图添加下载按钮
在网格视图悬停操作栏（Move 和 Delete 之间）添加：
```tsx
<a href={message.originalUrl || message.content} download className="p-1 bg-black/50 rounded text-white hover:bg-blue-500"><Download className="w-3 h-3" /></a>
```

### 移动弹窗点击外部关闭
- 添加 `useEffect` 监听 `mousedown` 事件
- Move 按钮和菜单 div 添加 `data-move-menu` 属性
- 点击非 `data-move-menu` 区域时 `setShowMoveMenu(null)`

---

## 4. Req1: 卡片垂直布局 + 标题样式配置

**文件**: `App.tsx`, `components/SettingsModal.tsx`

### 卡片布局改为垂直（SortableLinkCard + renderLinkCard）
- 图标在上（居中），标题在下
- `<div className="flex items-center gap-3">` → `<div className="flex flex-col items-center text-center">`
- 标题 `<h3>` 添加 inline style: `color: siteSettings.titleColor`, `fontSize: siteSettings.titleFontSize`
- 简约视图描述提示框位置从 `-top-8` 改为 `top-full mt-1`（卡片下方）

### SettingsModal 新增控件
- 卡片标题颜色：`<input type="color">` + 文本输入 + 清除按钮
- 卡片标题字号：`<input type="range" min="12" max="24">`
- 实时预览卡片
- `handleSiteChange` 添加 `titleColor`/`titleFontSize` 到即时KV保存分支

### App.tsx KV 合并更新
两处合并点（~line 592, ~line 860）添加 `titleColor`, `titleFontSize`

---

## 5. Req2: 背景图片 + 网格列数

### 新建 API: `functions/api/settings/background.ts`
- `onRequestGet`: 从 R2 读取 `background_image` 键，公开访问
- `onRequestPost`: 认证后上传到 R2 固定键 `background_image`，返回 URL
- `onRequestDelete`: 认证后删除
- 使用固定键名，上传新背景自动覆盖旧背景

### App.tsx 背景应用
`<main>` 添加 inline style：
```tsx
style={siteSettings.backgroundImage ? {
  backgroundImage: `url(${siteSettings.backgroundImage})`,
  backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'
} : undefined}
```

### 网格列数映射
```tsx
const GRID_COLUMNS_MAP = {
  3: { detailed: 'grid-cols-2 sm:grid-cols-3 ...', simple: '...' },
  4: { ... }, 5: { ... }, 6: { ... }  // 默认
};
```
替换 7 处网格类名表达式为 `gridClass.detailed` / `gridClass.simple`

**注意**: 必须使用完整字面量类名字符串（Tailwind CDN JIT 扫描要求）

### SettingsModal 新增控件
- 背景图片：上传/预览/移除按钮
- 网格列数：`<input type="range" min="3" max="6">`

---

## 6. Req6: 图片压缩显示

**文件**: `components/TransferModal.tsx`, `functions/api/transfer/upload/index.ts`

### 客户端压缩 (TransferModal)
新增 `compressImage(file, maxSize=300, quality=0.7)` 函数：
- FileReader → Image → Canvas → toBlob('image/jpeg', 0.7)
- 最大尺寸 300px，质量 70%

### 上传逻辑修改
- 图片文件：同时上传原始文件(`file`)和缩略图(`thumbnail`)
- 服务器存储两个文件到 R2
- 消息 `content` = 缩略图URL，`originalUrl` = 原图URL
- 显示用 `content`，下载用 `originalUrl || content`

### 服务器端 (upload/index.ts)
- 读取 `formData.get('thumbnail')`
- 存储为 `xxx_thumb.jpg`
- 返回 `thumbnailUrl` 和 `fileUrl`

### 删除逻辑更新
删除消息时同时删除缩略图和原图（如果不同）

### 网站图标优化
- 3 处 `<img>` 添加 `loading="lazy"`

---

## 验证方法

1. `npx tsc --noEmit` 编译通过
2. 本地测试：
   - 登录弹窗可关闭
   - 卡片图标在上标题在下
   - 设置中调整标题颜色/字号有实时预览
   - 上传背景图后主区域显示背景
   - 调整网格列数后卡片数量变化
   - 文件管理网格视图有下载按钮
   - 点击移动菜单外部可关闭
   - 卡片无私密标识
   - 上传图片后显示压缩版，下载得到原图
3. `git push` 部署验证
