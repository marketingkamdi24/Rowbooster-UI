# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Rowbooster seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Reporting Process

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

1. **Email**: Send details to [security@yourdomain.com] (replace with your actual security contact)
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature

### What to Include

Please include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Varies based on severity and complexity

## Security Best Practices

### For Users

#### Environment Variables

**CRITICAL**: Never commit `.env` files or expose API keys

- Always use `.env` for sensitive configuration
- Never commit `.env` to version control
- Use `.env.example` as a template only
- Rotate API keys if accidentally exposed

#### API Keys Management

- Store API keys in environment variables only
- Never hardcode API keys in source code
- Use separate API keys for development and production
- Regularly rotate API keys
- Monitor API usage for unusual activity

#### Database Security

- Use strong passwords for database connections
- Keep database credentials in `.env` file only
- Use separate databases for development and production
- Regularly update PostgreSQL to latest stable version
- Enable SSL/TLS for database connections in production

#### Session Security

- Configure secure session cookies in production
- Set appropriate session timeout values
- Use HTTPS in production environments
- Implement proper session invalidation on logout

### For Developers

#### Code Security

1. **Input Validation**
   - Validate all user inputs
   - Use Zod schemas for type validation
   - Sanitize inputs before database operations

2. **SQL Injection Prevention**
   - Always use parameterized queries
   - Use Drizzle ORM for database operations
   - Never construct SQL queries with string concatenation

3. **XSS Prevention**
   - Sanitize user-generated content
   - Use React's built-in XSS protection
   - Validate and escape data before rendering

4. **Authentication**
   - Use bcrypt for password hashing
   - Implement proper session management
   - Enforce strong password policies
   - Add rate limiting to login endpoints

5. **Dependencies**
   - Regularly update dependencies
   - Run `npm audit` to check for vulnerabilities
   - Review security advisories for dependencies
   - Use `npm audit fix` to automatically fix issues

#### Secure Development Practices

```bash
# Check for security vulnerabilities
npm audit

# Fix automatically fixable vulnerabilities
npm audit fix

# Review high/critical vulnerabilities
npm audit --production
```

### Known Security Considerations

#### API Rate Limiting

The application relies on external APIs that may have rate limits:
- Implement appropriate rate limiting
- Cache results when possible
- Monitor API usage to prevent quota exhaustion

#### Web Scraping

When scraping websites:
- Respect robots.txt files
- Implement reasonable delays between requests
- Handle errors gracefully
- Be aware of legal implications

#### File Uploads

For PDF analysis features:
- Validate file types and sizes
- Scan uploaded files for malware (recommended)
- Store uploads in isolated directory
- Implement upload size limits

## Security Features

### Current Implementation

- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: Secure cookies with HTTP-only flag
- **SQL Injection Protection**: Parameterized queries via Drizzle ORM
- **Input Validation**: Zod schema validation
- **Environment Isolation**: Separate dev/prod configurations

### Recommended Production Additions

- **HTTPS/TLS**: Enable SSL/TLS certificates
- **Rate Limiting**: Implement API rate limiting
- **CORS Configuration**: Properly configure CORS policies
- **Helmet.js**: Add security headers
- **Content Security Policy**: Implement CSP headers
- **Firewall**: Configure application firewall rules

## Common Vulnerabilities

### Preventing Common Issues

1. **API Key Exposure**
   - ✅ Store in environment variables
   - ✅ Use `.env` files (gitignored)
   - ❌ Never commit to git
   - ❌ Never log API keys
   - ❌ Never send in client-side code

2. **SQL Injection**
   - ✅ Use Drizzle ORM with parameterized queries
   - ✅ Validate all inputs with Zod
   - ❌ Never use raw SQL with string concatenation
   - ❌ Never trust user input directly

3. **XSS Attacks**
   - ✅ Use React's JSX (auto-escaping)
   - ✅ Sanitize user-generated content
   - ✅ Validate inputs before rendering
   - ❌ Never use `dangerouslySetInnerHTML` without sanitization

4. **Session Hijacking**
   - ✅ Use secure, HTTP-only cookies
   - ✅ Implement session timeout
   - ✅ Use HTTPS in production
   - ❌ Never transmit session tokens in URLs

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find similar problems
3. Prepare fixes for all supported versions
4. Release patches as soon as possible

## Security Updates

Security updates will be released as:

- **Critical**: Immediate patch release
- **High**: Patch within 7 days
- **Medium**: Included in next regular release
- **Low**: Included in next regular release or documented

## Additional Resources

- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [React Security Best Practices](https://reactjs.org/docs/security.html)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

## Contact

For security concerns, please contact:
- **Email**: [security@yourdomain.com] (replace with actual contact)
- **GitHub**: Use private vulnerability reporting

---

**Thank you for helping keep Rowbooster and its users safe!**