# GitHub Publishing Checklist

This checklist ensures your Rowbooster project is properly configured and secure before pushing to GitHub.

## 🔒 Security Verification

### Environment Variables
- [ ] `.env` file is in `.gitignore` and will NOT be committed
- [ ] `.env.example` contains only placeholder values (no real API keys)
- [ ] All API keys are stored in `.env` file only
- [ ] No hardcoded API keys or secrets in the codebase

### Sensitive Files
- [ ] `.env` is NOT tracked by git
- [ ] Database credentials are only in `.env`
- [ ] No production passwords in any committed files
- [ ] `attached_assets/` folder is in `.gitignore`
- [ ] Test files and local configs are in `.gitignore`

### Code Review
- [ ] No API keys in source code files
- [ ] No passwords in configuration files
- [ ] No sensitive user data in the repository
- [ ] All database connection strings use environment variables

## 📝 Documentation

### Required Files
- [x] `README.md` - Project overview and setup instructions
- [x] `LICENSE` - MIT License file
- [x] `CONTRIBUTING.md` - Contribution guidelines
- [x] `SECURITY.md` - Security policy and reporting
- [x] `.gitignore` - Properly configured
- [x] `.env.example` - Template for environment variables

### GitHub Templates
- [x] `.github/ISSUE_TEMPLATE/bug_report.md`
- [x] `.github/ISSUE_TEMPLATE/feature_request.md`
- [x] `.github/PULL_REQUEST_TEMPLATE.md`

### Update Documentation
- [ ] Update repository URL in `package.json`
- [ ] Update repository URL in `README.md`
- [ ] Replace placeholder email in `SECURITY.md`
- [ ] Review all documentation for accuracy

## 🔧 Configuration

### package.json
- [x] Project name updated to "rowbooster"
- [x] Description added
- [x] Repository URLs configured (update with your GitHub username)
- [x] Keywords added for discoverability
- [ ] Update repository URL with actual GitHub username

### .gitignore
- [x] `.env` and `.env.local` files
- [x] `node_modules/`
- [x] Build directories (`dist/`, `server/public/`)
- [x] Test files
- [x] Platform-specific files
- [x] Temporary and local files

## 🧪 Pre-Commit Verification

### Test Your Setup
```bash
# 1. Check for sensitive data
git status
git diff

# 2. Verify .env is not staged
git ls-files | grep "\.env$"
# Should return nothing (or only .env.example)

# 3. Check for accidentally staged secrets
git diff --cached

# 4. Run security audit
npm audit
```

### Clean Up
- [ ] Remove any `.env` files from git history if accidentally committed
- [ ] Remove test data files that shouldn't be public
- [ ] Remove any backup files (.bak, .old, etc.)
- [ ] Remove development-specific configurations

## 🚀 Repository Setup

### Before First Push

1. **Create GitHub Repository**
   ```bash
   # Do NOT initialize with README, .gitignore, or LICENSE
   # We already have these files
   ```

2. **Update URLs in Files**
   - Update `package.json` repository URL
   - Update `README.md` clone URL
   - Update `SECURITY.md` contact information

3. **Initialize Git (if not already done)**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

4. **Add Remote and Push**
   ```bash
   git remote add origin https://github.com/yourusername/rowbooster.git
   git branch -M main
   git push -u origin main
   ```

### After First Push

- [ ] Enable GitHub Security Features:
  - [ ] Enable Dependabot alerts
  - [ ] Enable secret scanning
  - [ ] Enable code scanning (if available)
  - [ ] Review security advisories

- [ ] Configure Repository Settings:
  - [ ] Add repository description
  - [ ] Add topics/tags
  - [ ] Set up branch protection rules (optional)
  - [ ] Configure collaborators (if needed)

## ⚠️ Critical Reminders

### NEVER COMMIT:
- ❌ `.env` file with real credentials
- ❌ API keys or secrets
- ❌ Database passwords
- ❌ Production configuration
- ❌ User data or sensitive information

### ALWAYS:
- ✅ Double-check staged files before committing
- ✅ Use `.env.example` for documentation
- ✅ Review diffs before pushing
- ✅ Keep dependencies updated
- ✅ Monitor repository for security alerts

## 🔍 Final Verification Commands

Run these commands to verify everything is correct:

```bash
# 1. Check what will be committed
git status

# 2. Verify .env is ignored
git check-ignore .env
# Should output: .env

# 3. Check for hardcoded secrets (basic check)
grep -r "api[_-]key.*=.*['\"][a-zA-Z0-9]" --include="*.ts" --include="*.js" server/ client/

# 4. List all tracked files
git ls-files

# 5. Verify no .env in tracked files
git ls-files | grep "\.env$"
# Should only show .env.example (if any)
```

## 📋 Post-Push Tasks

After successfully pushing to GitHub:

- [ ] Verify repository is accessible
- [ ] Check that `.env` is not visible in the repository
- [ ] Review the README on GitHub
- [ ] Test cloning the repository
- [ ] Set up CI/CD (optional)
- [ ] Add repository badges to README (optional)
- [ ] Create initial release/tag (optional)

## 🆘 Emergency: Secrets Exposed

If you accidentally commit secrets:

1. **Immediately rotate all exposed credentials**
2. **Remove from git history**:
   ```bash
   # Use BFG Repo-Cleaner or git filter-branch
   # See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
   ```
3. **Force push the cleaned history**
4. **Notify team members to re-clone**

## ✅ Ready to Push?

Before running `git push`, ensure:

- [x] All items in Security Verification are checked
- [x] All Required Files are present
- [x] Configuration is updated with your information
- [x] Pre-Commit Verification passed
- [ ] You've reviewed this entire checklist

---

**Remember:** Your `.env` file should NEVER be committed to GitHub. It contains sensitive credentials that must remain private.

For questions or issues, refer to [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md).