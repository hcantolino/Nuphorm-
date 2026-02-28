# RegulatorySidebar Layout Integration Guide

## Current Problem
The RegulatorySidebar is not flush against the main navigation bar and is shrinking the main content area's usable width.

## Root Cause
The Regulatory page wraps the sidebar and content in a flex container with gap, and the sidebar has its own width that reduces available space for content.

---

## Solution Overview

Your App.tsx structure:
```
<Sidebar /> (fixed width: 80px or 256px)
<main> (marginLeft: 80px or 256px)
  <Regulatory />
    <div className="flex gap-6">
      <RegulatorySidebar /> ← PROBLEM: Not flush, has gap
      <main content>
    </div>
</main>
```

The RegulatorySidebar should be positioned **inside** the main content area but flush against the left edge, with the remaining content taking all available space.

---

# Option 1: CSS Grid (Recommended)

**Best for:** Clean column control, explicit sizing, no gap issues.

### Regulatory.tsx

```tsx
import { Save } from 'lucide-react';
import { useState, useCallback } from 'react';
import RegulatorySidebar from '@/components/regulatory/RegulatorySidebar';
import BottomChatBar from '@/components/regulatory/BottomChatBar';
import RegulatoryControlPanel from '@/components/regulatory/RegulatoryControlPanel';
import ReferencesPanel from '@/components/regulatory/ReferencesPanel';
import DocumentContentPanel from '@/components/regulatory/DocumentContentPanel';
import SaveTechnicalFileDialog from '@/components/regulatory/SaveTechnicalFileDialog';
import AIDocumentGenerator from '@/components/regulatory/AIDocumentGenerator';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import PremiumPaywallPanel from '@/components/PremiumPaywallPanel';
import { useTrialGuard } from '@/hooks/useTrialGuard';

export default function Regulatory() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { activeProjectId, getActiveProject } = useRegulatoryStore();
  const { canGenerate } = useTrialGuard();
  const currentProject = getActiveProject();

  const handleSaveClick = useCallback(() => {
    if (!canGenerate()) {
      setShowPaywall(true);
      return;
    }
    setShowSaveDialog(true);
  }, [canGenerate]);

  const handleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 pb-32">
      {/* Header */}
      <div className="px-4 py-8 border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Create a Regulatory Document</h1>
            <p className="text-lg text-gray-600 mt-2">
              Upload reference documents, generate AI-powered regulatory content, and track source attribution
            </p>
          </div>
          <button
            onClick={handleSaveClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            Save Technical File
          </button>
        </div>
      </div>

      {/* Main Layout: Grid with Sidebar + Content */}
      <div
        className="grid h-full transition-all duration-300 ease-in-out"
        style={{
          gridTemplateColumns: sidebarCollapsed
            ? '60px 1fr' // Collapsed: 60px sidebar + remaining space
            : '250px 1fr', // Expanded: 250px sidebar + remaining space
        }}
      >
        {/* Regulatory Sidebar - Flush Left */}
        <div className="border-r border-gray-200 overflow-hidden">
          <RegulatorySidebar
            isCollapsed={sidebarCollapsed}
            onProjectSelect={(projectId) => console.log('Selected project:', projectId)}
            onSourcesChange={(sources) => console.log('Sources updated:', sources)}
          />
        </div>

        {/* Main Content Area - Takes Remaining Space */}
        <div className="overflow-y-auto">
          <div className="px-4 py-8 max-w-6xl mx-auto space-y-6">
            {/* Collapse Toggle Button */}
            <button
              onClick={handleSidebarCollapse}
              className="mb-4 p-2 text-gray-600 hover:bg-gray-200 rounded transition"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>

            {/* Regulatory Control Panel */}
            <RegulatoryControlPanel />

            {/* AI Document Generator */}
            {currentProject && (
              <AIDocumentGenerator
                projectId={currentProject?.id ? parseInt(currentProject.id) : 0}
                sourceDocuments={[
                  {
                    id: 1,
                    documentName: 'Sample Clinical Data',
                    extractedText: 'Sample clinical trial data and results...',
                  },
                ]}
                deviceInfo={{
                  deviceName: currentProject?.name || 'Medical Device',
                  deviceType: 'diagnostic',
                  intendedUse: currentProject?.description || 'Medical device intended use',
                  predicateDevices: [],
                }}
                onGenerationComplete={() => {
                  console.log('Documents generated successfully');
                }}
              />
            )}

            {/* Dual-Panel Layout: References (Left) and Document Content (Right) */}
            <div className="grid grid-cols-2 gap-6 h-[600px]">
              <ReferencesPanel />
              <DocumentContentPanel />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Chat Bar */}
      <BottomChatBar
        onSendMessage={(message, docType) => console.log('Message:', message, 'DocType:', docType)}
        selectedProject={activeProjectId?.toString()}
        isLoading={false}
      />

      {/* Save Technical File Dialog */}
      <SaveTechnicalFileDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={(folderName, fileName) => {
          console.log(`Saving to ${folderName}/${fileName}`);
          setShowSaveDialog(false);
        }}
        documentContent={currentProject?.content || ''}
      />

      {/* Premium Paywall Panel */}
      {showPaywall && (
        <PremiumPaywallPanel
          title="You need a Premium membership"
          message="Save regulatory documents to access this feature. Please consider upgrading to a Premium plan."
          actionLabel="UNLOCK ACCESS FOR $0"
          onDismiss={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}
```

### Key Points (Option 1 - Grid):
- **Grid columns:** `60px 1fr` (collapsed) or `250px 1fr` (expanded)
- **No gap:** Sidebar and content are flush (no gap-6)
- **Smooth transition:** CSS transition on gridTemplateColumns
- **Sidebar wrapper:** `border-r` for visual separation
- **Content takes remaining space:** Second column is `1fr`
- **Collapse toggle:** Button to toggle `sidebarCollapsed` state

---

# Option 2: Flexbox (If Already Flex-Based)

**Best for:** If your layout is already heavily flex-based.

### Regulatory.tsx

```tsx
import { Save } from 'lucide-react';
import { useState, useCallback } from 'react';
import RegulatorySidebar from '@/components/regulatory/RegulatorySidebar';
import BottomChatBar from '@/components/regulatory/BottomChatBar';
import RegulatoryControlPanel from '@/components/regulatory/RegulatoryControlPanel';
import ReferencesPanel from '@/components/regulatory/ReferencesPanel';
import DocumentContentPanel from '@/components/regulatory/DocumentContentPanel';
import SaveTechnicalFileDialog from '@/components/regulatory/SaveTechnicalFileDialog';
import AIDocumentGenerator from '@/components/regulatory/AIDocumentGenerator';
import { useRegulatoryStore } from '@/stores/regulatoryStore';
import PremiumPaywallPanel from '@/components/PremiumPaywallPanel';
import { useTrialGuard } from '@/hooks/useTrialGuard';

export default function Regulatory() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { activeProjectId, getActiveProject } = useRegulatoryStore();
  const { canGenerate } = useTrialGuard();
  const currentProject = getActiveProject();

  const handleSaveClick = useCallback(() => {
    if (!canGenerate()) {
      setShowPaywall(true);
      return;
    }
    setShowSaveDialog(true);
  }, [canGenerate]);

  const handleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 pb-32">
      {/* Header */}
      <div className="px-4 py-8 border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Create a Regulatory Document</h1>
            <p className="text-lg text-gray-600 mt-2">
              Upload reference documents, generate AI-powered regulatory content, and track source attribution
            </p>
          </div>
          <button
            onClick={handleSaveClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            Save Technical File
          </button>
        </div>
      </div>

      {/* Main Layout: Flex with Sidebar + Content */}
      <div className="flex h-full">
        {/* Regulatory Sidebar - Fixed Width, No Flex Shrink */}
        <div
          className="border-r border-gray-200 overflow-hidden transition-all duration-300 ease-in-out flex-shrink-0"
          style={{
            width: sidebarCollapsed ? '60px' : '250px',
          }}
        >
          <RegulatorySidebar
            isCollapsed={sidebarCollapsed}
            onProjectSelect={(projectId) => console.log('Selected project:', projectId)}
            onSourcesChange={(sources) => console.log('Sources updated:', sources)}
          />
        </div>

        {/* Main Content Area - Flex: 1 to Take Remaining Space */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-8 max-w-6xl mx-auto space-y-6">
            {/* Collapse Toggle Button */}
            <button
              onClick={handleSidebarCollapse}
              className="mb-4 p-2 text-gray-600 hover:bg-gray-200 rounded transition"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>

            {/* Regulatory Control Panel */}
            <RegulatoryControlPanel />

            {/* AI Document Generator */}
            {currentProject && (
              <AIDocumentGenerator
                projectId={currentProject?.id ? parseInt(currentProject.id) : 0}
                sourceDocuments={[
                  {
                    id: 1,
                    documentName: 'Sample Clinical Data',
                    extractedText: 'Sample clinical trial data and results...',
                  },
                ]}
                deviceInfo={{
                  deviceName: currentProject?.name || 'Medical Device',
                  deviceType: 'diagnostic',
                  intendedUse: currentProject?.description || 'Medical device intended use',
                  predicateDevices: [],
                }}
                onGenerationComplete={() => {
                  console.log('Documents generated successfully');
                }}
              />
            )}

            {/* Dual-Panel Layout: References (Left) and Document Content (Right) */}
            <div className="grid grid-cols-2 gap-6 h-[600px]">
              <ReferencesPanel />
              <DocumentContentPanel />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Chat Bar */}
      <BottomChatBar
        onSendMessage={(message, docType) => console.log('Message:', message, 'DocType:', docType)}
        selectedProject={activeProjectId?.toString()}
        isLoading={false}
      />

      {/* Save Technical File Dialog */}
      <SaveTechnicalFileDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={(folderName, fileName) => {
          console.log(`Saving to ${folderName}/${fileName}`);
          setShowSaveDialog(false);
        }}
        documentContent={currentProject?.content || ''}
      />

      {/* Premium Paywall Panel */}
      {showPaywall && (
        <PremiumPaywallPanel
          title="You need a Premium membership"
          message="Save regulatory documents to access this feature. Please consider upgrading to a Premium plan."
          actionLabel="UNLOCK ACCESS FOR $0"
          onDismiss={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}
```

### Key Points (Option 2 - Flexbox):
- **Sidebar wrapper:** `flex-shrink-0` prevents flex from shrinking it
- **Dynamic width:** `width: sidebarCollapsed ? '60px' : '250px'`
- **Smooth transition:** CSS transition on width
- **Content takes space:** `flex-1` on main content div
- **No gap:** Sidebar and content are flush
- **Collapse toggle:** Button to toggle `sidebarCollapsed` state

---

## Comparison

| Aspect | Grid (Option 1) | Flexbox (Option 2) |
|--------|-----------------|-------------------|
| **Clarity** | Explicit column sizing | Implicit with flex-1 |
| **Responsiveness** | Easy to adjust columns | Easy to adjust flex ratios |
| **Collapse Animation** | gridTemplateColumns transition | width transition |
| **Browser Support** | All modern browsers | All modern browsers |
| **Recommended** | ✅ Yes (cleaner) | ✅ Yes (if flex-based) |

---

## CSS Classes Breakdown

### Sidebar Wrapper
```css
/* Flex-shrink-0: Prevents flex from shrinking the sidebar */
flex-shrink-0

/* Transition: Smooth width/column change */
transition-all duration-300 ease-in-out

/* Border: Visual separator */
border-r border-gray-200

/* Overflow: Prevent content overflow */
overflow-hidden
```

### Content Wrapper
```css
/* Flex-1: Takes all remaining space */
flex-1

/* Overflow: Scroll if content exceeds height */
overflow-y-auto

/* Max-width: Constrain content width for readability */
max-w-6xl mx-auto
```

---

## Implementation Steps

1. **Choose Option 1 (Grid) or Option 2 (Flexbox)** based on your preference.
2. **Replace the entire Regulatory.tsx file** with the code from your chosen option.
3. **Test the sidebar collapse/expand** by clicking the toggle button.
4. **Verify:** Sidebar should be flush against left edge, content should expand when sidebar collapses.
5. **No gap:** There should be zero gap between sidebar and content.

---

## Troubleshooting

### Sidebar still has gap
- Ensure `gap-6` is removed from the main layout wrapper
- Check that sidebar wrapper has `flex-shrink-0` (flexbox) or is in grid column

### Content doesn't expand when sidebar collapses
- Verify `flex-1` is on content wrapper (flexbox)
- Verify second column is `1fr` (grid)

### Sidebar width doesn't animate smoothly
- Ensure `transition-all duration-300 ease-in-out` is on sidebar wrapper
- Check that width/gridTemplateColumns changes are in style attribute

### Sidebar overlaps main nav bar
- This is a page-level issue; the sidebar should only appear on the Regulatory page
- Verify RegulatorySidebar is only rendered in Regulatory.tsx, not in App.tsx

---

## Notes

- **RegulatorySidebar internal code:** Not modified (only layout wrapper changed)
- **BottomChatBar:** Remains at bottom, unaffected by layout changes
- **Collapse state:** Managed locally in Regulatory.tsx with `sidebarCollapsed` state
- **Smooth transitions:** CSS handles animation; no JavaScript needed
