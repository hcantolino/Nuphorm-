const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/pages/Biostatistics.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the problematic subscribe call
const oldCode = `  // Auto-save tab state on changes
  useEffect(() => {
    const unsubscribe = useTabStore.subscribe(
      (state) => state.tabs,
      () => {
        const { tabs, activeTabId: currentActiveTabId } = useTabStore.getState();
        const { tabContent } = useTabContentStore.getState();
        saveTabState(tabs, currentActiveTabId, tabContent);
      }
    );
    return unsubscribe;
  }, []);`;

const newCode = `  // Auto-save tab state on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const { tabs, activeTabId: currentActiveTabId } = useTabStore.getState();
      const { tabContent } = useTabContentStore.getState();
      saveTabState(tabs, currentActiveTabId, tabContent);
    }, 500);
    return () => clearTimeout(timer);
  }, [activeTabId]);`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed Biostatistics.tsx');
