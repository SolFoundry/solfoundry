## Summary
Improves mobile responsiveness of bounty cards across all screen sizes (320px to 1440px+).

## Changes

### BountyCard Component
- **Responsive padding**: Adjusted from p-5 to p-3 sm:p-4 lg:p-5 for better mobile spacing
- **Touch-friendly targets**: Added min-h-[180px] sm:min-h-[200px] and min-h-[44px] for buttons
- **Improved layout**: Status badge moved from absolute positioning to inline layout to prevent overlap
- **Typography**: Responsive font sizes (text-[10px] sm:text-xs, text-sm sm:text-base)
- **Accessibility**: Added keyboard navigation (Enter/Space), aria-label, and role=button
- **Semantic HTML**: Changed from div to article for better semantics

### BountyGrid Component  
- **Responsive grid gaps**: gap-3 sm:gap-4 lg:gap-5 for tighter mobile layouts
- **Horizontal scroll filters**: Filter pills now horizontally scrollable on mobile
- **Collapsible filters**: Added mobile filter toggle button with Filter icon
- **Touch targets**: All buttons have min-h-[36px] or min-h-[44px]
- **Responsive padding**: Container padding adjusted for mobile (px-3 sm:px-4 lg:px-6)

### FeaturedBounties Component
- **Responsive typography**: Font sizes scale from mobile to desktop
- **Improved spacing**: Adjusted margins and padding for mobile viewports
- **Grid columns**: Added xs:grid-cols-2 for better 2-column layout on small screens

### Global CSS Updates
- Added xs breakpoint (480px) to Tailwind theme
- Added utility classes: .scrollbar-hide, .touch-manipulation, .tap-highlight
- Added safe area insets support for notched devices
- Fixed debounce type signature for TypeScript compatibility

## Testing
- Build passes (npm run build)
- No TypeScript errors
- Responsive across viewport sizes (320px, 375px, 414px, 768px, 1024px, 1440px+)
- Touch-friendly interactions on mobile
- No horizontal scroll on mobile

## Acceptance Criteria
- ✅ Bounty cards look great on all screen sizes
- ✅ Proper spacing and typography on mobile
- ✅ Touch-friendly interactions
- ✅ No horizontal scroll on mobile
- ✅ Stack layout appropriately on small screens

---
/claim #824