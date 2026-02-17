# AI Chat Enhancement Plan

## Problem Analysis

### Current Issues

1. **No Conversation Context Memory**
   - Each query is processed independently
   - Follow-up questions like "What is her availability?" fail because the system doesn't remember "Isabella" from the previous message
   - The `processAIQuery()` function only receives the current query, not conversation history

2. **Keyword-Based Intent Detection**
   - Uses simple `queryLower.includes()` checks
   - Cannot understand natural language variations
   - Cannot handle pronouns (her, his, their, it)

3. **No Chat Session Management**
   - Messages stored as flat array in localStorage
   - No ability to create new chats, rename, or delete
   - No chat metadata (title, created date, last modified)

4. **Limited Query Capabilities**
   - Cannot combine intents (e.g., "Show me Isabella's availability")
   - Cannot perform actions (e.g., "Approve Isabella's time-off")
   - Cannot compare entities (e.g., "Compare Isabella and John's schedules")

## Proposed Architecture

### 1. Conversation Context System

```typescript
interface ConversationContext {
  // Tracked entities from conversation
  mentionedStaff: Array<{
    id: string;
    name: string;
    mentionedAt: Date;
  }>;
  mentionedDates: Array<{
    date: Date;
    reference: string; // "tomorrow", "next week", etc.
  }>;
  mentionedVenues: Array<{
    id: string;
    name: string;
  }>;
  lastQueryIntent: string;
  lastQueryResult: any;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: ConversationContext; // Context after this message
}
```

### 2. Chat Session Management

```typescript
interface ChatSession {
  id: string;
  title: string; // Auto-generated or user-defined
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  context: ConversationContext; // Current conversation context
}

// localStorage structure
interface ChatStorage {
  sessions: ChatSession[];
  activeSessionId: string | null;
}
```

### 3. OpenAI-Powered Intent Detection

Replace keyword matching with GPT-4 function calling:

```typescript
const INTENT_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: [
        "staff_lookup",
        "availability_query",
        "coverage_analysis",
        "timeoff_query",
        "conflict_detection",
        "staff_comparison",
        "action_request",
        "follow_up",
        "general_help"
      ]
    },
    entities: {
      type: "object",
      properties: {
        staffNames: { type: "array", items: { type: "string" } },
        dateReferences: { type: "array", items: { type: "string" } },
        venueNames: { type: "array", items: { type: "string" } },
        pronouns: { type: "array", items: { type: "string" } }
      }
    },
    action: {
      type: "string",
      enum: ["view", "approve", "reject", "assign", "compare", null]
    },
    confidence: { type: "number" }
  }
};
```

### 4. Context-Aware Query Processing

```typescript
async function processQueryWithContext(
  query: string,
  conversationHistory: ChatMessage[],
  currentContext: ConversationContext
): Promise<AIResponse> {
  // Step 1: Resolve pronouns using context
  const resolvedQuery = resolvePronouns(query, currentContext);
  
  // Step 2: Detect intent with OpenAI
  const intent = await detectIntentWithAI(resolvedQuery, conversationHistory);
  
  // Step 3: Execute appropriate handler
  const result = await executeIntent(intent, currentContext);
  
  // Step 4: Update context
  const newContext = updateContext(currentContext, intent, result);
  
  return { answer: result.answer, context: newContext };
}
```

## Implementation Plan

### Phase 1: Conversation Context (Priority: HIGH)

**Files to modify:**
- `src/lib/services/ai-service.ts` - Add context tracking
- `src/app/manage/reports/ai-chat/ai-chat-client.tsx` - Pass history to API
- `src/app/system/reports/ai-chat/ai-chat-client.tsx` - Pass history to API

**Changes:**
1. Add `conversationHistory` parameter to `processAIQuery()`
2. Create `ConversationContext` tracking system
3. Implement pronoun resolution (her/his/their/it → last mentioned entity)
4. Track mentioned staff, dates, venues across conversation

### Phase 2: Chat Session Management (Priority: MEDIUM)

**Files to modify:**
- `src/app/manage/reports/ai-chat/ai-chat-client.tsx`
- `src/app/system/reports/ai-chat/ai-chat-client.tsx`

**New components:**
- `ChatSessionList.tsx` - Sidebar with chat sessions
- `ChatSessionItem.tsx` - Individual chat with rename/delete

**Changes:**
1. Create `ChatSession` interface
2. Update localStorage structure
3. Add UI for creating new chats
4. Add UI for renaming/deleting chats
5. Auto-generate chat titles from first message

### Phase 3: OpenAI Intent Detection (Priority: HIGH)

**Files to modify:**
- `src/lib/services/ai-service.ts`
- `src/lib/ai/query-parser.ts`

**Changes:**
1. Replace keyword matching with GPT-4 function calling
2. Add structured intent schema
3. Implement confidence scoring
4. Handle ambiguous queries with clarification questions

### Phase 4: Enhanced Query Capabilities (Priority: MEDIUM)

**New query types to support:**
1. **Combined queries**: "Show me Isabella's availability next week"
2. **Action queries**: "Approve Isabella's time-off request"
3. **Comparison queries**: "Compare Isabella and John's schedules"
4. **Follow-up queries**: "What about her time-off requests?"

## Technical Details

### Pronoun Resolution Logic

```typescript
function resolvePronouns(query: string, context: ConversationContext): string {
  let resolved = query;
  
  // Resolve "her/his/their" to last mentioned staff
  const pronouns = ["her", "his", "their", "she", "he", "they"];
  for (const pronoun of pronouns) {
    if (query.toLowerCase().includes(pronoun)) {
      const lastStaff = context.mentionedStaff[context.mentionedStaff.length - 1];
      if (lastStaff) {
        resolved = resolved.replace(new RegExp(pronoun, "gi"), lastStaff.name);
      }
    }
  }
  
  // Resolve "it" to last mentioned entity or concept
  // Resolve "that day" to last mentioned date
  
  return resolved;
}
```

### Context Update Logic

```typescript
function updateContext(
  context: ConversationContext,
  intent: DetectedIntent,
  result: QueryResult
): ConversationContext {
  const newContext = { ...context };
  
  // Add newly mentioned staff
  if (intent.entities.staffNames) {
    for (const name of intent.entities.staffNames) {
      const staff = result.staffFound?.find(s => 
        `${s.firstName} ${s.lastName}`.includes(name)
      );
      if (staff) {
        newContext.mentionedStaff.push({
          id: staff.id,
          name: `${staff.firstName} ${staff.lastName}`,
          mentionedAt: new Date()
        });
      }
    }
  }
  
  // Keep only last 5 mentioned entities
  newContext.mentionedStaff = newContext.mentionedStaff.slice(-5);
  
  return newContext;
}
```

## UI Changes

### Chat Session Sidebar

```
┌─────────────────────────────────────────────────────────────┐
│ AI Chat Assistant                              [+ New Chat] │
├───────────────┬─────────────────────────────────────────────┤
│ Recent Chats  │                                             │
│               │  [Welcome message and chat area]            │
│ 📝 Isabella's │                                             │
│    availability│                                             │
│               │                                             │
│ 📝 Coverage   │                                             │
│    analysis   │                                             │
│               │                                             │
│ 📝 Time-off   │  [Input area]                               │
│    requests   │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

### Chat Session Actions

- Click to switch sessions
- Hover to show rename/delete buttons
- Auto-title from first query or user-defined

## Estimated Effort

| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | Conversation Context | Medium |
| 2 | Chat Session Management | Medium |
| 3 | OpenAI Intent Detection | High |
| 4 | Enhanced Query Capabilities | High |

## Next Steps

1. Implement Phase 1 (Conversation Context) to fix the immediate issue
2. Add Phase 3 (OpenAI Intent Detection) for better query understanding
3. Add Phase 2 (Chat Session Management) for better UX
4. Add Phase 4 (Enhanced Queries) for more capabilities
