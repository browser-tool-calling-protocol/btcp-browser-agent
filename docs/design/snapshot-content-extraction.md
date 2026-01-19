# Snapshot Content Extraction API Design

## Overview

This document describes the design for AI-driven content extraction from web pages. The system extends the existing `snapshot` API with new modes for content understanding and extraction.

The design follows **reactive summarization** - letting AI agents decide what to extract based on page structure, rather than using a fixed extraction strategy.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       AI Agent                                   │
│  "I need to understand this page and extract relevant info"     │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│  snapshot                │     │  snapshot                │
│  mode: 'outline'         │────▶│  mode: 'content'         │
│                          │     │  grep: 'pattern'         │
│  Returns:                │     │                          │
│  - Page structure        │     │  Returns:                │
│  - Semantic xpaths       │     │  - Markdown content      │
│  - Section metadata      │     │  - From matched xpaths   │
└──────────────────────────┘     └──────────────────────────┘
              │                               │
              ▼                               ▼
        AI analyzes                    Markdown string
        decides what                   ready for parsing
        to extract                     and chunking
```

## Snapshot API Extension

### Mode Overview

| Mode | Purpose | Output |
|------|---------|--------|
| `interactive` | Find clickable elements (default) | Tree with `@ref:N` markers |
| `outline` | Understand page structure | Tree with xpaths + metadata |
| `content` | Extract text content | Text/Markdown from matched sections |

### Format Options

| Format | Description |
|--------|-------------|
| `tree` | Flat accessibility tree (default) |
| `html` | Raw HTML |
| `markdown` | Markdown formatted content |

### Interface

```typescript
interface SnapshotOptions {
  // Existing options
  selector?: string;
  maxDepth?: number;
  includeHidden?: boolean;
  grep?: string | GrepOptions;    // Reused for xpath pattern matching

  // Mode selection
  mode?: 'interactive' | 'outline' | 'content';

  // Output format
  format?: 'tree' | 'html' | 'markdown';

  // Content mode options
  maxLength?: number;        // Max chars per section
  includeLinks?: boolean;    // Include [text](url) in markdown
  includeImages?: boolean;   // Include ![alt](src) in markdown
}

// Return type is always string
function snapshot(options?: SnapshotOptions): Promise<string>;
```

---

## Mode: `outline`

### Purpose

Provide AI agents with a structural overview of page content including:
- Landmark regions (header, main, footer, nav)
- Content sections with semantic identifiers
- Headings hierarchy
- Word counts and content indicators
- Semantic xpaths for targeting extraction

### Usage

```typescript
const outline = await client.snapshot({ mode: 'outline' });
```

### Output Format

```
PAGE: https://example.com/article | Article Title | viewport=1920x1080
OUTLINE: landmarks=4 sections=6 headings=8 words=2450

BANNER [45 words, 8 links] /header
  NAVIGATION "Main menu" /header/nav
MAIN [2200 words] /main
  HEADING level=1 "Understanding AI Agents" /main/article/h1
  REGION "intro" [320 words] /main/article/section.intro
    PARAGRAPH [2 paragraphs] /main/article/section.intro/p
  REGION "content" [1400 words] /main/article/section.content
    HEADING level=2 "What are AI Agents?" /main/article/section.content/h2
    PARAGRAPH [4 paragraphs] /main/article/section.content/p
    LIST [5 items] /main/article/section.content/ul
    HEADING level=2 "How They Work" /main/article/section.content/h2[2]
    PARAGRAPH [3 paragraphs] /main/article/section.content/p
    CODE [45 lines] /main/article/section.content/pre
  REGION "reviews" [480 words] /main/article/section.reviews
    HEADING level=2 "Reader Comments" /main/article/section.reviews/h2
    ARTICLE "Comment 1..." [preview] /main/article/section.reviews/article[1]
    ARTICLE "Comment 2..." [preview] /main/article/section.reviews/article[2]
    TEXT "+15 more comments"
ASIDE [200 words] /aside
  HEADING level=3 "Related Articles" /aside/h3
  LIST [4 items] /aside/ul
CONTENTINFO [85 words] /footer
```

### Output Components

#### Header
```
PAGE: {url} | {title} | viewport={width}x{height}
OUTLINE: landmarks={n} sections={n} headings={n} words={n}
```

#### Element Lines
```
{ROLE} ["name"] [{metadata}] {xpath}
```

| Component | Description |
|-----------|-------------|
| `ROLE` | Landmark or content role (MAIN, HEADING, PARAGRAPH, etc.) |
| `"name"` | Optional label or preview text |
| `[metadata]` | Word count, item count, paragraph count |
| `xpath` | Semantic xpath for content mode targeting |

#### Metadata Indicators

| Indicator | Meaning |
|-----------|---------|
| `[N words]` | Approximate word count |
| `[N items]` | Number of list items |
| `[N paragraphs]` | Number of paragraphs |
| `[N links]` | Number of links |
| `[N lines]` | Lines of code |
| `[preview]` | Content truncated, more available |

### Semantic XPath Format

```
/main/article/section.content/h2[2]
│     │       │              │
│     │       │              └─ Index if multiple siblings
│     │       └─ Semantic class or id
│     └─ Semantic tag
└─ Landmark
```

**Included:**
- Semantic HTML5: `main`, `article`, `section`, `nav`, `header`, `footer`, `aside`
- Content tags: `h1`-`h6`, `p`, `ul`, `ol`, `li`, `pre`, `code`, `blockquote`
- IDs: `#identifier`
- Semantic classes: `.content`, `.intro`, `.reviews`
- Sibling index: `[n]` when needed

**Excluded:**
- Generic `div`/`span` without meaning
- Utility CSS classes
- Auto-generated identifiers

---

## Mode: `content`

### Purpose

Extract actual text content from the page. Uses the existing `grep` option to filter which sections to extract based on xpath patterns from the outline.

### Usage

```typescript
// Extract all content
const content = await client.snapshot({
  mode: 'content'
});

// Extract by xpath patterns (using existing grep option)
const filtered = await client.snapshot({
  mode: 'content',
  grep: 'article|section.content'
});

// Extract with markdown format
const markdown = await client.snapshot({
  mode: 'content',
  grep: 'section.intro|section.content',
  format: 'markdown'
});

// Extract from specific selector
const section = await client.snapshot({
  mode: 'content',
  selector: '@ref:5',
  format: 'markdown'
});
```

### Grep Pattern Matching

The existing `grep` option filters output lines. Since outline/content mode output includes xpaths, grep naturally filters by xpath patterns.

#### Syntax

```
pattern1|pattern2|pattern3
```

#### Examples

| Pattern | Matches |
|---------|---------|
| `article` | Any xpath containing "article" |
| `section.content` | Sections with class "content" |
| `/main/` | Direct children of main |
| `h[1-3]` | Headings h1, h2, h3 (regex) |
| `reviews\|comments` | Review or comment sections |

#### GrepOptions

The full `GrepOptions` interface is supported:

```typescript
interface GrepOptions {
  pattern: string;      // Pattern to search for
  ignoreCase?: boolean; // Case-insensitive (grep -i)
  invert?: boolean;     // Invert match (grep -v)
  fixedStrings?: boolean; // Literal string, not regex (grep -F)
}

// Example: case-insensitive matching
snapshot({
  mode: 'content',
  grep: { pattern: 'ARTICLE|SECTION', ignoreCase: true },
  format: 'markdown'
});

// Example: exclude navigation
snapshot({
  mode: 'content',
  grep: { pattern: 'nav|footer', invert: true },
  format: 'markdown'
});
```

### Output: Tree Format (default)

```
PAGE: https://example.com/article | Article Title
CONTENT: sections=3 words=1720 grep=section.intro|section.content

SECTION /main/article/section.intro [320 words]
  HEADING level=2 "Introduction"
  TEXT "AI agents are autonomous software entities that can perceive
  their environment, make decisions, and take actions to achieve
  specific goals. Unlike traditional programs that follow predetermined
  scripts, AI agents adapt their behavior based on situations."

SECTION /main/article/section.content [1400 words]
  HEADING level=2 "What are AI Agents?"
  TEXT "An AI agent consists of several key components..."
  LIST [5 items]
    - "Perception: Ability to observe and interpret the environment"
    - "Reasoning: Processing observations to make decisions"
    - "Action: Executing decisions to affect the environment"
    - "Learning: Improving performance over time"
    - "Memory: Storing and recalling past experiences"
  HEADING level=2 "How They Work"
  TEXT "AI agents operate in a continuous loop..."
  CODE [python, 12 lines]
    class Agent:
        def run(self):
            while not self.done:
                state = self.observe()
                action = self.decide(state)
                self.execute(action)
```

### Output: Markdown Format

```typescript
snapshot({ mode: 'content', grep: 'section.intro|section.content', format: 'markdown' })
```

```markdown
<!-- source: https://example.com/article -->
<!-- xpath: /main/article/section.intro -->

## Introduction

AI agents are autonomous software entities that can perceive their environment,
make decisions, and take actions to achieve specific goals. Unlike traditional
programs that follow predetermined scripts, AI agents adapt their behavior
based on the situations they encounter.

<!-- xpath: /main/article/section.content -->

## What are AI Agents?

An AI agent consists of several key components:

- **Perception**: Ability to observe and interpret the environment
- **Reasoning**: Processing observations to make decisions
- **Action**: Executing decisions to affect the environment
- **Learning**: Improving performance over time
- **Memory**: Storing and recalling past experiences

The fundamental difference between an AI agent and a simple program is
autonomy. While a script executes a fixed sequence of operations, an agent
chooses its actions based on its current understanding of the world.

## How They Work

AI agents operate in a continuous loop:

1. Observe the current state
2. Evaluate possible actions
3. Select the best action
4. Execute the action
5. Learn from the outcome

```python
class Agent:
    def run(self):
        while not self.done:
            state = self.observe()
            action = self.decide(state)
            self.execute(action)
```

<!-- end: 1720 words extracted -->
```

### Markdown Features

- HTML comments for metadata (xpath source, word count)
- Preserved heading hierarchy
- Lists (ordered and unordered)
- Code blocks with language hints
- Links as `[text](url)` when `includeLinks: true`
- Images as `![alt](src)` when `includeImages: true`

---

## AI Agent Workflow

### System Prompt Template

```
You are a content extraction agent. Your task is to extract relevant
information from web pages for downstream processing.

Use the snapshot action with different modes:

1. snapshot({ mode: 'outline' })
   - Get page structure with semantic xpaths
   - Analyze to identify relevant content sections

2. snapshot({ mode: 'content', grep: 'patterns', format: 'markdown' })
   - Extract content from sections matching xpath patterns
   - Use patterns from outline analysis

Pattern tips:
- Use 'article|main' for main content
- Use 'section.reviews|comments' for user content
- Use 'h[1-2]' for top-level headings only
- Combine patterns with | for multiple targets

Return extracted markdown for further processing.
```

### Example Session

```
Agent: I'll analyze the page structure first.

> snapshot({ mode: 'outline' })

PAGE: https://docs.example.com/api | API Reference | viewport=1920x1080
OUTLINE: landmarks=3 sections=12 headings=24 words=4500

MAIN [4200 words] /main
  HEADING level=1 "API Reference" /main/h1
  REGION "overview" [300 words] /main/section#overview
    HEADING level=2 "Overview" /main/section#overview/h2
    PARAGRAPH [2 paragraphs] /main/section#overview/p
  REGION "authentication" [450 words] /main/section#auth
    HEADING level=2 "Authentication" /main/section#auth/h2
    CODE [25 lines] /main/section#auth/pre
  REGION "endpoints" [2800 words] /main/section#endpoints
    HEADING level=2 "Endpoints" /main/section#endpoints/h2
    ...

Agent: This is API documentation. I'll extract auth section and overview.

> snapshot({
    mode: 'content',
    grep: 'section#overview|section#auth',
    format: 'markdown'
  })

<!-- source: https://docs.example.com/api -->
<!-- xpath: /main/section#overview -->

## Overview

The Example API provides programmatic access to all platform features.
This RESTful API uses JSON for request and response bodies.

Base URL: `https://api.example.com/v1`

<!-- xpath: /main/section#auth -->

## Authentication

All API requests require authentication using an API key.

Include your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.example.com/v1/users
```

<!-- end: 750 words extracted -->

Agent: Here is the extracted API documentation.
```

---

## Downstream Processing

### Markdown Parser & Chunker (Future)

The markdown output is designed for downstream parsing and chunking:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  snapshot       │     │  Markdown       │     │  Chunks         │
│  mode: content  │────▶│  Parser         │────▶│  for LLM        │
│  format: md     │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   Raw markdown          Structured AST          Sized pieces
   string                with metadata           for context
```

**Parser responsibilities:**
- Extract xpath comments as section metadata
- Build heading hierarchy
- Identify code blocks, lists, paragraphs
- Track word/token counts

**Chunker responsibilities:**
- Split by semantic boundaries (headings)
- Respect max token limits
- Preserve context (heading breadcrumbs)
- Handle code blocks atomically

---

## Implementation Plan

### Files to Modify

```
packages/core/src/
├── types.ts          # Add mode, format options
├── snapshot.ts       # Add outline and content modes
└── actions.ts        # Update snapshot dispatch
```

### Type Additions

```typescript
// types.ts

type SnapshotMode = 'interactive' | 'outline' | 'content';
type SnapshotFormat = 'tree' | 'html' | 'markdown';

interface SnapshotOptions {
  // Existing
  root?: Element;
  maxDepth?: number;
  includeHidden?: boolean;
  interactive?: boolean;  // deprecated, use mode
  all?: boolean;          // deprecated, use mode
  format?: SnapshotFormat;
  grep?: string | GrepOptions;

  // New
  mode?: SnapshotMode;
  maxLength?: number;
  includeLinks?: boolean;
  includeImages?: boolean;
}
```

### Snapshot.ts Additions

```typescript
// snapshot.ts

// Content roles for outline/content modes
const CONTENT_ROLES = [
  'banner', 'main', 'contentinfo', 'navigation', 'complementary',
  'article', 'region', 'heading', 'paragraph', 'list', 'listitem',
  'figure', 'blockquote', 'code', 'img'
];

// Word count helper
function getWordCount(element: Element): number;

// Content text extraction
function getTextContent(element: Element, maxLength?: number): string;

// Outline mode implementation
function createOutlineSnapshot(document: Document, options: SnapshotOptions): string;

// Content mode implementation
function createContentSnapshot(document: Document, options: SnapshotOptions): string;

// Markdown formatter
function formatAsMarkdown(sections: ContentSection[]): string;
```

---

## Design Decisions

### Why extend snapshot (not new action)?

1. **Unified API**: One action for all page understanding
2. **Shared infrastructure**: DOM traversal, xpath generation, refs
3. **Simpler mental model**: "snapshot shows me the page"
4. **Consistent return type**: Always returns string

### Why reuse `grep` (not new parameter)?

1. **Already exists**: No new parameter needed
2. **Familiar**: Unix-like semantics users know
3. **Works naturally**: Output lines contain xpaths, grep filters them
4. **Full featured**: Supports ignoreCase, invert, fixedStrings

### Why string return type?

1. **Simplicity**: No complex type unions
2. **Streaming-ready**: String can be streamed
3. **Downstream processing**: Parser handles structure
4. **AI-friendly**: LLMs work with text

### Why markdown format?

1. **Universal**: Every LLM understands markdown
2. **Structured**: Headings, lists, code preserved
3. **Compact**: Less tokens than JSON
4. **Parseable**: Easy to chunk and process
5. **Human-readable**: Debuggable output
