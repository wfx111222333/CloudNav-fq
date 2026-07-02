# 任务管理模块开发计划

## Context
用户需要一个功能完整的任务管理模块，支持任务的增删改查、月度任务查询、项目管理和状态管理。需遵循项目现有的模块化架构（参考 NotesModal/TransferModal 模式），数据存储使用 Cloudflare KV。

## 文件清单

### 新建文件
1. **`functions/api/tasks/index.ts`** — GET 列表 + POST 创建（复制 `functions/api/notes/index.ts` 模式）
2. **`functions/api/tasks/[id].ts`** — PUT 更新 + DELETE 删除（复制 `functions/api/notes/[id].ts` 模式）
3. **`components/TasksModal.tsx`** — 任务管理模态框组件（参考 `components/NotesModal.tsx` 骨架）

### 修改文件
4. **`types.ts`** — 新增 `TaskItem` 接口
5. **`App.tsx`** — 3 处修改：新增状态、侧边栏按钮、模态框挂载

## 实现细节

### 1. 类型定义（types.ts）

```typescript
export interface TaskItem {
  id: string;
  project: string;           // 项目名称
  title: string;             // 任务名称（必填）
  status: 'in-progress' | 'completed' | 'closed';  // 进行中/已完成/关闭
  createdAt: number;         // 建立时间（自动）
  completedAt?: number;      // 完成时间（状态变更为已完成时自动设置）
  updatedAt: number;
}
```

### 2. API 路由

**`functions/api/tasks/index.ts`**：
- `onRequestGet` — 读取 KV `tasks_data`，返回 JSON 数组
- `onRequestPost` — 创建任务，自动设置 `createdAt`/`updatedAt`，存入 KV
- `onRequestOptions` — CORS 预检
- KV key: `tasks_data`
- 认证: `x-auth-password` 头，默认密码 `cloudnav`

**`functions/api/tasks/[id].ts`**：
- `onRequestPut` — 更新任务，状态变更为 `completed` 时自动设置 `completedAt`
- `onRequestDelete` — 删除任务
- `onRequestOptions` — CORS 预检

### 3. TasksModal 组件

**Props**：`{ isOpen, onClose, authToken }`（与 NotesModal 一致）

**布局结构**（两个 Tab）：

**Tab 1: 任务列表**
- 顶部工具栏：项目下拉筛选 + 状态筛选 + 搜索框
- 任务列表：每行显示项目、任务名、状态徽章、建立时间、完成时间
- 每行有编辑/删除按钮
- 底部：新增任务表单
  - 项目输入：`<input list>` + `<datalist>`（首次手动输入，后续下拉选择已有项目）
  - 任务名称：必填文本框
  - 状态：下拉选择
  - 提交按钮

**Tab 2: 月度查询**
- 月份选择器：`<input type="month">`
- 时间维度选择：单选按钮「建立时间 / 完成时间」
- 查询按钮
- 结果表格：项目、任务名、状态、建立时间、完成时间
- 表格支持点击表头排序

**状态变更逻辑**：
- 状态改为 `completed` → 自动设置 `completedAt = Date.now()`
- 状态从 `completed` 改回其他 → 清除 `completedAt`

**表单验证**：
- 任务名称不能为空
- 项目名称不能为空
- 防止重复：检查同一项目下是否已存在相同名称的未关闭任务

**状态徽章颜色**：
- 进行中：蓝色 `bg-blue-100 text-blue-600`
- 已完成：绿色 `bg-green-100 text-green-600`
- 关闭：灰色 `bg-slate-100 text-slate-500`

### 4. App.tsx 集成

- 第 121 行附近：`const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);`
- 侧边栏（`authToken &&` 块内，便签按钮附近）：
  ```tsx
  <button onClick={() => { setIsTasksModalOpen(true); setSidebarOpen(false); }}>
    <CheckSquare size={18} /> 任务管理
  </button>
  ```
- 模态框挂载区（NotesModal 附近）：
  ```tsx
  <TasksModal isOpen={isTasksModalOpen} onClose={() => setIsTasksModalOpen(false)} authToken={authToken} />
  ```

## 验证方式
1. `npm run build` 确保编译通过
2. 本地 `npm run dev` 测试 CRUD 功能
3. 验证状态变更时 `completedAt` 自动更新
4. 验证月度查询按时间维度筛选正确
5. 验证项目下拉选择已有项目
