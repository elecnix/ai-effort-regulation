# Documentation Index

**Version**: 1.1  
**Last Updated**: October 11, 2025  
**Organization**: Cleaned up and reorganized for clarity

## 📚 Documentation Structure

The documentation has been organized into a clear, logical structure:

```
/                           # Essential user-facing docs (7 files)
├── docs/technical/         # Technical specifications (5 files)
├── docs/testing/           # Testing documentation (5 files)
└── docs/archive/           # Historical records (23 files)
```

---

## 🚀 Essential Documentation (Root Directory)

### For All Users

| Document | Purpose |
|----------|---------|
| **[README.md](./README.md)** | Main entry point, quick start, API reference |
| **[USER-GUIDE.md](./USER-GUIDE.md)** | Comprehensive user guide with examples |
| **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** | Fast reference for common tasks |
| **[FEATURES.md](./FEATURES.md)** | Complete feature list and status |

### For Upgrading Users

| Document | Purpose |
|----------|---------|
| **[RELEASE-NOTES.md](./RELEASE-NOTES.md)** | Latest features and changes (v1.1) |
| **[MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)** | Upgrade instructions and breaking changes |

### Meta

| Document | Purpose |
|----------|---------|
| **[DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md)** | This file - documentation map |

---

## 🔧 Technical Documentation

Located in `docs/technical/`

| Document | Purpose | Audience |
|----------|---------|----------|
| **[specification.md](./docs/technical/specification.md)** | Core system specification | Developers, architects |
| **[mcp-integration-spec.md](./docs/technical/mcp-integration-spec.md)** | MCP integration specification | Developers, integrators |
| **[energy-budget-spec.md](./docs/technical/energy-budget-spec.md)** | Energy budget specification | Developers |
| **[apps-specification.md](./docs/technical/apps-specification.md)** | Apps feature technical spec | Developers, architects |
| **[http-mcp-spec.md](./docs/technical/http-mcp-spec.md)** | HTTP transport specification | Developers, integrators |

---

## 🧪 Testing Documentation

Located in `docs/testing/`

| Document | Purpose |
|----------|---------|
| **[test-report.md](./docs/testing/test-report.md)** | Initial comprehensive testing |
| **[edge-case-test-report.md](./docs/testing/edge-case-test-report.md)** | 40 edge case tests and findings |
| **[post-merge-test-results.md](./docs/testing/post-merge-test-results.md)** | Post-merge verification |
| **[testing-summary.md](./docs/testing/testing-summary.md)** | Overall testing summary |
| **[v1.1-release-summary.md](./docs/testing/v1.1-release-summary.md)** | v1.1 release comprehensive summary |

---

## 📦 Archived Documentation

Located in `docs/archive/` - Historical records preserved for reference

### Implementation History (`docs/archive/implementation/`)

Records of how features were implemented (11 files):
- Original prompt and requirements
- MCP implementation plan and summary
- Apps implementation plan and summary
- Energy budget implementation details
- Critical fixes implementation
- And more...

### Status Reports (`docs/archive/status/`)

Historical status reports (4 files):
- Sub-agent status
- MCP spec vs implementation
- Energy tracking summary
- HTTP MCP implementation summary

### Old Guides (`docs/archive/guides/`)

Superseded by main documentation (5 files):
- Energy budget quickstart
- Sub-agent test guide
- Tool namespacing guide
- Unified MCP tools guide
- New features quick reference

### Vision Documents (`docs/archive/vision/`)

Original vision documents (1 file):
- Apps vision document

---

## 🎯 Quick Start Paths

### New User
1. [README.md](./README.md) - Installation and quick start
2. [USER-GUIDE.md](./USER-GUIDE.md) - Learn how to use the system
3. [QUICK-REFERENCE.md](./QUICK-REFERENCE.md) - Keep handy for commands

### Upgrading from v1.0
1. [RELEASE-NOTES.md](./RELEASE-NOTES.md) - See what's new in v1.1
2. [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) - Follow upgrade steps
3. [FEATURES.md](./FEATURES.md) - Explore new capabilities

### Developer
1. [docs/technical/specification.md](./docs/technical/specification.md) - System design
2. [docs/technical/mcp-integration-spec.md](./docs/technical/mcp-integration-spec.md) - MCP integration
3. [docs/testing/](./docs/testing/) - Test documentation

### Troubleshooting
1. [USER-GUIDE.md](./USER-GUIDE.md) - Check troubleshooting section
2. [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) - If upgrading
3. [docs/testing/edge-case-test-report.md](./docs/testing/edge-case-test-report.md) - Known issues

---

## 📊 Documentation Statistics

| Category | Count | Location |
|----------|-------|----------|
| Essential Docs | 7 | Root directory |
| Technical Specs | 5 | `docs/technical/` |
| Testing Docs | 5 | `docs/testing/` |
| Archived Docs | 23 | `docs/archive/` |
| **Total** | **40** | - |

---

## 🔍 Finding What You Need

### By Task

**I want to...**

- **Get started** → [README.md](./README.md)
- **Learn the system** → [USER-GUIDE.md](./USER-GUIDE.md)
- **Find a command** → [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)
- **See all features** → [FEATURES.md](./FEATURES.md)
- **Upgrade** → [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)
- **Understand architecture** → [docs/technical/specification.md](./docs/technical/specification.md)
- **Integrate MCP** → [docs/technical/mcp-integration-spec.md](./docs/technical/mcp-integration-spec.md)
- **See test results** → [docs/testing/](./docs/testing/)
- **Read history** → [docs/archive/](./docs/archive/)

### By Audience

**End Users**
- [README.md](./README.md)
- [USER-GUIDE.md](./USER-GUIDE.md)
- [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)
- [FEATURES.md](./FEATURES.md)

**Developers**
- [docs/technical/](./docs/technical/) - All technical specs
- [docs/testing/](./docs/testing/) - Test documentation
- [USER-GUIDE.md](./USER-GUIDE.md) - API usage

**Operations**
- [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) - Upgrade procedures
- [README.md](./README.md) - Deployment instructions
- [docs/testing/v1.1-release-summary.md](./docs/testing/v1.1-release-summary.md) - Release details

---

## 📝 Documentation Standards

All documentation follows these standards:

- ✅ **Markdown Format** - Easy to read and version control
- ✅ **Clear Structure** - Headings, tables, code blocks
- ✅ **Practical Examples** - Copy-pastable code
- ✅ **Cross-References** - Links to related docs
- ✅ **Version Info** - Last updated date
- ✅ **Status Indicators** - Clear feature status

---

## 🔄 Recent Changes (v1.1)

### Documentation Cleanup
- Moved 31 files to organized structure
- Root directory: 38 files → 7 files
- Created logical organization by purpose
- All historical records preserved in archive

### New Documentation
- [RELEASE-NOTES.md](./RELEASE-NOTES.md) - v1.1 release notes
- [docs/testing/v1.1-release-summary.md](./docs/testing/v1.1-release-summary.md) - Comprehensive summary
- Updated [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) - v1.1 upgrade guide

---

## 💡 Tips

- **Start with README** if you're new
- **Bookmark QUICK-REFERENCE** for daily use
- **Check RELEASE-NOTES** before upgrading
- **Read MIGRATION-GUIDE** when upgrading
- **Explore docs/technical/** for deep dives
- **Check docs/testing/** for test results

---

**Need help?** Start with [README.md](./README.md) or [USER-GUIDE.md](./USER-GUIDE.md)

**Last Updated**: October 11, 2025 | **Version**: 1.1 | **Status**: ✅ Complete
