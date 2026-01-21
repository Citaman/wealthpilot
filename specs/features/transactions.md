# Transaction Management Specifications

**Version**: v0.2.0  
**Priority**: 🔴 CRITICAL  
**Status**: Specification Complete

---

## Overview

Full transaction editing capabilities, category management, and merchant mapping for complete control over financial data.

## Current Issues (v0.0.1)

1. ❌ Transactions are read-only
2. ❌ Cannot edit categories
3. ❌ Cannot rename merchants
4. ❌ No batch operations
5. ❌ No import rules

---

## Features

### 1. Inline Transaction Editing

Each transaction row should be editable:

```tsx
interface EditableFields {
  date: boolean;           // Yes - user may fix incorrect dates
  amount: boolean;         // No - amounts should not be changed (data integrity)
  category: boolean;       // Yes - primary use case
  subcategory: boolean;    // Yes
  merchant: boolean;       // Yes - clean up names
  description: boolean;    // No - keep original bank data
  notes: boolean;          // Yes - user annotations
  tags: boolean;           // Yes - custom tags
  isRecurring: boolean;    // Yes - mark as recurring
  isExcluded: boolean;     // Yes - exclude from budgets
}
```

**UI Design:**

```tsx
<TransactionRow transaction={tx}>
  {/* Click to expand inline edit */}
  <ExpandedEdit>
    <div className="grid grid-cols-2 gap-4">
      {/* Category Selector */}
      <div>
        <Label>Category</Label>
        <CategorySelect 
          value={tx.category}
          onChange={handleCategoryChange}
          showSuggestions={true}
        />
      </div>
      
      {/* Merchant Name */}
      <div>
        <Label>Merchant</Label>
        <Input 
          value={tx.merchant}
          onChange={handleMerchantChange}
        />
        <p className="text-xs text-muted-foreground">
          Original: {tx.merchantOriginal}
        </p>
      </div>
      
      {/* Tags */}
      <div>
        <Label>Tags</Label>
        <TagInput 
          value={tx.tags}
          onChange={handleTagsChange}
          suggestions={allTags}
        />
      </div>
      
      {/* Notes */}
      <div>
        <Label>Notes</Label>
        <Textarea 
          value={tx.notes}
          onChange={handleNotesChange}
          placeholder="Add a note..."
        />
      </div>
    </div>
    
    {/* Bulk apply option */}
    <div className="mt-4 p-3 bg-muted rounded-lg">
      <Checkbox 
        checked={applyToSimilar}
        onChange={setApplyToSimilar}
      />
      <span>Apply to {similarCount} similar transactions</span>
    </div>
    
    <div className="flex justify-end gap-2 mt-4">
      <Button variant="outline" onClick={handleCancel}>
        Cancel
      </Button>
      <Button onClick={handleSave}>
        Save Changes
      </Button>
    </div>
  </ExpandedEdit>
</TransactionRow>
```

---

### 2. Category Management

Full CRUD for categories and subcategories.

**Category Structure:**

```typescript
interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId?: string;           // null for top-level
  defaultType: 'need' | 'want' | 'saving';
  isSystem: boolean;           // Default categories
  isActive: boolean;
  subcategories?: Category[];  // Nested structure for UI
}

// Default categories (system)
const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'food',
    name: 'Food & Dining',
    icon: 'Utensils',
    color: '#f97316',
    defaultType: 'need',
    isSystem: true,
    subcategories: [
      { id: 'groceries', name: 'Groceries', parentId: 'food' },
      { id: 'restaurants', name: 'Restaurants', parentId: 'food' },
      { id: 'coffee', name: 'Coffee Shops', parentId: 'food' },
      { id: 'delivery', name: 'Food Delivery', parentId: 'food' },
    ]
  },
  // ... more categories
];
```

**Category Management UI:**

```tsx
<CategoryManagement>
  <div className="flex justify-between items-center mb-4">
    <h2>Categories</h2>
    <Button onClick={addCategory}>
      <Plus className="w-4 h-4 mr-2" />
      Add Category
    </Button>
  </div>
  
  <DragDropContext onDragEnd={handleReorder}>
    <Droppable droppableId="categories">
      {categories.map((cat, index) => (
        <Draggable key={cat.id} draggableId={cat.id} index={index}>
          <CategoryRow category={cat}>
            {/* Icon picker */}
            <IconPicker 
              value={cat.icon}
              onChange={(icon) => updateCategory(cat.id, { icon })}
            />
            
            {/* Name edit */}
            <Input
              value={cat.name}
              onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
            />
            
            {/* Color picker */}
            <ColorPicker
              value={cat.color}
              onChange={(color) => updateCategory(cat.id, { color })}
            />
            
            {/* Budget type */}
            <Select
              value={cat.defaultType}
              onChange={(type) => updateCategory(cat.id, { defaultType: type })}
            >
              <SelectItem value="need">Need (50%)</SelectItem>
              <SelectItem value="want">Want (30%)</SelectItem>
              <SelectItem value="saving">Saving (20%)</SelectItem>
            </Select>
            
            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuItem onClick={() => addSubcategory(cat.id)}>
                Add Subcategory
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => deleteCategory(cat.id)}
                disabled={cat.isSystem}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenu>
            
            {/* Subcategories */}
            {cat.subcategories?.map(sub => (
              <SubcategoryRow key={sub.id} subcategory={sub} />
            ))}
          </CategoryRow>
        </Draggable>
      ))}
    </Droppable>
  </DragDropContext>
</CategoryManagement>
```

---

### 3. Merchant Mapping

Save merchant name changes for future imports.

```typescript
interface MerchantMapping {
  id: string;
  originalPattern: string;     // Regex pattern to match
  displayName: string;         // User-friendly name
  category?: string;           // Auto-assign category
  subcategory?: string;
  isRecurring?: boolean;
  createdFrom?: string;        // Transaction ID that created this
  timesApplied: number;
}

// Example mappings
const merchantMappings: MerchantMapping[] = [
  {
    id: '1',
    originalPattern: 'CARREFOUR|CARREF',
    displayName: 'Carrefour',
    category: 'Food & Dining',
    subcategory: 'Groceries',
    timesApplied: 45
  },
  {
    id: '2',
    originalPattern: 'NETFLIX',
    displayName: 'Netflix',
    category: 'Entertainment',
    subcategory: 'Streaming',
    isRecurring: true,
    timesApplied: 12
  }
];
```

**Auto-Apply Logic:**

```typescript
async function applyMerchantMappings(
  transaction: Transaction
): Promise<Transaction> {
  const mappings = await db.merchantMappings.toArray();
  
  for (const mapping of mappings) {
    const regex = new RegExp(mapping.originalPattern, 'i');
    
    if (regex.test(transaction.description) || 
        regex.test(transaction.merchantOriginal)) {
      
      // Update merchant name
      transaction.merchant = mapping.displayName;
      
      // Apply category if user hasn't manually set it
      if (!transaction.isEdited) {
        if (mapping.category) transaction.category = mapping.category;
        if (mapping.subcategory) transaction.subcategory = mapping.subcategory;
        if (mapping.isRecurring !== undefined) {
          transaction.isRecurring = mapping.isRecurring;
        }
      }
      
      // Update usage count
      await db.merchantMappings.update(mapping.id, {
        timesApplied: mapping.timesApplied + 1
      });
      
      break; // First match wins
    }
  }
  
  return transaction;
}
```

**Merchant Management UI:**

```tsx
<MerchantManagement>
  <div className="flex justify-between items-center mb-4">
    <h2>Merchant Mappings</h2>
    <Button onClick={addMapping}>
      <Plus className="w-4 h-4 mr-2" />
      Add Mapping
    </Button>
  </div>
  
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Pattern</TableHead>
        <TableHead>Display Name</TableHead>
        <TableHead>Category</TableHead>
        <TableHead>Used</TableHead>
        <TableHead>Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {mappings.map(mapping => (
        <TableRow key={mapping.id}>
          <TableCell>
            <code className="text-xs">{mapping.originalPattern}</code>
          </TableCell>
          <TableCell>{mapping.displayName}</TableCell>
          <TableCell>
            {mapping.category}
            {mapping.subcategory && ` / ${mapping.subcategory}`}
          </TableCell>
          <TableCell>{mapping.timesApplied}x</TableCell>
          <TableCell>
            <Button variant="ghost" size="sm" onClick={() => editMapping(mapping)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => deleteMapping(mapping.id)}>
              Delete
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</MerchantManagement>
```

---

### 4. Batch Operations

Apply changes to multiple transactions.

```tsx
<TransactionList>
  {/* Selection mode */}
  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg mb-4">
    <Checkbox 
      checked={allSelected}
      onChange={toggleSelectAll}
    />
    <span>{selectedCount} selected</span>
    
    {selectedCount > 0 && (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={openBulkCategory}>
          Change Category
        </Button>
        <Button variant="outline" size="sm" onClick={openBulkTag}>
          Add Tag
        </Button>
        <Button variant="outline" size="sm" onClick={toggleBulkExclude}>
          Toggle Exclude
        </Button>
      </div>
    )}
  </div>
  
  {transactions.map(tx => (
    <TransactionRow 
      key={tx.id}
      transaction={tx}
      isSelected={selectedIds.includes(tx.id)}
      onSelect={() => toggleSelect(tx.id)}
    />
  ))}
</TransactionList>
```

**Batch Category Dialog:**

```tsx
<Dialog open={showBulkCategory} onOpenChange={setShowBulkCategory}>
  <DialogHeader>
    <DialogTitle>Change Category for {selectedCount} Transactions</DialogTitle>
  </DialogHeader>
  <DialogContent>
    <CategorySelect 
      value={newCategory}
      onChange={setNewCategory}
    />
    
    <div className="mt-4">
      <Checkbox 
        checked={createMapping}
        onChange={setCreateMapping}
      />
      <span>Create merchant mapping rule</span>
      <p className="text-xs text-muted-foreground">
        Future transactions from these merchants will use this category
      </p>
    </div>
  </DialogContent>
  <DialogFooter>
    <Button variant="outline" onClick={() => setShowBulkCategory(false)}>
      Cancel
    </Button>
    <Button onClick={applyBulkCategory}>
      Apply to {selectedCount} Transactions
    </Button>
  </DialogFooter>
</Dialog>
```

---

### 5. Import Rules

Define rules for automatic categorization on import.

```typescript
interface ImportRule {
  id: string;
  name: string;
  priority: number;           // Higher = processed first
  isActive: boolean;
  
  // Conditions (all must match)
  conditions: RuleCondition[];
  
  // Actions
  actions: RuleAction[];
  
  // Stats
  timesApplied: number;
  lastApplied?: string;
}

interface RuleCondition {
  field: 'description' | 'merchant' | 'amount' | 'category';
  operator: 'contains' | 'equals' | 'matches' | 'greater_than' | 'less_than';
  value: string | number;
  caseSensitive?: boolean;
}

interface RuleAction {
  type: 'set_category' | 'set_subcategory' | 'set_merchant' | 
        'add_tag' | 'set_recurring' | 'exclude_from_budget';
  value: string | boolean;
}
```

**Rule Builder UI:**

```tsx
<ImportRuleBuilder rule={rule} onChange={updateRule}>
  {/* Conditions */}
  <div className="space-y-2">
    <Label>When transaction...</Label>
    {rule.conditions.map((cond, i) => (
      <div key={i} className="flex gap-2 items-center">
        <Select value={cond.field} onChange={(f) => updateCondition(i, { field: f })}>
          <SelectItem value="description">Description</SelectItem>
          <SelectItem value="merchant">Merchant</SelectItem>
          <SelectItem value="amount">Amount</SelectItem>
        </Select>
        
        <Select value={cond.operator} onChange={(o) => updateCondition(i, { operator: o })}>
          <SelectItem value="contains">contains</SelectItem>
          <SelectItem value="equals">equals</SelectItem>
          <SelectItem value="matches">matches regex</SelectItem>
        </Select>
        
        <Input 
          value={cond.value}
          onChange={(e) => updateCondition(i, { value: e.target.value })}
        />
        
        <Button variant="ghost" size="sm" onClick={() => removeCondition(i)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    ))}
    <Button variant="outline" size="sm" onClick={addCondition}>
      <Plus className="w-4 h-4 mr-2" />
      Add Condition
    </Button>
  </div>
  
  {/* Actions */}
  <div className="space-y-2 mt-4">
    <Label>Then...</Label>
    {rule.actions.map((action, i) => (
      <div key={i} className="flex gap-2 items-center">
        <Select value={action.type} onChange={(t) => updateAction(i, { type: t })}>
          <SelectItem value="set_category">Set Category</SelectItem>
          <SelectItem value="set_merchant">Set Merchant Name</SelectItem>
          <SelectItem value="add_tag">Add Tag</SelectItem>
          <SelectItem value="set_recurring">Mark as Recurring</SelectItem>
        </Select>
        
        <ActionValueInput 
          type={action.type}
          value={action.value}
          onChange={(v) => updateAction(i, { value: v })}
        />
      </div>
    ))}
  </div>
</ImportRuleBuilder>
```

---

### 6. Similar Transaction Detection

When editing, suggest similar transactions.

```typescript
function findSimilarTransactions(
  transaction: Transaction,
  allTransactions: Transaction[]
): Transaction[] {
  return allTransactions.filter(tx => {
    // Same merchant (fuzzy match)
    const merchantMatch = 
      tx.merchant === transaction.merchant ||
      levenshteinDistance(tx.merchant, transaction.merchant) < 3;
    
    // Similar amount (within 20%)
    const amountMatch = 
      Math.abs(tx.amount - transaction.amount) / Math.abs(transaction.amount) < 0.2;
    
    // Same description pattern
    const descMatch = 
      extractDescriptionPattern(tx.description) === 
      extractDescriptionPattern(transaction.description);
    
    return merchantMatch || (amountMatch && descMatch);
  });
}

function extractDescriptionPattern(description: string): string {
  // Remove dates, numbers, reference codes
  return description
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}
```

---

### 7. Transaction Detail View

Full transaction details in a dialog/drawer.

```tsx
<TransactionDetail transaction={tx}>
  <div className="grid grid-cols-2 gap-6">
    {/* Left: Editable fields */}
    <div className="space-y-4">
      <div>
        <Label>Category</Label>
        <CategorySelect value={tx.category} onChange={updateCategory} />
      </div>
      
      <div>
        <Label>Subcategory</Label>
        <SubcategorySelect 
          category={tx.category}
          value={tx.subcategory}
          onChange={updateSubcategory}
        />
      </div>
      
      <div>
        <Label>Merchant</Label>
        <Input value={tx.merchant} onChange={updateMerchant} />
      </div>
      
      <div>
        <Label>Tags</Label>
        <TagInput value={tx.tags} onChange={updateTags} />
      </div>
      
      <div>
        <Label>Notes</Label>
        <Textarea value={tx.notes} onChange={updateNotes} />
      </div>
      
      <div className="flex gap-4">
        <Checkbox checked={tx.isRecurring} onChange={toggleRecurring}>
          Recurring
        </Checkbox>
        <Checkbox checked={tx.isExcludedFromBudget} onChange={toggleExcluded}>
          Exclude from Budget
        </Checkbox>
      </div>
    </div>
    
    {/* Right: Read-only bank data */}
    <div className="space-y-4 bg-muted p-4 rounded-lg">
      <h4 className="font-semibold">Original Bank Data</h4>
      
      <div>
        <Label>Date</Label>
        <p>{format(new Date(tx.date), 'PPP')}</p>
      </div>
      
      <div>
        <Label>Amount</Label>
        <p className={tx.amount < 0 ? 'text-red-500' : 'text-green-500'}>
          {formatCurrency(tx.amount)}
        </p>
      </div>
      
      <div>
        <Label>Description</Label>
        <p className="text-sm font-mono">{tx.description}</p>
      </div>
      
      <div>
        <Label>Payment Method</Label>
        <p>{tx.paymentMethod}</p>
      </div>
      
      {tx.reference && (
        <div>
          <Label>Reference</Label>
          <p className="text-sm font-mono">{tx.reference}</p>
        </div>
      )}
      
      <div>
        <Label>Balance After</Label>
        <p>{formatCurrency(tx.balanceAfter)}</p>
      </div>
    </div>
  </div>
  
  {/* Similar transactions */}
  <div className="mt-6">
    <h4 className="font-semibold mb-2">
      Similar Transactions ({similarTxs.length})
    </h4>
    <div className="max-h-40 overflow-y-auto">
      {similarTxs.slice(0, 5).map(stx => (
        <MiniTransactionRow key={stx.id} transaction={stx} />
      ))}
    </div>
  </div>
</TransactionDetail>
```

---

## Database Changes

```typescript
// Add to Transaction
interface Transaction {
  // ... existing fields
  
  // Editing tracking
  isEdited: boolean;
  editedFields?: string[];      // ['category', 'merchant']
  editedAt?: string;
  
  // User additions
  notes?: string;
  tags?: string[];
  isExcludedFromBudget: boolean;
  
  // Original data preservation
  merchantOriginal: string;     // Keep original bank merchant
}
```

---

## Implementation Checklist

- [ ] Add inline editing to TransactionRow
- [ ] Create CategorySelect component with search
- [ ] Build Category Management page
- [ ] Create MerchantMapping table and logic
- [ ] Build Merchant Management UI
- [ ] Implement batch selection and operations
- [ ] Create Import Rules builder
- [ ] Add similar transaction detection
- [ ] Build Transaction Detail dialog
- [ ] Save edit history for undo

---

*Last updated: January 20, 2026*
