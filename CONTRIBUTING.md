# Contributing to Rowbooster

Thank you for your interest in contributing to Rowbooster! We welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/rowbooster.git
   cd rowbooster
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/original-owner/rowbooster.git
   ```

## Development Setup

### Prerequisites

- Node.js v18 or higher
- PostgreSQL v14 or higher
- npm or yarn

### Installation Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up the database**:
   ```bash
   # Create PostgreSQL database
   createdb rowbooster
   
   # Push database schema
   npm run db:push
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## Making Changes

### Creating a Branch

Create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

Use a descriptive branch name:
- `feature/` - for new features
- `fix/` - for bug fixes
- `docs/` - for documentation updates
- `refactor/` - for code refactoring
- `test/` - for adding tests

### Development Workflow

1. **Keep your fork updated**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Make your changes** following the coding guidelines

3. **Test your changes** thoroughly

4. **Commit your changes** with clear, descriptive messages:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Format

Follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example:
```
feat: add PDF batch processing capability

- Implement multi-file upload support
- Add progress tracking for batch operations
- Update UI to display batch results
```

## Submitting Changes

### Pull Request Process

1. **Push your changes** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub:
   - Provide a clear title and description
   - Reference any related issues (e.g., "Fixes #123")
   - Describe what changed and why
   - Include screenshots for UI changes

3. **Wait for review**:
   - Address any feedback from maintainers
   - Make requested changes if needed
   - Keep the PR updated with main branch

### Pull Request Checklist

Before submitting, ensure:

- [ ] Code follows the project's coding guidelines
- [ ] All tests pass
- [ ] New features include tests
- [ ] Documentation is updated
- [ ] Commit messages are clear and descriptive
- [ ] No sensitive data (API keys, passwords) is committed
- [ ] `.env` file is not committed

## Coding Guidelines

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow existing code style and formatting
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Avoid `any` types when possible

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript interfaces for props
- Follow the existing component structure

### File Organization

```
client/src/
  ├── components/     # Reusable UI components
  ├── pages/          # Page components
  ├── hooks/          # Custom React hooks
  ├── lib/            # Utility functions
  └── contexts/       # React contexts

server/
  ├── services/       # Business logic services
  ├── routes.ts       # API route handlers
  └── db.ts           # Database connection

shared/
  └── schema.ts       # Shared types and schemas
```

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings (unless template literals)
- Add semicolons
- Maximum line length: 100 characters
- Use trailing commas in multi-line objects/arrays

### CSS/Styling

- Use Tailwind CSS utility classes
- Follow the existing styling patterns
- Keep styles consistent with the UI design
- Use shadcn/ui components when available

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- path/to/test.ts
```

### Writing Tests

- Write tests for new features
- Update tests for modified features
- Aim for good test coverage
- Use descriptive test names

## Documentation

### Updating Documentation

When making changes, update relevant documentation:

- **README.md** - Overview and setup instructions
- **DOCUMENTATION.md** - Detailed feature documentation
- **Code comments** - Inline documentation for complex logic
- **API documentation** - Document new endpoints

### Documentation Style

- Use clear, concise language
- Include code examples where helpful
- Keep documentation up to date with code changes
- Use proper markdown formatting

## Questions?

If you have questions:

1. Check existing documentation
2. Search existing issues on GitHub
3. Create a new issue with the "question" label

## Thank You!

Your contributions help make Rowbooster better for everyone. We appreciate your time and effort!

---

*For security-related issues, please see [SECURITY.md](SECURITY.md)*