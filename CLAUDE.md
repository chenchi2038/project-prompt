# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "project-prompt", a prompt writing tool for developers. It's a web-based application that helps developers create and manage prompts for AI tools by providing easy file selection and content management features.

## Commands

### Development Commands
- `npm start` - Start the development server on port 5010
- `npm test` - Run tests (currently shows "no test specified")

### CLI Usage
The project can be run as a CLI tool:
- `npx project-prompt` or `node bin/cli.js` - Launch the application

## Architecture

### Core Components

**Backend (Express.js Server - index.js)**
- Main application server running on port 5010
- RESTful API endpoints for projects, prompts, and favorites management
- **Project ordering APIs**: `/api/projects/:id/move-up` and `/api/projects/:id/move-down`
- **Claude proxy APIs**: Full proxy configuration management and request forwarding
  - `/api/claude-proxies` - CRUD operations for proxy configurations
  - `/api/claude-proxies/:id/activate` - Activate a proxy
  - `/api/claude-proxies/:id/move-up` and `/move-down` - Reorder proxies
  - `/claude/*` - Stream-based request forwarding to active proxy
- File scanning with .gitignore integration using glob patterns
- JSON-based data persistence (data.json)
- Auto-opens browser on startup

**Frontend (Modular Single Page Application)**
- **public/index.html** - Bootstrap-based UI with modals for project and proxy management
- **public/css/style.css** - Custom styling with compact layout and smooth transitions
- **public/js/** - Modular JavaScript architecture following SOLID principles:
  - **app.js** - Main PromptWriter class (orchestration layer) with project ordering methods
  - **ProjectManager.js** - Project CRUD operations, state management, and ordering APIs
  - **FileManager.js** - File operations, autocomplete, and content insertion
  - **FavoriteManager.js** - Favorites management functionality
  - **ClaudeProxyManager.js** - Claude proxy configuration and management
  - **UIUtils.js** - Shared UI utilities and helper functions

### Key Features

1. **Project Management**
   - Add/edit/delete projects with custom exclude patterns
   - File scanning with .gitignore respect and custom exclusions
   - Project-specific prompt storage
   - **Project ordering**: Use up/down arrow buttons to adjust project display order
   - Compact display with path shown only on hover

2. **Smart File Selection**
   - Type `@` in textarea to trigger file autocomplete
   - Type `@@` for content mode (includes file contents in output)
   - VSCode-style fuzzy matching for file paths
   - Real-time file filtering and highlighting

3. **Favorites System**
   - Save frequently used prompts per project
   - Quick load functionality
   - Metadata support (name, description)

4. **File Processing**
   - Intelligent .gitignore parsing and glob pattern conversion
   - File caching for performance
   - Source code copying with content embedding

5. **User Interface Improvements**
   - Compact project list display for better space utilization
   - Hover-based project path visibility
   - Absolute positioning for action buttons to prevent layout overflow
   - Smooth animations and transitions for better user experience

6. **Claude Proxy Management**
   - Add/edit/delete Claude API proxy configurations
   - One-click activation by clicking on proxy item
   - Display active proxy name in navbar
   - Reorder proxies with up/down buttons
   - Stream-based request forwarding to active proxy

### Data Storage

- **data.json** - Main data file containing:
  - `projects[]` - Project configurations
  - `prompts{}` - Project ID to prompt content mapping
  - `favorites[]` - Saved favorite prompts
  - `claudeProxies[]` - Claude proxy configurations
  - `activeProxyId` - Currently active proxy ID

### File Structure Patterns

The application expects standard project structures and automatically excludes:
- `.git/**`
- `node_modules/**`
- Files matching .gitignore patterns
- Custom exclude patterns per project

## Development Notes

### Architecture Principles
- **SOLID Principles**: Each JavaScript module follows single responsibility principle
- **KISS (Keep It Simple)**: Clean separation of concerns across modules
- **DRY (Don't Repeat Yourself)**: Shared utilities prevent code duplication
- **Modular Design**: Easy to maintain, test, and extend individual components

### Technical Details
- The application uses Bootstrap 5 for UI components
- File scanning is cached for performance - use refresh button to re-scan
- Supports fuzzy file matching similar to VSCode's Ctrl+P functionality
- All data is persisted automatically on changes
- Modular JavaScript architecture allows independent development of features
- **Compact UI Design**: Project paths are hidden by default and shown on hover
- **Smooth Interactions**: CSS transitions provide fluid user experience
- **Responsive Layout**: Action buttons are positioned absolutely to prevent overflow

### File Structure
```
public/
├── index.html                 # Main HTML file
├── css/
│   └── style.css             # Application styles
└── js/
    ├── app.js                # Main orchestration class
    ├── ProjectManager.js     # Project management
    ├── FileManager.js        # File operations
    ├── FavoriteManager.js    # Favorites functionality
    ├── ClaudeProxyManager.js # Claude proxy management
    └── UIUtils.js            # Shared utilities
```

### Code Quality
- **Separation of Concerns**: Each module has a single, well-defined responsibility
- **Dependency Injection**: Main class depends on abstractions, not concrete implementations
- **Error Handling**: Proper error boundaries and user feedback
- **Performance**: Optimized file operations and UI updates
- **User Experience**: Intuitive interactions with clear visual feedback
- **Accessibility**: Proper button labeling and keyboard navigation support

### Recent Improvements (Latest Version - v2.2.0)
- **Claude Proxy Management**: Full proxy configuration system with CRUD operations
- **One-Click Activation**: Click proxy item to activate, no separate button needed
- **Active Proxy Display**: Navbar shows currently active proxy name with badge
- **Proxy Ordering**: Move proxies up/down with arrow buttons
- **Request Forwarding**: Stream-based Claude API request proxy with proper header handling
- **UI Improvements**: Unified button styles, hover effects, and smooth animations
- **Smart Notifications**: Show proxy names in activation and deletion confirmations

### Previous Improvements (v2.1.0)
- **Project Ordering**: Added up/down arrow buttons to reorder projects in the list
- **Compact Display**: Reduced spacing and padding for more efficient space usage
- **Hover Interactions**: Project paths are now hidden by default, shown on hover
- **Better Button Layout**: Action buttons use absolute positioning to prevent overflow
- **Smooth Animations**: Enhanced with CSS transitions for better user experience
- **API Extensions**: New backend endpoints for project ordering operations