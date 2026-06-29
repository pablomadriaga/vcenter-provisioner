# vCenter Provisioner UI - Version 1.1.0

**Updated with Typification System Integration**

## Overview

Modern, clean React-based user interface for vCenter Provisioner. This UI focuses on simplicity and maintainability, avoiding the focus loss issues of previous implementations.

## Key Features

### User Management
- Secure login with JWT authentication
- Session management with token storage
- Automatic redirect to login on token expiry

### Typification System
**NEW in v1.1.0** - Complete integration with the typification naming system

#### Typifications Page (`/typifications`)
- Create new typifications for VM naming
- Edit existing typifications (creates new version, marks old as orphaned)
- List all active typifications
- Real-time preview of naming patterns
- Alphanumeric validation for all fields

**Typification Structure:**
```
{prefijo1}-{prefijo2}-{manual_value}-{sequence}
```

**Configuration Options:**
- **Prefijo 1**: First prefix (alphanumeric only, max 50 chars)
- **Prefijo 2**: Second prefix (alphanumeric only, max 50 chars)
- **Sequence Digits**: 1, 2, 3, or 4 digits for auto-increment
- **Name**: Descriptive name for the typification

**Orphaned VMs:**
- VMs created with edited typifications are marked as "orphaned"
- They remain functional and visible in statistics
- A special tag/label identifies them as using an orphaned typification
- This preserves history while enabling new naming conventions

### Dashboard (`/dashboard`)

#### VM Creation with Typifications
**NEW in v1.1.0** - Streamlined VM creation process

1. **Select Typification**: Choose from available typifications
   - Shows naming pattern preview
   - Displays sequence digit count

2. **Enter Manual Value**: Provide the third segment (alphanumeric only)
   - Real-time validation
   - Live VM name preview

3. **VM Configuration**:
   - Description
   - Template selection (CPU, Memory, Disk)
   - vCenter infrastructure details

4. **VM Name Preview**: Shows the complete VM name before creation
   - Example: `SRV-WEB-proj1-001`

**Removed:**
- Manual VM name input (now auto-generated)

**Added:**
- Typification selection dropdown
- Manual value input field
- Real-time VM name preview

### Technical Stack

- **React 18.2.0**: UI library with hooks
- **React Router 6.20.0**: Client-side routing
- **TypeScript 5.7.2**: Type safety
- **Vite 6.0.5**: Build tool and dev server
- **Nginx 1.25.3**: Production web server

### Architecture Principles

**Why This Implementation Works:**

1. **Simple, Flat Component Structure:**
   - No complex component hierarchy
   - No nested callbacks or memoization issues
   - Direct state management with useState

2. **Standard React Patterns:**
   - Inline event handlers
   - Controlled components with direct onChange
   - No React.memo unless absolutely necessary
   - No useCallback unless absolutely necessary

3. **Minimal Dependencies:**
   - No Material UI
   - No Framer Motion
   - Plain CSS for styling
   - Only React, React Router, and basic browser APIs

4. **Clean Code:**
   - Clear separation of concerns
   - Self-contained components
   - Type-safe with TypeScript
   - No over-engineering

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## API Integration

### Authentication
```
POST /auth/login
```

### Typifications
```
GET  /typing/templates              # List all active typifications
POST /typing/templates              # Create new typification
PUT  /typing/templates/{id}        # Update typification (creates new version)
POST /typing/generate-name/{id}   # Preview VM name with manual value
```

### VM Provisioning
```
POST /provision/provision            # Create new VM with typification
GET  /provision/status/{id}         # Check VM provision status
```

## Accessing the UI

### Development
```
http://localhost:5173
```

### Production (Docker)
```
http://localhost:5173
```

## Default Credentials

- **Username**: admin
- **Password**: password123

## Docker Deployment

### Build Image
```bash
docker build -t antigravity/provisioner-ui:1.1.0 .
```

### Run Container
```bash
docker run -p 5173:80 antigravity/provisioner-ui:1.1.0
```

### Docker Compose
```yaml
provisioner-ui:
  build:
    context: ../../apps/provisioner-ui
    args:
      VERSION: 1.1.0
  image: antigravity/provisioner-ui:1.1.0
  container_name: provisioner-ui
  ports:
    - "5173:80"
  environment:
    - VITE_API_URL=http://localhost:3000
```

## Focus Behavior

### Solved Issues

**Previous UI (v0.1.3 - v0.1.6):**
- Complex component hierarchy with nested callbacks
- Excessive use of React.memo and useCallback
- Re-creation of components on every render
- Stepper wizard pattern with dynamic content
- Focus loss on every keystroke

**Current UI (v1.0.0 - v1.1.0):**
- Simple, flat component structure
- Standard React patterns with inline handlers
- Direct state updates without intermediate steps
- Clean form layout without complex state management
- **Focus maintained on ALL input fields**

### Testing Focus Behavior

1. **Login Page**: Type username and password character by character
2. **Typifications - Name Field**: Type typification name (maintains focus)
3. **Typifications - Prefijo 1**: Type first prefix (maintains focus)
4. **Typifications - Prefijo 2**: Type second prefix (maintains focus)
5. **Dashboard - Manual Value**: Type manual value (maintains focus)
6. **Dashboard - Description**: Type description (maintains focus)
7. **Dashboard - Numeric Fields**: Type CPU, Memory, Disk (maintains focus)

**Expected Behavior:**
- Focus remains in each field while typing
- No clicking or extra taps needed
- Smooth, responsive user experience

## Troubleshooting

### UI Not Accessible
```bash
# Check container status
docker ps --filter "name=provisioner-ui"

# Check container logs
docker logs provisioner-ui

# Verify UI is serving
curl http://localhost:5173
```

### Focus Issues
If you experience focus issues:

1. **Clear browser cache** and reload the page
2. **Disable browser extensions** that might interfere
3. **Try a different browser** (Chrome, Firefox, Edge)
4. **Check browser console** for JavaScript errors

### API Connection Issues
```bash
# Check API Gateway
curl http://localhost:3000/health

# Check Typing Service
curl http://localhost:8000/health

# Check Orchestrator
curl http://localhost:8080/health
```

## Related Documentation

- [Typifications System Documentation](./docs/TYPIFICATIONS.md)
- [API Gateway Documentation](../apps/api-gateway/README.md)
- [Typing Service Documentation](../apps/typing-service/README.md)
- [VM Orchestrator Documentation](../apps/vm-orchestrator/README.md)

## Version History

### v1.1.0 (2026-02-02)
- **NEW**: Complete typification system integration
- **NEW**: Typifications management page
- **NEW**: Typification-based VM naming
- **NEW**: VM name preview functionality
- **NEW**: Orphaned VM tracking
- **UPDATED**: Dashboard with typification workflow
- **REMOVED**: Manual VM name input (now auto-generated)

### v1.0.0 (2026-02-02)
- Initial clean implementation
- Simple architecture without focus issues
- Basic VM creation form
- Login functionality
- Plain CSS styling

---

**© 2026 Antigravity Engineering | vCenter Provisioner UI**
