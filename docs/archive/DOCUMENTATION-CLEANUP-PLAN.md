# Documentation Cleanup Plan

**Date**: October 11, 2025  
**Purpose**: Organize documentation for better discoverability and maintenance

## Current State

**Total Files**: 38 markdown files in root directory  
**Problem**: Too many files, hard to find what you need  
**Solution**: Organize into logical structure

## Proposed Structure

```
/
├── README.md                          # Main entry point
├── FEATURES.md                        # Feature list
├── RELEASE-NOTES.md                   # Release history
├── MIGRATION-GUIDE.md                 # Upgrade guide
├── QUICK-REFERENCE.md                 # Quick reference
├── USER-GUIDE.md                      # Comprehensive user guide
├── CHANGELOG.md                       # (to be created)
│
├── docs/
│   ├── technical/                     # Technical specifications
│   │   ├── specification.md
│   │   ├── mcp-integration-spec.md
│   │   ├── energy-budget-spec.md
│   │   ├── apps-specification.md
│   │   └── http-mcp-spec.md
│   │
│   ├── testing/                       # Testing documentation
│   │   ├── test-report.md
│   │   ├── edge-case-test-report.md
│   │   ├── post-merge-test-results.md
│   │   └── testing-summary.md
│   │
│   └── archive/                       # Historical records
│       ├── implementation/            # Implementation history
│       │   ├── 1-prompt.md
│       │   ├── 4-mcp-implementation-plan.md
│       │   ├── 8-apps-implementation-plan.md
│       │   ├── 9-apps-implementation-summary.md
│       │   ├── 10-app-conversation-binding.md
│       │   ├── implementation-summary.md
│       │   ├── mcp-implementation-complete.md
│       │   ├── mcp-integration-complete.md
│       │   ├── energy-budget-implementation.md
│       │   ├── improvements-implemented.md
│       │   └── critical-fixes-implemented.md
│       │
│       ├── status/                    # Status reports
│       │   ├── sub-agent-status.md
│       │   ├── mcp-spec-vs-implementation.md
│       │   ├── energy-tracking-summary.md
│       │   └── http-mcp-implementation-summary.md
│       │
│       └── guides/                    # Old guides (superseded)
│           ├── energy-budget-quickstart.md
│           ├── sub-agent-test-guide.md
│           ├── tool-namespacing.md
│           ├── unified-mcp-tools.md
│           └── new-features-quick-ref.md
```

## Files to Keep in Root (Essential)

### User-Facing (6 files)
1. ✅ README.md - Main entry point
2. ✅ FEATURES.md - Feature list
3. ✅ RELEASE-NOTES.md - Release history
4. ✅ MIGRATION-GUIDE.md - Upgrade guide
5. ✅ QUICK-REFERENCE.md - Quick reference
6. ✅ USER-GUIDE.md - Comprehensive guide

### Meta (2 files)
7. ✅ DOCUMENTATION-INDEX.md - Updated index
8. 🆕 CHANGELOG.md - Standard changelog format

**Total in Root**: 8 files (down from 38)

## Files to Move to docs/technical/ (5 files)

Technical specifications that developers need:
1. 2-specification.md → docs/technical/specification.md
2. 3-mcp-integration-spec.md → docs/technical/mcp-integration-spec.md
3. 5-energy-budget-spec.md → docs/technical/energy-budget-spec.md
4. 7-apps-specification.md → docs/technical/apps-specification.md
5. HTTP-MCP-SPEC.md → docs/technical/http-mcp-spec.md

## Files to Move to docs/testing/ (5 files)

Testing documentation:
1. TEST-REPORT.md → docs/testing/test-report.md
2. EDGE-CASE-TEST-REPORT.md → docs/testing/edge-case-test-report.md
3. POST-MERGE-TEST-RESULTS.md → docs/testing/post-merge-test-results.md
4. TESTING-SUMMARY.md → docs/testing/testing-summary.md
5. V1.1-RELEASE-SUMMARY.md → docs/testing/v1.1-release-summary.md

## Files to Archive (20 files)

### Implementation History (11 files)
1. 1-prompt.md → docs/archive/implementation/
2. 4-mcp-implementation-plan.md → docs/archive/implementation/
3. 8-apps-implementation-plan.md → docs/archive/implementation/
4. 9-apps-implementation-summary.md → docs/archive/implementation/
5. 10-app-conversation-binding.md → docs/archive/implementation/
6. IMPLEMENTATION-SUMMARY.md → docs/archive/implementation/
7. MCP-IMPLEMENTATION-COMPLETE.md → docs/archive/implementation/
8. MCP-INTEGRATION-COMPLETE.md → docs/archive/implementation/
9. ENERGY-BUDGET-IMPLEMENTATION.md → docs/archive/implementation/
10. IMPROVEMENTS-IMPLEMENTED.md → docs/archive/implementation/
11. CRITICAL-FIXES-IMPLEMENTED.md → docs/archive/implementation/

### Status Reports (4 files)
12. SUB-AGENT-STATUS.md → docs/archive/status/
13. MCP-SPEC-VS-IMPLEMENTATION.md → docs/archive/status/
14. ENERGY-TRACKING-SUMMARY.md → docs/archive/status/
15. HTTP-MCP-IMPLEMENTATION-SUMMARY.md → docs/archive/status/

### Old Guides (5 files - superseded by main docs)
16. ENERGY-BUDGET-QUICKSTART.md → docs/archive/guides/
17. SUB-AGENT-TEST-GUIDE.md → docs/archive/guides/
18. TOOL-NAMESPACING.md → docs/archive/guides/
19. UNIFIED-MCP-TOOLS.md → docs/archive/guides/
20. NEW-FEATURES-QUICK-REF.md → docs/archive/guides/

### Vision Documents (2 files)
21. 6-apps-vision.md → docs/archive/vision/
22. DOCUMENTATION-REVIEW.md → docs/archive/

## Benefits

### Before Cleanup
- 38 files in root directory
- Hard to find what you need
- Unclear which docs are current
- Historical clutter

### After Cleanup
- 8 essential files in root
- Clear organization
- Easy to find current docs
- Historical records preserved but organized

## Implementation Steps

1. ✅ Create directory structure
2. ⏳ Move files to new locations
3. ⏳ Update internal links
4. ⏳ Update DOCUMENTATION-INDEX.md
5. ⏳ Create CHANGELOG.md
6. ⏳ Update README.md with new structure
7. ⏳ Test all links
8. ⏳ Commit changes

## Link Updates Needed

After moving files, update links in:
- README.md
- DOCUMENTATION-INDEX.md
- USER-GUIDE.md
- Any cross-references

## Backward Compatibility

To maintain backward compatibility, we could:
1. Add redirects in README
2. Keep a "Moved Files" section in DOCUMENTATION-INDEX.md
3. Update any external links in issues/PRs

## Success Criteria

- ✅ Root directory has ≤10 files
- ✅ Clear organization by purpose
- ✅ All links work
- ✅ Historical records preserved
- ✅ Easy to find current documentation
- ✅ No information lost

## Timeline

**Estimated Time**: 30-45 minutes
- Directory creation: 5 min ✅
- File moves: 10 min
- Link updates: 15 min
- Testing: 10 min
- Commit: 5 min
