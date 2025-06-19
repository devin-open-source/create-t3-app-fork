# Performance Analysis Report - create-t3-app CLI

## Executive Summary

This report documents performance inefficiencies identified in the create-t3-app CLI codebase. The analysis focused on file I/O operations, synchronous blocking calls, and opportunities for parallelization.

## Key Findings

### 1. Synchronous File Operations Blocking Event Loop

**Severity: High**
**Files Affected:** Multiple installer files and helpers

The codebase extensively uses synchronous file operations (`fs.readFileSync`, `fs.writeFileSync`, `fs.copyFileSync`) that block the Node.js event loop. This is particularly problematic in:

- `src/helpers/setImportAlias.ts` - Recursively processes all project files synchronously
- `src/installers/envVars.ts` - Multiple sync file writes
- `src/installers/prisma.ts` - Sync file reads and writes
- `src/installers/drizzle.ts` - Multiple sync file operations
- `src/helpers/createProject.ts` - Sync file copies

**Impact:** Blocks the event loop, making the CLI unresponsive during file operations, especially for large projects.

### 2. Inefficient Recursive Directory Traversal

**Severity: High**
**File:** `src/helpers/setImportAlias.ts`

The `replaceTextInFiles` function recursively traverses directories and processes files synchronously:

```typescript
function replaceTextInFiles(directoryPath: string, search: string, replacement: string): void {
  const files = fs.readdirSync(directoryPath);
  files.forEach((file) => {
    const filePath = path.join(directoryPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      replaceTextInFiles(filePath, search, replacement);
    } else {
      const data = fs.readFileSync(filePath, "utf8");
      const updatedData = data.replace(new RegExp(search, "g"), replacement);
      fs.writeFileSync(filePath, updatedData, "utf8");
    }
  });
}
```

**Issues:**
- Synchronous directory reads block the event loop
- Files are processed sequentially instead of in parallel
- No error handling for file operations
- Processes all files even if they don't contain the search pattern

**Impact:** Significant performance degradation for projects with many files.

### 3. Sequential File Operations in Installers

**Severity: Medium**
**Files:** `src/installers/prisma.ts`, `src/installers/drizzle.ts`, `src/installers/envVars.ts`

Installers perform multiple file operations sequentially that could be parallelized:

```typescript
// In drizzle.ts
let schemaContent = fs.readFileSync(schemaSrc, "utf-8");
let configContent = fs.readFileSync(configFile, "utf-8");
// ... processing ...
fs.writeFileSync(schemaDest, schemaContent);
fs.writeFileSync(configDest, configContent);
```

**Impact:** Unnecessary waiting time when multiple independent file operations could run concurrently.

### 4. Redundant File Reads

**Severity: Low**
**Files:** Various installers

Some installers read the same `package.json` file multiple times or read files that could be cached.

**Impact:** Minor performance overhead from redundant I/O operations.

### 5. Missing Error Handling

**Severity: Medium**
**Files:** Multiple

Many file operations lack proper error handling, which can lead to unclear error messages and potential crashes.

**Impact:** Poor user experience when file operations fail.

## Recommended Fixes

### Priority 1: Convert setImportAlias to Async Operations
- Replace synchronous file operations with async equivalents
- Use `Promise.all` to parallelize file processing within directories
- Add proper error handling

### Priority 2: Optimize Installer File Operations
- Convert synchronous operations to async where possible
- Parallelize independent file operations
- Cache frequently read files like package.json

### Priority 3: Add Error Handling
- Wrap file operations in try-catch blocks
- Provide meaningful error messages
- Gracefully handle permission errors and missing files

## Performance Impact Estimates

- **setImportAlias optimization**: 60-80% reduction in processing time for large projects
- **Installer parallelization**: 20-40% reduction in overall installation time
- **Error handling improvements**: Better user experience, no direct performance impact

## Implementation Notes

The most impactful fix is converting `setImportAlias.ts` to use async operations, as this function can process hundreds or thousands of files in large projects. The current synchronous implementation can take several seconds for large codebases, while an async implementation with parallelization could reduce this to under a second.
