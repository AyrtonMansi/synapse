# Synapse Developer Portal

Interactive developer portal for the Synapse AI platform.

## Features

- **Interactive API Explorer** - Try endpoints directly from the browser
- **Code Generator** - Generate code snippets in multiple languages
- **Webhook Tester** - Test webhook endpoints with simulated events
- **SDK Documentation** - Comprehensive guides and examples

## Quick Start

Open `index.html` in your browser or serve it with a static file server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8080
```

Then open http://localhost:8080 in your browser.

## Structure

```
developer-portal/
├── index.html      # Main portal page
├── styles.css      # Dark theme styling
├── app.js          # Interactive functionality
└── README.md       # This file
```

## Components

### API Explorer
Powered by Swagger UI for interactive API documentation and testing.

### Code Generator
Supports multiple languages:
- JavaScript/TypeScript
- Python
- cURL
- Go
- Rust

### Webhook Tester
Test your webhook endpoints with:
- Event type selection
- Custom payload editing
- Request logging
- Signature verification

### Documentation
- Quick start guide
- Authentication
- Rate limits
- Streaming
- Function calling
- Batch processing

## Customization

Edit `openApiSpec` in `app.js` to update the API documentation.

## License

MIT