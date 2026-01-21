# Sticky Sidebar Specification

**Version**: v0.1.0  
**Priority**: 🟠 HIGH  
**Status**: Specification Complete

---

## Problem

When user scrolls the page, the sidebar stays at the top and disappears from view. The sidebar should remain visible at all times.

## Solution

Use CSS `position: sticky` or `position: fixed` with proper layout handling.

### Option A: Sticky Position (Recommended)

```tsx
// Layout component
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 shrink-0">
        <div className="sticky top-0 h-screen overflow-y-auto border-r bg-background">
          <Sidebar />
        </div>
      </aside>
      
      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
```

### CSS Details

```css
/* Sidebar container */
.sidebar-container {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  
  /* Hide scrollbar but allow scrolling */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.sidebar-container:hover {
  scrollbar-color: rgba(0,0,0,0.2) transparent;
}

/* For webkit browsers */
.sidebar-container::-webkit-scrollbar {
  width: 6px;
}

.sidebar-container::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-container::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 3px;
}

.sidebar-container:hover::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0.2);
}
```

### Sidebar Component

```tsx
export function Sidebar() {
  const pathname = usePathname();
  
  return (
    <div className="flex flex-col h-full">
      {/* Header - Logo */}
      <div className="p-6 border-b">
        <Link href="/" className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" />
          <span className="font-bold text-xl">WealthPilot</span>
        </Link>
      </div>
      
      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {NAV_ITEMS.map(item => (
            <SidebarItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.href}
            />
          ))}
        </div>
        
        {/* Subscriptions subsection */}
        <div className="mt-6">
          <h4 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase">
            Recurring
          </h4>
          <div className="space-y-1">
            <SidebarItem href="/subscriptions" icon={CreditCard} label="Subscriptions" />
            <SidebarItem href="/calendar" icon={Calendar} label="Bill Calendar" />
          </div>
        </div>
      </nav>
      
      {/* Footer - Always visible */}
      <div className="p-4 border-t mt-auto">
        <SidebarItem href="/settings" icon={Settings} label="Settings" />
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Current Balance</p>
          <p className="text-lg font-bold">{formatCurrency(balance)}</p>
        </div>
      </div>
    </div>
  );
}
```

### Mobile Responsiveness

```tsx
export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="sticky top-0 h-screen overflow-y-auto border-r bg-background">
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
      </aside>
      
      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex items-center gap-4 p-4 border-b bg-background lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold">WealthPilot</span>
        </div>
        
        {children}
      </main>
    </div>
  );
}
```

## Implementation Checklist

- [ ] Update layout.tsx with sticky sidebar
- [ ] Add overflow handling
- [ ] Add scrollbar styling
- [ ] Implement mobile hamburger menu
- [ ] Test on various screen sizes

---

*Last updated: January 20, 2026*
