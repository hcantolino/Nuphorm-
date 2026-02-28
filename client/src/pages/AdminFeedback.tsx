import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertCircle,
  Lightbulb,
  Zap,
  MessageSquare,
  ChevronDown,
  Search,
  Filter,
  TrendingUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type FeedbackType = 'bug' | 'suggestion' | 'feature_request' | 'general';
type FeedbackStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface Feedback {
  id: number;
  userId: number;
  feedbackType: FeedbackType;
  category: string;
  title: string;
  description: string;
  page?: string;
  userEmail?: string;
  status: FeedbackStatus;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
}

const FEEDBACK_TYPE_ICONS: Record<FeedbackType, any> = {
  bug: AlertCircle,
  suggestion: Lightbulb,
  feature_request: Zap,
  general: MessageSquare,
};

const FEEDBACK_TYPE_COLORS: Record<FeedbackType, string> = {
  bug: 'text-red-600 bg-red-50',
  suggestion: 'text-yellow-600 bg-yellow-50',
  feature_request: 'text-blue-600 bg-blue-50',
  general: 'text-gray-600 bg-gray-50',
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'text-gray-600',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
};

export default function AdminFeedback() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<FeedbackType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [newStatus, setNewStatus] = useState<FeedbackStatus>('new');

  // Fetch all feedback
  const { data: allFeedback = [], isLoading, refetch } = trpc.feedback.getAllFeedback.useQuery(
    undefined,
    {
      enabled: user?.role === 'admin',
    }
  );

  // Update feedback status mutation
  const updateStatusMutation = trpc.feedback.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Feedback status updated');
      refetch();
      setSelectedFeedback(null);
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  // Check admin access
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Filter and sort feedback
  const filteredFeedback = useMemo(() => {
    let filtered = allFeedback as Feedback[];

    // Apply filters
    if (selectedType !== 'all') {
      filtered = filtered.filter((f) => f.feedbackType === selectedType);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((f) => f.status === selectedStatus);
    }

    if (selectedPriority !== 'all') {
      filtered = filtered.filter((f) => f.priority === selectedPriority);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.title.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query) ||
          f.category.toLowerCase().includes(query) ||
          f.userEmail?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allFeedback, selectedType, selectedStatus, selectedPriority, searchQuery, sortBy, sortOrder]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = allFeedback.length;
    const byType = {
      bug: allFeedback.filter((f: any) => f.feedbackType === 'bug').length,
      suggestion: allFeedback.filter((f: any) => f.feedbackType === 'suggestion').length,
      feature_request: allFeedback.filter((f: any) => f.feedbackType === 'feature_request').length,
      general: allFeedback.filter((f: any) => f.feedbackType === 'general').length,
    };
    const byStatus = {
      new: allFeedback.filter((f: any) => f.status === 'new').length,
      acknowledged: allFeedback.filter((f: any) => f.status === 'acknowledged').length,
      in_progress: allFeedback.filter((f: any) => f.status === 'in_progress').length,
      resolved: allFeedback.filter((f: any) => f.status === 'resolved').length,
      closed: allFeedback.filter((f: any) => f.status === 'closed').length,
    };

    return { total, byType, byStatus };
  }, [allFeedback]);

  const handleStatusUpdate = async () => {
    if (!selectedFeedback) return;

    try {
      await updateStatusMutation.mutateAsync({
        feedbackId: selectedFeedback.id,
        status: newStatus,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Feedback Management</h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Feedback</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Bugs</p>
              <p className="text-2xl font-bold text-red-600">{stats.byType.bug}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Suggestions</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.byType.suggestion}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Feature Requests</p>
              <p className="text-2xl font-bold text-blue-600">{stats.byType.feature_request}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Resolved</p>
              <p className="text-2xl font-bold text-green-600">{stats.byStatus.resolved}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters & Search</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search title, description, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Types</option>
                <option value="bug">Bug</option>
                <option value="suggestion">Suggestion</option>
                <option value="feature_request">Feature Request</option>
                <option value="general">General</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Sort by:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="date">Date</option>
              <option value="priority">Priority</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Feedback Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading feedback...</div>
          ) : filteredFeedback.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No feedback found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Title</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Priority</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredFeedback.map((feedback: Feedback) => {
                    const Icon = FEEDBACK_TYPE_ICONS[feedback.feedbackType];
                    return (
                      <tr key={feedback.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${FEEDBACK_TYPE_COLORS[feedback.feedbackType]}`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium capitalize">
                              {feedback.feedbackType.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{feedback.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{feedback.category}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[feedback.status]}`}>
                            {feedback.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-medium capitalize ${PRIORITY_COLORS[feedback.priority]}`}>
                            {feedback.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(feedback.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedFeedback(feedback);
                              setNewStatus(feedback.status);
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredFeedback.length} of {stats.total} feedback items
        </div>
      </div>

      {/* Feedback Detail Modal */}
      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Feedback Details</DialogTitle>
            <DialogDescription>View and manage this feedback submission</DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${FEEDBACK_TYPE_COLORS[selectedFeedback.feedbackType]}`}>
                    <span className="text-sm font-medium capitalize">
                      {selectedFeedback.feedbackType.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <span className={`text-sm font-medium capitalize ${PRIORITY_COLORS[selectedFeedback.priority]}`}>
                    {selectedFeedback.priority}
                  </span>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <p className="text-gray-900 font-medium">{selectedFeedback.title}</p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <p className="text-gray-600">{selectedFeedback.category}</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <p className="text-gray-600 whitespace-pre-wrap">{selectedFeedback.description}</p>
              </div>

              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
                  <p className="text-gray-600">{selectedFeedback.userEmail || 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Page</label>
                  <p className="text-gray-600">{selectedFeedback.page || 'Unknown'}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Submitted</label>
                  <p className="text-gray-600">{new Date(selectedFeedback.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                  <p className="text-gray-600">{new Date(selectedFeedback.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Status Update */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700">Update Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as FeedbackStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">New</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <Button
                  onClick={handleStatusUpdate}
                  disabled={updateStatusMutation.isPending || newStatus === selectedFeedback.status}
                  className="w-full"
                >
                  {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
