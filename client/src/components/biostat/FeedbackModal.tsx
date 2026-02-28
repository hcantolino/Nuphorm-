import { useState } from 'react';
import { X, Send, AlertCircle, Lightbulb, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackData) => Promise<void>;
  isLoading?: boolean;
}

export interface FeedbackData {
  feedbackType: 'bug' | 'suggestion' | 'feature_request' | 'general';
  category: string;
  title: string;
  description: string;
  userEmail?: string;
}

const FEEDBACK_TYPES = [
  {
    id: 'bug',
    label: 'Report a Bug',
    icon: AlertCircle,
    description: 'Something is not working as expected',
    color: 'text-red-600',
  },
  {
    id: 'suggestion',
    label: 'Suggest an Improvement',
    icon: Lightbulb,
    description: 'Improve existing features',
    color: 'text-yellow-600',
  },
  {
    id: 'feature_request',
    label: 'Request a Feature',
    icon: Zap,
    description: 'Request a new feature or capability',
    color: 'text-blue-600',
  },
  {
    id: 'general',
    label: 'General Feedback',
    icon: AlertCircle,
    description: 'Other feedback or comments',
    color: 'text-gray-600',
  },
];

const CATEGORIES = {
  bug: ['Chart Display', 'Data Loading', 'Export/Download', 'Performance', 'UI/UX', 'Other'],
  suggestion: ['Chart Features', 'Data Analysis', 'User Interface', 'Workflow', 'Documentation', 'Other'],
  feature_request: ['New Chart Type', 'Data Import', 'Collaboration', 'Analytics', 'Integration', 'Other'],
  general: ['General', 'Pricing', 'Support', 'Other'],
};

export default function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: FeedbackModalProps) {
  const [selectedType, setSelectedType] = useState<FeedbackData['feedbackType']>('bug');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    if (!category) {
      toast.error('Please select a category');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        feedbackType: selectedType,
        category,
        title: title.trim(),
        description: description.trim(),
        userEmail: userEmail.trim() || undefined,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('');
      setUserEmail('');
      setSelectedType('bug');
      onClose();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCategories = CATEGORIES[selectedType] || [];
  const selectedTypeObj = FEEDBACK_TYPES.find((t) => t.id === selectedType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
          <DialogDescription>
            Help us improve by reporting issues or suggesting improvements
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Feedback Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900">Feedback Type</label>
            <div className="grid grid-cols-2 gap-3">
              {FEEDBACK_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setSelectedType(type.id as FeedbackData['feedbackType']);
                      setCategory('');
                    }}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      selectedType === type.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`w-5 h-5 mt-0.5 ${type.color}`} />
                      <div>
                        <p className="font-medium text-sm text-gray-900">{type.label}</p>
                        <p className="text-xs text-gray-600">{type.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Select a category...</option>
              {currentCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900">Title</label>
            <Input
              type="text"
              placeholder="Brief summary of your feedback"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting || isLoading}
              maxLength={255}
            />
            <p className="text-xs text-gray-500">{title.length}/255</p>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900">Description</label>
            <Textarea
              placeholder="Provide details about your feedback. Include steps to reproduce if reporting a bug."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting || isLoading}
              rows={5}
              maxLength={2000}
            />
            <p className="text-xs text-gray-500">{description.length}/2000</p>
          </div>

          {/* Email (Optional) */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900">
              Email <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <Input
              type="email"
              placeholder="your@email.com (so we can follow up)"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              disabled={isSubmitting || isLoading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {isSubmitting || isLoading ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
