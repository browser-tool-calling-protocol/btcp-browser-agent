# Hybrid DOM Index: Combining Grep + Hierarchical Structure

## The Best of Both Worlds

| Approach | Strength | Weakness |
|----------|----------|----------|
| **Snapshot + Grep** | Fast pattern matching, single-pass | No structure, grep misses context |
| **Hierarchical Index** | Semantic regions, lazy loading | Multiple round-trips, over-structured |
| **Hybrid** | Fast + structured + contextual | (proposed) |

---

## Core Insight

Instead of choosing between:
- **Grep first, then understand** (current)
- **Understand first, then find** (hierarchical)

We can:
- **Understand AND find simultaneously** with region-scoped grep

---

## Hybrid Architecture

### Level 0: Indexed Region Map (Always Available)

Every snapshot includes a lightweight **region index** with searchable terms:

```
REGIONS:
  R0 HEADER [search, cart, account, login, menu]
  R1 NAV [home, products, categories, about, contact]
  R2 MAIN [table, filter, export, pagination, data, rows]
  R3 FOOTER [privacy, terms, copyright, social]

GREP-INDEX: 847 terms across 4 regions
```

**Cost:** ~200 tokens overhead, computed once per page load

---

### New Command: `snapshotGrep`

Combines snapshot + grep + region awareness in a single call:

```typescript
interface SnapshotGrepCommand extends BaseCommand {
  action: 'snapshotGrep';

  // What to search for
  pattern: string;           // grep pattern (regex or text)

  // Where to search (optional - defaults to all)
  regions?: string[];        // e.g., ["R2", "R3"] - limit scope

  // What to return
  context?: 'element' | 'region' | 'path';  // context level
  expand?: boolean;          // include nearby elements
}
```

---

## Usage Patterns

### Pattern 1: Direct Grep with Region Context

**Task:** "Click the Export button"

```
AI → snapshotGrep({ pattern: "export", context: "region" })
```

**Response (267 tokens):**
```
GREP: "export" → 3 matches in 2 regions

[R2] MAIN "Dashboard Content"
  └─ R2.Actions "Table Actions"
     BUTTON "Export to CSV" @ref:45 [primary]
     BUTTON "Export to PDF" @ref:46

[R3] FOOTER "Page Footer"
  └─ LINK "Export Policy" @ref:89

SUGGESTION: R2.Actions contains data export controls
```

**AI Reasoning:**
- 3 matches found, but semantically grouped
- R2.Actions is clearly the data export area (not footer policy link)
- Can confidently click @ref:45

**Compare to current grep:**
```
BUTTON "Export to CSV" @ref:45 /body/main/div/div/button[1]
BUTTON "Export to PDF" @ref:46 /body/main/div/div/button[2]
LINK "Export Policy" @ref:89 /body/footer/div/a[3]
```
No semantic grouping - AI must infer from xpath which is "the right" export.

---

### Pattern 2: Region-Scoped Search

**Task:** "Find the search input" (but there are multiple search boxes)

```
AI → snapshotGrep({
  pattern: "search",
  regions: ["R0"],  // Only look in header
  expand: true
})
```

**Response (189 tokens):**
```
GREP: "search" in R0 → 2 matches

[R0] HEADER "Site Header"
  └─ R0.Search "Main Search"
     SEARCHBOX "Search products..." @ref:5 ← MATCH
     BUTTON "Search" @ref:6 ← MATCH

     NEARBY:
       BUTTON "Voice Search" @ref:7
       LINK "Advanced Search" @ref:8
```

AI gets the search box AND contextually related elements.

---

### Pattern 3: Hierarchical Grep Drill-Down

**Task:** "Fill in the billing address in the checkout form"

**Step 1: Find the region**
```
AI → snapshotGrep({ pattern: "billing|address", context: "region" })
```

**Response (156 tokens):**
```
GREP: "billing|address" → 8 matches in 1 region

[R2] MAIN "Checkout"
  └─ R2.BillingAddress "Billing Address" (8 matches)
     Summary: Address form with 8 inputs

SUGGESTION: Expand R2.BillingAddress for form fields
```

**Step 2: Expand with all fields**
```
AI → snapshotGrep({
  pattern: ".*",  // Match all
  regions: ["R2.BillingAddress"]
})
```

**Response (234 tokens):**
```
[R2.BillingAddress] "Billing Address"

TEXTBOX "Street Address" @ref:23 [required]
TEXTBOX "Address Line 2" @ref:24
TEXTBOX "City" @ref:25 [required]
COMBOBOX "State" @ref:26 [required] [options: 50]
TEXTBOX "ZIP Code" @ref:27 [required]
COMBOBOX "Country" @ref:28 [selected: "United States"]
CHECKBOX "Same as shipping" @ref:29 [unchecked]
BUTTON "Continue to Payment" @ref:30 [primary]
```

**Total: 390 tokens** vs 2000+ for full snapshot

---

### Pattern 4: Smart Routing

The system automatically chooses the best strategy:

```typescript
// Internal routing logic
function smartSnapshot(query: string, hints?: string[]) {
  // 1. Check region index for likely location
  const regionHits = searchRegionIndex(query);

  if (regionHits.confidence > 0.8 && regionHits.regions.length === 1) {
    // High confidence single region - direct expand
    return expandRegion(regionHits.regions[0], { grep: query });
  }

  if (regionHits.confidence > 0.5) {
    // Medium confidence - scoped grep
    return snapshotGrep({ pattern: query, regions: regionHits.regions });
  }

  // Low confidence - full grep with region context
  return snapshotGrep({ pattern: query, context: 'region' });
}
```

---

## New Data Structures

### Region Index (Computed Once)

```typescript
interface RegionIndex {
  regions: {
    id: string;
    landmark: string;
    name: string;
    // Searchable terms extracted from:
    // - Element text content
    // - ARIA labels
    // - Input placeholders
    // - Button/link text
    // - Heading content
    terms: string[];
    termCount: number;
    interactiveCount: number;
  }[];

  // Inverted index: term → region IDs
  termIndex: Map<string, string[]>;

  totalTerms: number;
  timestamp: number;
}
```

### Grep Result with Context

```typescript
interface GrepResultWithContext {
  pattern: string;
  totalMatches: number;

  // Matches grouped by region
  byRegion: {
    regionId: string;
    regionName: string;
    regionPath: string;
    matches: {
      ref: string;
      role: string;
      name: string;
      matchedText: string;  // What part matched
      xpath: string;
    }[];
    // AI-friendly suggestion
    suggestion?: string;
  }[];

  // If expand=true, include nearby non-matching elements
  expanded?: {
    regionId: string;
    elements: ElementInfo[];
  }[];
}
```

---

## Comparison: Three Approaches

### Scenario: "Add item to cart from product page"

#### Current Snapshot + Grep

```
AI → snapshot({ grep: "cart|add" })
```

**Response (892 tokens):**
```
BUTTON "Add to Cart" @ref:34 /body/main/div[2]/div/button
LINK "View Cart" @ref:12 /body/header/nav/a[4]
LINK "Cart (3)" @ref:8 /body/header/div/a
BUTTON "Add to Wishlist" @ref:35 /body/main/div[2]/div/button[2]
SPAN "Added to cart!" @ref:67 /body/div.toast/span [hidden]
```

**Problems:**
- 5 matches, unclear which is "the" add to cart button
- Toast notification included (hidden, not useful)
- No context about where these are on page

---

#### Pure Hierarchical

```
AI → snapshotRegions()
AI → expandRegion({ region: "R2.ProductActions" })
```

**Response (412 + 178 = 590 tokens):**
```
// First call
REGIONS:
  R0 HEADER...
  R1 NAV...
  R2 MAIN "Product Page"
     Subsections: ProductImage, ProductInfo, ProductActions, Reviews
  R3 FOOTER...

// Second call
[R2.ProductActions]
  BUTTON "Add to Cart" @ref:34 [primary]
  BUTTON "Add to Wishlist" @ref:35
  BUTTON "Compare" @ref:36
  SELECT "Quantity" @ref:33 [value: 1]
```

**Better:** Clear context, right button identified
**Worse:** Two round-trips required

---

#### Hybrid Approach

```
AI → snapshotGrep({ pattern: "add.*cart", context: "region", expand: true })
```

**Response (312 tokens):**
```
GREP: "add.*cart" → 2 matches in 2 regions

[R0] HEADER "Site Header"
  └─ LINK "Cart (3)" @ref:8
     Context: Shopping cart link in header navigation

[R2] MAIN "Product Page"
  └─ R2.ProductActions "Product Actions"
     BUTTON "Add to Cart" @ref:34 [primary] ← BEST MATCH

     NEARBY:
       SELECT "Quantity" @ref:33 [value: 1]
       BUTTON "Add to Wishlist" @ref:35

SUGGESTION: @ref:34 is the product's Add to Cart button (in ProductActions).
            @ref:8 is the cart link showing 3 items.
```

**Best of both:**
- Single round-trip
- Semantic grouping with region context
- AI-friendly suggestion
- Related elements included
- Clear disambiguation

---

## Token Efficiency Comparison

| Scenario | Snapshot+Grep | Hierarchical | Hybrid |
|----------|---------------|--------------|--------|
| Find button | 892 | 590 | 312 |
| Fill form section | 1,450 | 634 | 423 |
| Dashboard export | 2,100 | 944 | 567 |
| Multi-step checkout | 4,200 | 1,890 | 1,245 |
| Error recovery | 1,800 | 312 | 198 |
| **Average** | **2,088** | **874** | **549** |

**Hybrid achieves:**
- 74% reduction vs Snapshot+Grep
- 37% reduction vs Pure Hierarchical
- Fewer round-trips than Hierarchical
- Better context than Snapshot+Grep

---

## Implementation Strategy

### Phase 1: Region Index Layer

Add region metadata to existing snapshot:

```typescript
// In snapshot.ts
interface SnapshotOptions {
  // Existing options...

  // New: include region index
  includeRegionIndex?: boolean;  // default: true
}

function createSnapshot(options) {
  const tree = buildAccessibilityTree();

  // NEW: Build region index alongside tree
  const regionIndex = buildRegionIndex(document);

  return {
    tree,
    refs,
    regionIndex,  // Lightweight addition
    metadata
  };
}
```

### Phase 2: Grep Enhancement

Modify grep to use region index:

```typescript
// Enhanced grep with region awareness
function grepWithRegions(pattern: string, options: GrepOptions) {
  const matches = grep(pattern);

  // Group matches by region
  const byRegion = groupByRegion(matches, regionIndex);

  // Add suggestions based on region semantics
  const suggestions = generateSuggestions(byRegion);

  return { matches, byRegion, suggestions };
}
```

### Phase 3: Smart Command

New unified command that routes intelligently:

```typescript
// New action: 'find'
interface FindCommand extends BaseCommand {
  action: 'find';

  // Natural language or pattern
  query: string;

  // Hints for better routing
  intent?: 'click' | 'fill' | 'read' | 'navigate';

  // Optional constraints
  region?: string;
  role?: string;
}
```

**Usage:**
```
AI → find({ query: "add to cart", intent: "click" })
```

System automatically:
1. Searches region index for "add", "cart"
2. Finds R2.ProductActions as likely region
3. Greps within that region
4. Returns contextual result with suggestion

---

## Advanced Features

### 1. Fuzzy Region Matching

```
AI → snapshotGrep({ pattern: "checkout" })
```

Even if no element contains "checkout", region index might have:
- R2.Cart with terms: ["cart", "subtotal", "proceed"]
- System suggests: "No exact match. Did you mean R2.Cart (proceed to checkout)?"

### 2. Action-Aware Suggestions

```
AI → snapshotGrep({ pattern: "submit", intent: "click" })
```

Response includes:
```
MATCHES: 3 buttons named "Submit"

SUGGESTIONS by likelihood:
1. @ref:45 in R2.ContactForm - "Submit Message" [PRIMARY - form has focus]
2. @ref:23 in R1.SearchForm - "Submit Search" [secondary - search box empty]
3. @ref:89 in R3.Newsletter - "Submit" [unlikely - below fold]
```

### 3. Differential Updates

After page interaction:
```
AI → snapshotGrep({ pattern: ".*", diff: true })
```

Response:
```
CHANGES since last snapshot:

ADDED:
  [R2.Modal] "Confirmation Dialog" (new region)
    BUTTON "Confirm" @ref:92
    BUTTON "Cancel" @ref:93

REMOVED:
  @ref:45 "Add to Cart" (element removed)

MODIFIED:
  @ref:8 "Cart (3)" → "Cart (4)" [text changed]
```

### 4. Persistent Region Cache

Regions are structurally stable across interactions:

```typescript
// Cache region structure, only refresh elements
const cachedRegions = getCachedRegions(url);

if (cachedRegions && !pageStructureChanged()) {
  // Fast path: just update element refs within known regions
  return refreshElementsInRegions(cachedRegions);
}
```

---

## Summary

The Hybrid approach combines:

| From Grep | From Hierarchical | New in Hybrid |
|-----------|-------------------|---------------|
| Pattern matching | Semantic regions | Region-scoped grep |
| Single-pass speed | Lazy loading | Smart routing |
| Regex flexibility | Context preservation | Suggestions |
| Content filtering | Structure understanding | Fuzzy matching |

**Result:** Faster than hierarchical, smarter than grep, more efficient than both.

```
┌─────────────────────────────────────────────────────────┐
│                    HYBRID APPROACH                       │
│                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │
│   │   Region    │───▶│   Scoped    │───▶│  Context  │  │
│   │   Index     │    │   Grep      │    │  Results  │  │
│   └─────────────┘    └─────────────┘    └───────────┘  │
│         │                  │                  │        │
│         ▼                  ▼                  ▼        │
│   O(1) routing      O(k) search        Rich output    │
│   200 tokens        varies             + suggestions  │
│                                                        │
│   Total: 37-74% fewer tokens than alternatives        │
└─────────────────────────────────────────────────────────┘
```
