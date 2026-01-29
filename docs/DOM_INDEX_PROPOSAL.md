# Semantic DOM Index for AI Manipulation

## Problem Statement

Current DOM snapshot approaches face challenges:
1. **Flat lists are overwhelming** - Hundreds of interactive elements without context
2. **Full tree dumps are verbose** - Token-expensive, most content irrelevant
3. **No semantic grouping** - AI can't reason about page regions
4. **Linear traversal required** - Must scan entire output to find relevant elements

## Proposed Solution: Hierarchical Semantic Index

Inspired by PageIndex's document retrieval approach, create a **multi-level DOM index** that enables AI to:
1. Understand page structure at a glance
2. Drill down into relevant sections
3. Get actionable element refs with minimal token cost

## Architecture

### Level 0: Page Overview (Head Mode - Existing)

Quick metadata scan without deep traversal:

```
PAGE: https://example.com/dashboard
TITLE: "User Dashboard"
VIEWPORT: 1920x1080
STATUS: interactive

LANDMARKS: 4 (header, nav, main, footer)
INTERACTIVE: 156 elements
FORMS: 2
```

**Cost:** O(1) - instant
**Use:** Verify page loaded, understand scale

---

### Level 1: Semantic Regions (NEW)

Group elements by **semantic landmark** with summaries:

```
REGIONS:

  [R0] HEADER /body/header
       Summary: "Site branding, user menu, notifications"
       Interactive: 8 (3 buttons, 4 links, 1 menu)

  [R1] NAV /body/nav.sidebar
       Summary: "Main navigation with 12 menu items"
       Interactive: 14 (12 links, 2 buttons)
       Subsections: Dashboard, Projects, Settings, Help

  [R2] MAIN /body/main#content
       Summary: "Data table with filtering and pagination"
       Interactive: 89 (45 buttons, 12 links, 8 inputs, 24 checkboxes)
       Subsections: Filters, DataTable, Pagination

  [R3] FOOTER /body/footer
       Summary: "Copyright, legal links, version info"
       Interactive: 5 (5 links)
```

**Cost:** O(n) single pass, ~500 tokens
**Use:** AI decides which region contains target elements

---

### Level 2: Region Details (On-Demand)

Expand a specific region with full element refs:

```
REQUEST: expand R2.Filters

REGION: R2.Filters /body/main/section.filters
Summary: "Search and date range filtering"

ELEMENTS:
  SEARCHBOX "Search projects..." @ref:12 [placeholder]
  BUTTON "Search" @ref:13 [type=submit]
  COMBOBOX "Status" @ref:14 [options: All, Active, Archived]
  DATEPICKER "Start date" @ref:15
  DATEPICKER "End date" @ref:16
  BUTTON "Apply Filters" @ref:17 [primary]
  BUTTON "Reset" @ref:18
```

**Cost:** O(k) where k = elements in region, ~200 tokens
**Use:** Get actionable refs for specific task

---

### Level 3: Element Context (On-Demand)

Deep dive into single element with full context:

```
REQUEST: context @ref:14

ELEMENT: COMBOBOX "Status" @ref:14
XPath: /body/main/section.filters/div.filter-group[2]/select
BBox: { x: 450, y: 120, width: 200, height: 40 }
InViewport: true

ATTRIBUTES:
  id: "status-filter"
  name: "status"
  required: false

OPTIONS:
  [0] "All" (selected)
  [1] "Active"
  [2] "Archived"
  [3] "Pending Review"

PARENT CONTEXT:
  FORM @ref:11 "Filter Form"
  └── FIELDSET "Filter Options"
      └── THIS ELEMENT

NEARBY INTERACTIVE:
  ← SEARCHBOX @ref:12 "Search projects..."
  → DATEPICKER @ref:15 "Start date"
  ↓ BUTTON @ref:17 "Apply Filters"
```

**Cost:** O(1) lookup + small traversal, ~150 tokens
**Use:** Understand element before complex interaction

---

## Implementation

### New Actions

```typescript
// packages/core/src/types.ts

interface SnapshotRegionsCommand extends BaseCommand {
  action: 'snapshotRegions';
  // Returns Level 1 semantic overview
}

interface ExpandRegionCommand extends BaseCommand {
  action: 'expandRegion';
  region: string;  // e.g., "R2" or "R2.Filters"
  // Returns Level 2 detailed elements
}

interface ElementContextCommand extends BaseCommand {
  action: 'elementContext';
  selector: string;  // @ref:N or CSS selector
  // Returns Level 3 deep context
}
```

### Semantic Region Detection

```typescript
// packages/core/src/semantic-regions.ts

interface SemanticRegion {
  id: string;           // R0, R1, etc.
  landmark: string;     // header, nav, main, etc.
  xpath: string;        // Semantic xpath
  summary: string;      // AI-generated or heuristic summary
  subsections: string[];
  interactiveCounts: {
    buttons: number;
    links: number;
    inputs: number;
    other: number;
  };
  boundingBox: BoundingBox;
}

function detectSemanticRegions(document: Document): SemanticRegion[] {
  // 1. Find landmark elements (header, nav, main, aside, footer)
  // 2. Within main, find semantic sections (article, section, form)
  // 3. Generate summaries from:
  //    - Heading content (h1-h6)
  //    - ARIA labels
  //    - Visible button/link text (first 5)
  //    - Form purposes (login, search, filter, etc.)
  // 4. Count interactive elements per region
}
```

### Summary Generation Heuristics

```typescript
function generateRegionSummary(region: Element): string {
  const parts: string[] = [];

  // 1. Check for primary heading
  const heading = region.querySelector('h1, h2, h3, [role="heading"]');
  if (heading) parts.push(heading.textContent?.trim());

  // 2. Identify purpose from common patterns
  const purposes = detectPurpose(region);
  // - Has search input → "Search functionality"
  // - Has data-table → "Data table with N rows"
  // - Has form → "Form for [action]"
  // - Has nav links → "Navigation with N items"

  // 3. Summarize key interactive elements
  const keyElements = getKeyInteractiveElements(region, 3);
  // Returns most prominent: primary buttons, labeled inputs, main links

  return parts.filter(Boolean).join(', ');
}
```

---

## Usage Flow for AI Agent

### Task: "Click the 'Export' button in the data table"

**Step 1: Get Overview**
```
AI → snapshotRegions
← Returns 4 regions, R2 MAIN has "Data table with filtering"
```

**Step 2: Expand Relevant Region**
```
AI → expandRegion { region: "R2" }
← Returns subsections: Filters, DataTable, Pagination, Actions
AI → expandRegion { region: "R2.Actions" }
← Returns: BUTTON "Export" @ref:45, BUTTON "Import" @ref:46, ...
```

**Step 3: Execute Action**
```
AI → click { selector: "@ref:45" }
← Success
```

**Token Cost:** ~800 tokens (vs 3000+ for full snapshot)

---

## Benefits

### 1. Token Efficiency
- Only fetch what's needed
- Typical interaction: 3 API calls, ~1000 tokens total
- vs. full snapshot: 1 call, 3000-5000 tokens

### 2. Better Reasoning
- AI understands page structure before diving in
- Semantic summaries provide intent context
- Natural language descriptions aid decision-making

### 3. Scalability
- Works on complex pages with 500+ elements
- Lazy expansion prevents information overload
- Predictable token costs per operation

### 4. Explainability
- Clear path: Region → Subsection → Element
- AI can explain: "I found Export in R2.Actions, the table actions section"
- Debugging: trace which region was explored

### 5. Robustness
- Semantic landmarks stable across page updates
- Summary-based matching resilient to minor UI changes
- Hierarchical refs allow fallback strategies

---

## Comparison with Current Approach

| Aspect | Current Snapshot | Semantic Index |
|--------|------------------|----------------|
| Token cost | 2000-5000 | 200-1000 |
| Page understanding | Linear scan | Hierarchical |
| Large pages | Truncated/slow | Lazy loading |
| AI reasoning | Pattern matching | Semantic navigation |
| Element finding | Grep through text | Region-guided |

---

## Implementation Phases

### Phase 1: Region Detection
- Implement `detectSemanticRegions()`
- Add `snapshotRegions` action
- Generate basic summaries from headings/labels

### Phase 2: Expand/Context Commands
- Implement `expandRegion` action
- Implement `elementContext` action
- Add subsection detection within regions

### Phase 3: AI-Assisted Summaries (Optional)
- Use lightweight model for better summaries
- Cache summaries per page structure
- Learn from user corrections

### Phase 4: Reasoning Integration
- Build prompt templates for region-based navigation
- Add region hints to error messages
- Create multi-step planning helpers

---

## Alternative Approaches Considered

### 1. Full Chunking (Rejected)
Split DOM into fixed-size chunks. Problems:
- Breaks semantic boundaries
- No hierarchy understanding
- Random access difficult

### 2. Vector Embedding (Rejected for Now)
Embed elements as vectors for similarity search. Problems:
- Requires embedding model
- Overkill for structured DOM
- Harder to explain selections

### 3. Visual Segmentation (Future)
Use screenshot + vision model to identify regions. Benefits:
- Handles canvas/SVG content
- Visual grouping matches user perception
Could complement semantic approach in Phase 4.

---

## Open Questions

1. **Summary Quality:** How good are heuristic summaries vs. AI-generated?
2. **Region Granularity:** What's the ideal subsection depth?
3. **Caching:** Should region structure be cached across snapshots?
4. **Hybrid Mode:** When to use flat snapshot vs. hierarchical?

---

## Appendix: Example Full Flow

```typescript
// AI agent implementation example

async function findAndClickButton(agent, buttonText: string) {
  // Step 1: Get page overview
  const regions = await agent.execute({ action: 'snapshotRegions' });

  // Step 2: Find likely region
  const targetRegion = regions.find(r =>
    r.summary.toLowerCase().includes(buttonText.toLowerCase()) ||
    r.interactiveCounts.buttons > 0
  );

  // Step 3: Expand region
  const elements = await agent.execute({
    action: 'expandRegion',
    region: targetRegion.id
  });

  // Step 4: Find button
  const button = elements.find(e =>
    e.role === 'button' &&
    e.name.toLowerCase().includes(buttonText.toLowerCase())
  );

  // Step 5: Click
  await agent.execute({ action: 'click', selector: button.ref });
}
```
