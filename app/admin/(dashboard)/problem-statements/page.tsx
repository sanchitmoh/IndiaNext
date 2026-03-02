"use client";

import { useState, useEffect } from "react";
import { 
  FileQuestion, 
  Plus, 
  Edit2, 
  Trash2, 
  Power, 
  PowerOff,
  GripVertical,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  X,
  Save,
} from "lucide-react";

interface ProblemStatement {
  id: string;
  order: number;
  title: string;
  objective: string;
  description: string | null;
  submissionCount: number;
  maxSubmissions: number;
  activeReservations: number;
  isActive: boolean;
  isCurrent: boolean;
  slotsRemaining: number;
  utilizationRate: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProblemStatementsPage() {
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<ProblemStatement | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    title: "",
    objective: "",
    description: "",
    maxSubmissions: 30,
    order: 1,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/problem-statements");
      const data = await res.json();

      if (data.success) {
        setProblems(data.data);
      } else {
        setError(data.error || "Failed to fetch problems");
      }
    } catch (_err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const res = await fetch("/api/admin/problem-statements/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentState }),
      });

      const data = await res.json();
      if (data.success) {
        fetchProblems();
      } else {
        alert(data.error || "Failed to toggle");
      }
    } catch (_err) {
      alert("Network error");
    }
  };

  const openCreateModal = () => {
    const nextOrder = problems.length > 0 ? Math.max(...problems.map(p => p.order)) + 1 : 1;
    setFormData({
      title: "",
      objective: "",
      description: "",
      maxSubmissions: 30,
      order: nextOrder,
      isActive: true,
    });
    setShowCreateModal(true);
  };

  const openEditModal = (problem: ProblemStatement) => {
    setSelectedProblem(problem);
    setFormData({
      title: problem.title,
      objective: problem.objective,
      description: problem.description || "",
      maxSubmissions: problem.maxSubmissions,
      order: problem.order,
      isActive: problem.isActive,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (problem: ProblemStatement) => {
    setSelectedProblem(problem);
    setShowDeleteModal(true);
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.objective) {
      alert("Title and objective are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/problem-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        fetchProblems();
      } else {
        alert(data.error || data.message || "Failed to create problem");
      }
    } catch (_err) {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedProblem || !formData.title || !formData.objective) {
      alert("Title and objective are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/problem-statements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedProblem.id, ...formData }),
      });

      const data = await res.json();
      if (data.success) {
        setShowEditModal(false);
        fetchProblems();
      } else {
        alert(data.error || data.message || "Failed to update problem");
      }
    } catch (_err) {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProblem) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/problem-statements?id=${selectedProblem.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        setShowDeleteModal(false);
        fetchProblems();
      } else {
        alert(data.error || data.message || "Failed to delete problem");
      }
    } catch (_err) {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-mono">LOADING PROBLEMS...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 font-mono">{error}</p>
        </div>
      </div>
    );
  }

  const currentProblem = problems.find(p => p.isCurrent);
  const totalSlots = problems.reduce((sum, p) => sum + p.maxSubmissions, 0);
  const usedSlots = problems.reduce((sum, p) => sum + p.submissionCount, 0);
  const overallUtilization = totalSlots > 0 ? ((usedSlots / totalSlots) * 100).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileQuestion className="w-8 h-8 text-orange-500" />
          <h1 className="text-3xl font-black tracking-tight">
            PROBLEM STATEMENTS
          </h1>
        </div>
        <p className="text-sm text-gray-500 font-mono">
          Manage BuildStorm problem rotation and capacity
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#111] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileQuestion className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-500 font-mono uppercase">Total Problems</span>
          </div>
          <div className="text-2xl font-bold">{problems.length}</div>
          <div className="text-xs text-gray-600 mt-1">
            {problems.filter(p => p.isActive).length} active
          </div>
        </div>

        <div className="bg-[#111] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-500 font-mono uppercase">Total Capacity</span>
          </div>
          <div className="text-2xl font-bold">{totalSlots}</div>
          <div className="text-xs text-gray-600 mt-1">
            {usedSlots} used · {totalSlots - usedSlots} remaining
          </div>
        </div>

        <div className="bg-[#111] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-500 font-mono uppercase">Utilization</span>
          </div>
          <div className="text-2xl font-bold">{overallUtilization}%</div>
          <div className="w-full bg-white/[0.05] rounded-full h-1.5 mt-2">
            <div 
              className="bg-orange-500 h-1.5 rounded-full transition-all"
              style={{ width: `${overallUtilization}%` }}
            />
          </div>
        </div>

        <div className="bg-[#111] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-500 font-mono uppercase">Current Problem</span>
          </div>
          <div className="text-sm font-bold truncate">
            {currentProblem ? `#${currentProblem.order} ${currentProblem.title}` : "None"}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {currentProblem ? `${currentProblem.slotsRemaining} slots left` : "No active problem"}
          </div>
        </div>
      </div>

      {/* Current Problem Highlight */}
      {currentProblem && (
        <div className="bg-gradient-to-r from-orange-500/10 to-cyan-500/10 border border-orange-500/20 rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                <span className="text-xs text-orange-400 font-mono font-bold uppercase tracking-wider">
                  CURRENTLY ACTIVE
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2">
                #{currentProblem.order} {currentProblem.title}
              </h3>
              <p className="text-sm text-gray-400 mb-4">{currentProblem.objective}</p>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Submissions:</span>{" "}
                  <span className="font-bold text-white">
                    {currentProblem.submissionCount}/{currentProblem.maxSubmissions}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Active Reservations:</span>{" "}
                  <span className="font-bold text-cyan-400">{currentProblem.activeReservations}</span>
                </div>
                <div>
                  <span className="text-gray-500">Utilization:</span>{" "}
                  <span className="font-bold text-orange-400">{currentProblem.utilizationRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Problems List */}
      <div className="bg-[#111] border border-white/[0.06] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">All Problem Statements</h2>
            <button 
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              ADD PROBLEM
            </button>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {problems.map((problem) => (
            <div
              key={problem.id}
              className={`p-4 hover:bg-white/[0.02] transition-colors ${
                problem.isCurrent ? "bg-orange-500/5" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Drag Handle */}
                <button type="button" className="mt-1 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing" title="Drag to reorder">
                  <GripVertical className="w-5 h-5" />
                </button>

                {/* Order Badge */}
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                    problem.isCurrent 
                      ? "bg-orange-500 text-white" 
                      : "bg-white/[0.05] text-gray-400"
                  }`}>
                    #{problem.order}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="text-base font-bold mb-1 flex items-center gap-2">
                        {problem.title}
                        {problem.isCurrent && (
                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-mono font-bold rounded border border-orange-500/30">
                            CURRENT
                          </span>
                        )}
                        {!problem.isActive && (
                          <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-[10px] font-mono font-bold rounded border border-gray-500/30">
                            INACTIVE
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-400 line-clamp-2">{problem.objective}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(problem.id, problem.isActive)}
                        className={`p-2 rounded-md transition-colors ${
                          problem.isActive
                            ? "text-green-400 hover:bg-green-500/10"
                            : "text-gray-500 hover:bg-gray-500/10"
                        }`}
                        title={problem.isActive ? "Deactivate" : "Activate"}
                      >
                        {problem.isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => openEditModal(problem)}
                        className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openDeleteModal(problem)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Delete"
                        disabled={problem.submissionCount > 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-gray-500">Submissions:</span>
                      <span className="font-bold text-white">
                        {problem.submissionCount}/{problem.maxSubmissions}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-500" />
                      <span className="text-gray-500">Reserved:</span>
                      <span className="font-bold text-cyan-400">{problem.activeReservations}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-gray-500">Utilization:</span>
                      <span className="font-bold text-orange-400">{problem.utilizationRate}%</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all ${
                          parseFloat(problem.utilizationRate) >= 90 
                            ? "bg-red-500" 
                            : parseFloat(problem.utilizationRate) >= 70 
                            ? "bg-orange-500" 
                            : "bg-green-500"
                        }`}
                        style={{ width: `${problem.utilizationRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/[0.1] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#111] z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-500" />
                Create Problem Statement
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-gray-500 hover:text-white hover:bg-white/[0.05] rounded-md transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">ORDER NUMBER *</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-orange-500/50"
                  min="1"
                  title="Order number for the problem statement"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">TITLE *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-orange-500/50"
                  placeholder="e.g., Disaster Response Coordination"
                  title="Title of the problem statement"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">OBJECTIVE *</label>
                <textarea
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-orange-500/50 min-h-[80px]"
                  placeholder="Brief objective of the problem statement"
                  title="Objective of the problem statement"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">DESCRIPTION (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-orange-500/50 min-h-[120px]"
                  placeholder="Detailed description of the problem statement"
                  title="Detailed description of the problem statement"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">MAX SUBMISSIONS</label>
                <input
                  type="number"
                  value={formData.maxSubmissions}
                  onChange={(e) => setFormData({ ...formData, maxSubmissions: parseInt(e.target.value) || 30 })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-orange-500/50"
                  min="1"
                  max="100"
                  title="Maximum number of submissions allowed"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-white/[0.1] bg-black/40 text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="isActive" className="text-sm font-mono text-gray-400">
                  ACTIVE (Available for assignment)
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-white/[0.06] flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-mono text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-md transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-mono font-bold rounded-md transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {submitting ? "CREATING..." : "CREATE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/[0.1] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#111] z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-500" />
                Edit Problem #{selectedProblem.order}
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 text-gray-500 hover:text-white hover:bg-white/[0.05] rounded-md transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">ORDER NUMBER *</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-cyan-500/50"
                  min="1"
                  title="Order number for the problem statement"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">TITLE *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-cyan-500/50"
                  title="Title of the problem statement"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">OBJECTIVE *</label>
                <textarea
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-cyan-500/50 min-h-[80px]"
                  placeholder="Brief objective of the problem statement"
                  title="Objective of the problem statement"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">DESCRIPTION (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-cyan-500/50 min-h-[120px]"
                  placeholder="Detailed description of the problem statement"
                  title="Detailed description of the problem statement"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">MAX SUBMISSIONS</label>
                <input
                  type="number"
                  value={formData.maxSubmissions}
                  onChange={(e) => setFormData({ ...formData, maxSubmissions: parseInt(e.target.value) || 30 })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-cyan-500/50"
                  min="1"
                  max="100"
                  title="Maximum number of submissions allowed"
                />
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  Current: {selectedProblem.submissionCount} submissions
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActiveEdit"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-white/[0.1] bg-black/40 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="isActiveEdit" className="text-sm font-mono text-gray-400">
                  ACTIVE (Available for assignment)
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-white/[0.06] flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-mono text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-md transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={handleUpdate}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-mono font-bold rounded-md transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {submitting ? "UPDATING..." : "UPDATE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-red-500/20 rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-white/[0.06]">
              <h2 className="text-xl font-bold flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                Delete Problem Statement
              </h2>
            </div>

            <div className="p-6">
              <p className="text-gray-300 mb-4">
                Are you sure you want to delete this problem statement?
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4 mb-4">
                <p className="text-sm font-bold text-white mb-1">
                  #{selectedProblem.order} {selectedProblem.title}
                </p>
                <p className="text-xs text-gray-400">
                  {selectedProblem.submissionCount} submissions · {selectedProblem.activeReservations} active reservations
                </p>
              </div>
              {selectedProblem.submissionCount > 0 ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
                  <p className="text-xs text-yellow-400 font-mono">
                    ⚠️ Cannot delete: This problem has {selectedProblem.submissionCount} submission(s)
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 font-mono">
                  This action cannot be undone.
                </p>
              )}
            </div>

            <div className="p-6 border-t border-white/[0.06] flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-mono text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-md transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting || selectedProblem.submissionCount > 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-mono font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                {submitting ? "DELETING..." : "DELETE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
