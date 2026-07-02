import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckSquare, Plus, Edit2, Trash2, Search, Calendar, Loader2 } from 'lucide-react';
import { TaskItem } from '../types';

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string;
}

const STATUS_LABELS: Record<string, string> = {
  'in-progress': '进行中',
  'completed': '已完成',
  'closed': '关闭',
};

const STATUS_BADGES: Record<string, string> = {
  'in-progress': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
  'completed': 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300',
  'closed': 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
};

const formatTime = (timestamp: number): string => {
  const d = new Date(timestamp);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatMonth = (date: string): string => {
  const [y, m] = date.split('-');
  return `${y}年${parseInt(m)}月`;
};

const TasksModal: React.FC<TasksModalProps> = ({ isOpen, onClose, authToken }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'monthly'>('list');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('in-progress');

  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [formData, setFormData] = useState({ project: '', title: '', status: 'in-progress' as TaskItem['status'] });
  const [formError, setFormError] = useState('');

  const [queryMonth, setQueryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [queryDimension, setQueryDimension] = useState<'createdAt' | 'completedAt'>('createdAt');
  const [monthlyResults, setMonthlyResults] = useState<TaskItem[]>([]);
  const [hasQueried, setHasQueried] = useState(false);
  const [sortField, setSortField] = useState<'createdAt' | 'completedAt' | 'project' | 'title' | 'status'>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (isOpen && authToken) {
      fetchTasks();
    }
  }, [isOpen, authToken]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tasks', {
        headers: { 'x-auth-password': authToken },
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.sort((a: TaskItem, b: TaskItem) => b.createdAt - a.createdAt));
      }
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    }
    setIsLoading(false);
  };

  const projects = useMemo(() => {
    return Array.from(new Set(tasks.map(t => t.project)));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const projectMatch = !filterProject || t.project === filterProject;
      const statusMatch = !filterStatus || t.status === filterStatus;
      const searchMatch = !searchTerm || t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.project.toLowerCase().includes(searchTerm.toLowerCase());
      return projectMatch && statusMatch && searchMatch;
    });
  }, [tasks, filterProject, filterStatus, searchTerm]);

  const handleSubmit = async () => {
    setFormError('');
    if (!formData.project.trim()) { setFormError('请输入项目名称'); return; }
    if (!formData.title.trim()) { setFormError('请输入任务名称'); return; }

    const dup = tasks.some(t => t.project === formData.project.trim() && t.title === formData.title.trim() && t.status !== 'closed' && (!editingTask || t.id !== editingTask.id));
    if (dup) { setFormError('该项目下已存在相同名称的未关闭任务'); return; }

    try {
      if (editingTask) {
        const response = await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-auth-password': authToken },
          body: JSON.stringify(formData),
        });
        if (response.ok) {
          const updated = await response.json();
          setTasks(tasks.map(t => t.id === editingTask.id ? updated : t));
        }
      } else {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-auth-password': authToken },
          body: JSON.stringify(formData),
        });
        if (response.ok) {
          const newTask = await response.json();
          setTasks([newTask, ...tasks]);
        } else {
          const err = await response.json().catch(() => ({}));
          setFormError(err.error || '创建失败');
          return;
        }
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save task', error);
      setFormError('网络错误');
    }
  };

  const resetForm = () => {
    setFormData({ project: '', title: '', status: 'in-progress' });
    setEditingTask(null);
    setIsEditing(false);
    setFormError('');
  };

  const handleEdit = (task: TaskItem) => {
    setEditingTask(task);
    setFormData({ project: task.project, title: task.title, status: task.status });
    setIsEditing(true);
  };

  const handleDelete = async (task: TaskItem) => {
    if (!window.confirm(`确定要删除任务"${task.title}"吗？`)) return;
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { 'x-auth-password': authToken },
      });
      setTasks(tasks.filter(t => t.id !== task.id));
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  const handleStatusChange = async (task: TaskItem, newStatus: TaskItem['status']) => {
    if (task.status === newStatus) return;
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': authToken },
        body: JSON.stringify({ ...task, status: newStatus }),
      });
      if (response.ok) {
        const updated = await response.json();
        setTasks(tasks.map(t => t.id === task.id ? updated : t));
      }
    } catch (error) {
      console.error('Failed to update task status', error);
    }
  };

  const runMonthlyQuery = () => {
    const [year, month] = queryMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1).getTime();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const results = tasks.filter(t => {
      const time = queryDimension === 'createdAt' ? t.createdAt : t.completedAt;
      return time !== undefined && time >= startOfMonth && time <= endOfMonth;
    });

    setMonthlyResults(results);
    setHasQueried(true);
  };

  const sortResults = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedMonthlyResults = useMemo(() => {
    const sorted = [...monthlyResults];
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      if (sortField === 'createdAt') { valA = a.createdAt; valB = b.createdAt; }
      else if (sortField === 'completedAt') { valA = a.completedAt || 0; valB = b.completedAt || 0; }
      else if (sortField === 'project') { valA = a.project; valB = b.project; }
      else if (sortField === 'title') { valA = a.title; valB = b.title; }
      else if (sortField === 'status') { valA = a.status; valB = b.status; }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
    return sorted;
  }, [monthlyResults, sortField, sortAsc]);

  if (!isOpen) return null;

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    <span className="inline-flex flex-col ml-1">
      <span className={`text-[8px] leading-none ${sortField === field && sortAsc ? 'text-blue-500' : 'text-slate-300'}`}>▲</span>
      <span className={`text-[8px] leading-none ${sortField === field && !sortAsc ? 'text-blue-500' : 'text-slate-300'}`}>▼</span>
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">任务管理</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
              {tasks.length}
            </span>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'list' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            任务列表
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'monthly' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            月度查询
          </button>
        </div>

        {activeTab === 'list' ? (
          <>
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">全部项目</option>
                  {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">全部状态</option>
                  <option value="in-progress">进行中</option>
                  <option value="completed">已完成</option>
                  <option value="closed">关闭</option>
                </select>
                <div className="relative flex-1 min-w-[120px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜索任务..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">暂无任务</p>
                  <p className="text-sm text-slate-400 mt-2">在下方添加新任务</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGES[task.status]}`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                          <span className="text-xs text-slate-400">{task.project}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{task.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>建立: {formatTime(task.createdAt)}</span>
                          {task.completedAt && <span>完成: {formatTime(task.completedAt)}</span>}
                        </div>
                      </div>
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value as TaskItem['status'])}
                        className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
                      >
                        <option value="in-progress">进行中</option>
                        <option value="completed">已完成</option>
                        <option value="closed">关闭</option>
                      </select>
                      <button
                        onClick={() => handleEdit(task)}
                        className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(task)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              {isEditing && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-blue-500 font-medium">{editingTask ? '编辑任务' : '新建任务'}</span>
                  <button onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600">取消</button>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  list="task-projects"
                  value={formData.project}
                  onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                  placeholder="项目名称"
                  className="flex-1 min-w-[100px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <datalist id="task-projects">
                  {projects.map(p => <option key={p} value={p} />)}
                </datalist>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="任务名称（必填）"
                  className="flex-1 min-w-[120px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                />
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskItem['status'] })}
                  className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="in-progress">进行中</option>
                  <option value="completed">已完成</option>
                  <option value="closed">关闭</option>
                </select>
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
                >
                  {editingTask ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editingTask ? '保存' : '添加'}
                </button>
              </div>
              {formError && <p className="text-xs text-red-500 mt-2">{formError}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="month"
                    value={queryMonth}
                    onChange={(e) => setQueryMonth(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={queryDimension === 'createdAt'}
                      onChange={() => setQueryDimension('createdAt')}
                      className="text-blue-500"
                    />
                    建立时间
                  </label>
                  <label className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={queryDimension === 'completedAt'}
                      onChange={() => setQueryDimension('completedAt')}
                      className="text-blue-500"
                    />
                    完成时间
                  </label>
                </div>
                <button
                  onClick={runMonthlyQuery}
                  className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Search className="w-4 h-4" />
                  查询
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                查询 {formatMonth(queryMonth)} 期间按{queryDimension === 'createdAt' ? '建立时间' : '完成时间'}的任务记录
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {hasQueried ? (
                sortedMonthlyResults.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">该月份无任务记录</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                          <th className="text-left py-2 px-2 cursor-pointer hover:text-blue-500 whitespace-nowrap" onClick={() => sortResults('project')}>
                            项目<SortIcon field="project" />
                          </th>
                          <th className="text-left py-2 px-2 cursor-pointer hover:text-blue-500 whitespace-nowrap" onClick={() => sortResults('title')}>
                            任务名<SortIcon field="title" />
                          </th>
                          <th className="text-left py-2 px-2 cursor-pointer hover:text-blue-500 whitespace-nowrap" onClick={() => sortResults('status')}>
                            状态<SortIcon field="status" />
                          </th>
                          <th className="text-left py-2 px-2 cursor-pointer hover:text-blue-500 whitespace-nowrap" onClick={() => sortResults('createdAt')}>
                            建立时间<SortIcon field="createdAt" />
                          </th>
                          <th className="text-left py-2 px-2 cursor-pointer hover:text-blue-500 whitespace-nowrap" onClick={() => sortResults('completedAt')}>
                            完成时间<SortIcon field="completedAt" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedMonthlyResults.map(task => (
                          <tr key={task.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2 px-2 text-slate-700 dark:text-slate-300">{task.project}</td>
                            <td className="py-2 px-2 text-slate-800 dark:text-slate-100">{task.title}</td>
                            <td className="py-2 px-2">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGES[task.status]}`}>
                                {STATUS_LABELS[task.status]}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-xs text-slate-500 whitespace-nowrap">{formatTime(task.createdAt)}</td>
                            <td className="py-2 px-2 text-xs text-slate-500 whitespace-nowrap">{task.completedAt ? formatTime(task.completedAt) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 text-xs text-slate-400 text-center">
                      共 {sortedMonthlyResults.length} 条记录
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">选择月份并点击查询</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TasksModal;
