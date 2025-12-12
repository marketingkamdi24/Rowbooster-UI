# rowbooster Platform Documentation

## Overview

rowbooster is an advanced AI-powered system designed for comprehensive tabular data extraction and intelligent data retrieval. The platform enables businesses to automatically gather, analyze, and standardize data from multiple sources using cutting-edge artificial intelligence, transforming unstructured content into organized, structured tables.

## Key Features

### 🔍 Intelligent Search Capabilities
- **Google Search**: Google search integration via ValueSERP
- **ValueSERP Integration**: Professional search API for enhanced results
- **Domain Prioritization**: Prioritize manufacturer websites for authoritative data
- **Domain Filtering**: Exclude unreliable sources from search results

### 🤖 AI-Powered Analysis
- **OpenAI Integration**: GPT-4.1 models for intelligent content analysis
- **Perplexity AI Support**: Advanced AI-powered search and data extraction
- **Confidence Scoring**: AI-powered confidence ratings for extracted data

### 📊 Multiple Search Methods
1. **Auto Search**: Automated web search with AI analysis
2. **URL Search**: Direct product page analysis
3. **PDF Analysis**: Extract specifications from product datasheets

### 🏢 Enterprise Features
- **User Management**: Role-based access control (Admin/User)
- **Session Management**: Secure authentication system
- **Token Monitoring**: Track AI API usage and costs
- **Export Capabilities**: Export results to Excel or CSV formats

## Architecture

### Technology Stack
- **Frontend**: React 18 with TypeScript
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Drizzle ORM
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state
- **Authentication**: Session-based authentication with secure cookies

### System Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client  │────│  Express Server  │────│   PostgreSQL    │
│                 │    │                  │    │    Database     │
│ - Search UI     │    │ - API Routes     │    │ - Users         │
│ - Results View  │    │ - Auth Logic     │    │ - Properties    │
│ - Settings      │    │ - Search Service │    │ - Results       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                │
                    ┌──────────────────────┐
                    │   External Services  │
                    │                      │
                    │ - OpenAI API         │
                    │ - ValueSERP API      │
                    │ - Search Engines     │
                    └──────────────────────┘
```

## User Guide

### Getting Started

#### 1. Login
- Access the platform with your credentials
- Admin users have additional privileges for system management
- Regular users can perform searches and access settings

#### 2. Define Product Properties
Before searching, configure the properties you want to extract:
- Navigate to the Properties section
- Add custom properties with descriptions
- Define expected formats for better AI extraction
- Set priority order for properties

#### 3. Perform Product Search

**Auto Search Method:**
1. Enter article number and product name
2. Click "Start Search"
3. System automatically searches Google via ValueSERP and analyzes with OpenAI

**Domain Search Method:**
1. Enter product details
2. Specify manufacturer domain
3. Enable domain prioritization for better results

**URL Search Method:**
1. Provide direct product page URL
2. System extracts data from specific page
3. Ideal for known product pages

**PDF Analysis Method:**
1. Upload product datasheet or manual
2. AI extracts technical specifications
3. Processes both text and structured data

### Advanced Features

#### Domain Management
- **Manufacturer Domains**: Add trusted manufacturer websites for prioritized search results
- **Excluded Domains**: Block unreliable or irrelevant domains from results
- **Domain Prioritization**: Toggle to prefer manufacturer sources

#### API Configuration
Configure external services in Settings:
- **OpenAI API Key**: For GPT model access
- **ValueSERP API Key**: For professional search results
- **Search Location**: Configure geographic search preferences

#### Export Options
- **Excel Export**: Comprehensive data with formatting
- **CSV Export**: Simple tabular data export
- **Include Sources**: Add source URLs to exports
- **Confidence Scores**: Include AI confidence ratings

## Administration Guide

### User Management (Admin Only)
- Create and manage user accounts
- Assign user roles (Admin/User)
- Monitor user activity
- Control access permissions

### System Configuration
- **API Settings**: Configure external service credentials
- **Default Models**: Set system-wide AI model preferences
- **Search Defaults**: Configure default search engines and methods
- **Token Monitoring**: Track API usage and costs

### Security Features
- **Session Management**: Secure user sessions with automatic timeout
- **Rate Limiting**: Prevent API abuse
- **Role-Based Access**: Granular permission control
- **Audit Logging**: Track user actions and system events

## Technical Specifications

### Database Schema

#### Core Tables
- **users**: User accounts and authentication
- **sessions**: Secure session management
- **product_properties**: Configurable extraction properties
- **search_results**: Stored search results and data
- **manufacturer_domains**: Trusted manufacturer websites
- **excluded_domains**: Blocked domains list
- **app_settings**: System configuration
- **token_usage**: API usage tracking

#### Key Features
- **ACID Compliance**: Reliable data transactions
- **Foreign Key Constraints**: Data integrity enforcement
- **Indexing**: Optimized query performance
- **Timestamp Tracking**: Audit trail capabilities

### API Endpoints

#### Authentication
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/me` - Current user information

#### Search Operations
- `POST /api/search` - Perform product search
- `GET /api/search-results` - Retrieve search history
- `DELETE /api/search-results/:id` - Remove search result

#### Configuration
- `GET /api/properties` - Retrieve property definitions
- `POST /api/properties` - Create new property
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Remove property

#### Administration
- `GET /api/users` - User management (Admin)
- `POST /api/users` - Create user (Admin)
- `PUT /api/users/:id` - Update user (Admin)
- `DELETE /api/users/:id` - Remove user (Admin)

### Security Implementation

#### Authentication
- **Password Hashing**: bcrypt with salt rounds
- **Session Tokens**: Secure random token generation
- **Session Expiry**: Automatic timeout for security
- **CSRF Protection**: Cross-site request forgery prevention

#### Data Protection
- **Input Validation**: Zod schema validation
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content sanitization
- **Secure Headers**: Security-focused HTTP headers

## Troubleshooting

### Common Issues

#### Search Problems
**No Results Found:**
- Verify article number and product name accuracy
- Check if manufacturer domain is configured
- Ensure API keys are properly configured
- Try different search engines

**Low Confidence Scores:**
- Improve property descriptions for better AI understanding
- Use more specific search terms
- Verify source website quality
- Consider manual URL search for specific products

#### API Issues
**Authentication Errors:**
- Verify API keys in Settings
- Check API key permissions and quotas
- Ensure network connectivity
- Validate API key format

**Rate Limiting:**
- Monitor token usage dashboard
- Implement search batching
- Consider API tier upgrades
- Optimize search frequency

#### Performance Issues
**Slow Search Results:**
- Reduce number of simultaneous searches
- Optimize property definitions
- Use domain prioritization
- Check server resources

### Error Codes

- **401 Unauthorized**: Invalid credentials or expired session
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not available
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side issue

## Best Practices

### Search Optimization
1. **Property Definition**: Create clear, specific property descriptions
2. **Domain Configuration**: Add manufacturer domains for better results
3. **Search Terms**: Use precise article numbers and product names
4. **Result Validation**: Review confidence scores and sources

### System Maintenance
1. **Regular Updates**: Keep API keys current and valid
2. **Monitor Usage**: Track token consumption and costs
3. **Clean Data**: Remove obsolete search results
4. **Backup Configuration**: Export settings for disaster recovery

### Performance Tuning
1. **Batch Processing**: Group similar searches together
2. **Cache Results**: Avoid duplicate searches
3. **Optimize Queries**: Use specific search parameters
4. **Monitor Resources**: Track system resource usage

## Support and Updates

### Getting Help
- Check this documentation for common solutions
- Review system logs for error details
- Contact system administrator for access issues
- Report bugs through proper channels

### System Updates
- Regular security patches
- Feature enhancements
- Performance improvements
- Bug fixes and stability improvements

### Version History
- **v1.0**: Initial release with core functionality
- **v1.1**: Enhanced AI integration and search capabilities
- **v1.2**: User management and security improvements
- **v1.3**: Token monitoring and export features

---

*This documentation is regularly updated to reflect the latest platform capabilities and features.*