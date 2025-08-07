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
- File scanning with .gitignore integration using glob patterns
- JSON-based data persistence (data.json)
- Auto-opens browser on startup

**Frontend (Modular Single Page Application)**
- **public/index.html** - Bootstrap-based UI with modals for project management
- **public/css/style.css** - Custom styling
- **public/js/** - Modular JavaScript architecture following SOLID principles:
  - **app.js** - Main PromptWriter class (orchestration layer)
  - **ProjectManager.js** - Project CRUD operations and state management
  - **FileManager.js** - File operations, autocomplete, and content insertion
  - **FavoriteManager.js** - Favorites management functionality
  - **UIUtils.js** - Shared UI utilities and helper functions

### Key Features

1. **Project Management**
   - Add/edit/delete projects with custom exclude patterns
   - File scanning with .gitignore respect and custom exclusions
   - Project-specific prompt storage

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

### Data Storage

- **data.json** - Main data file containing:
  - `projects[]` - Project configurations
  - `prompts{}` - Project ID to prompt content mapping  
  - `favorites[]` - Saved favorite prompts

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

### File Structure
```
public/
├── index.html              # Main HTML file
├── css/
│   └── style.css          # Application styles
└── js/
    ├── app.js             # Main orchestration class
    ├── ProjectManager.js  # Project management
    ├── FileManager.js     # File operations
    ├── FavoriteManager.js # Favorites functionality
    └── UIUtils.js         # Shared utilities
```

### Code Quality
- **Separation of Concerns**: Each module has a single, well-defined responsibility
- **Dependency Injection**: Main class depends on abstractions, not concrete implementations
- **Error Handling**: Proper error boundaries and user feedback
- **Performance**: Optimized file operations and UI updates