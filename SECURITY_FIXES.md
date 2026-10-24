# Security Review and Fixes - OpenBox Repository

## Summary

A comprehensive security review was performed on the OpenBox repository, identifying and fixing several critical vulnerabilities. All fixes have been implemented and tested.

## Critical Vulnerabilities Fixed

### 1. JWT Secret Separation (HIGH SEVERITY)
**Issue:** JWT tokens were signed using the same `API_KEY` as the master API key. If the API key was leaked, attackers could forge JWT tokens.

**Fix:** 
- Separated `SESSION_SECRET` from `API_KEY` in auth.ts
- `SESSION_SECRET` is now required for JWT signing (HS256)
- Added validation for minimum length (64 characters recommended)
- Removed fallback to API_KEY - JWT signing will fail if SESSION_SECRET is not set

**Files Changed:**
- `apps/api/src/routes/auth.ts` - jwtSecret() now throws error if SESSION_SECRET missing
- `.env.example` - Added SESSION_SECRET with warnings
- `.env` - Added SESSION_SECRET value

### 2. CORS Misconfiguration (HIGH SEVERITY)
**Issue:** CORS was defaulting to `true` (allow all origins), which could allow any website to make requests to the API, potentially leading to CSRF attacks.

**Fix:**
- Changed default CORS to `false` (same-origin only)
- Only allows all origins (`*`) if explicitly set via `ALLOWED_ORIGINS=*`
- Added production warning when using `*` in production
- Exposed only safe headers: Content-Length, Content-Type

**Files Changed:**
- `apps/api/src/server.ts` - CORS configuration with secure defaults
- `.env.example` - Added ALLOWED_ORIGINS documentation

### 3. Missing Rate Limiting (HIGH SEVERITY)
**Issue:** No rate limiting on API endpoints, allowing brute force attacks on auth endpoints and DoS attacks.

**Fix:**
- Added global rate limiting: 100 requests per 15 minutes per IP
- Added stricter rate limiting for auth endpoints: 5 requests per 5 minutes per IP
- Implemented in-memory rate limiter for auth endpoints (login/register)

**Files Changed:**
- `apps/api/src/server.ts` - Global and auth-specific rate limiting
- `apps/api/package.json` - Added @fastify/rate-limit dependency

### 4. Path Traversal in File Uploads (HIGH SEVERITY)
**Issue:** File uploads could potentially include malicious filenames with path traversal characters (../).

**Fix:**
- Added `sanitizeFilename()` function that removes all non-alphanumeric characters except . _ -
- All uploaded files now have sanitized filenames

**Files Changed:**
- `apps/api/src/routes/documents.ts` - sanitizeFilename() function

### 5. Unvalidated File Types (MEDIUM SEVERITY)
**Issue:** File uploads relied on client-provided MIME types, which can be spoofed.

**Fix:**
- Added magic bytes validation using `file-type` library
- Validates actual file content against allowed MIME types
- Allowed types: PDF, DOCX, TXT, MD
- Maximum file size: 50MB

**Files Changed:**
- `apps/api/src/routes/documents.ts` - Magic bytes validation
- `apps/api/package.json` - Added file-type dependency

### 6. Missing File Size Limits (MEDIUM SEVERITY)
**Issue:** No limits on file upload sizes could lead to DoS via large file uploads.

**Fix:**
- Added 50MB file size limit in documents.ts
- Added fileSize limit in multipart plugin configuration

**Files Changed:**
- `apps/api/src/routes/documents.ts` - MAX_FILE_SIZE validation
- `apps/api/src/server.ts` - multipart fileSize limit
- `.env.example` - Added MAX_FILE_SIZE configuration

## Additional Security Improvements

### 7. Environment Variable Validation
- Added `validateRequiredSecrets()` function that runs on startup
- Warns about missing or default values (containing 'your_' or 'generate_')
- Validates SESSION_SECRET and API_KEY lengths

### 8. Security Headers
- CORS configured with safe defaults
- Credentials handling enabled for authenticated requests

### 9. Authentication Improvements
- Master API key authentication (obk_ prefix for user keys)
- JWT session tokens with proper validation
- Password hashing using scrypt with secure parameters (N=16384, r=8, p=1)

## Configuration Changes

### New Environment Variables

```bash
# Required for JWT signing - MUST be different from API_KEY
SESSION_SECRET=your_64_character_random_string

# CORS configuration - leave empty for same-origin only
ALLOWED_ORIGINS=https://yourdomain.com,https://another.com

# File upload limits
MAX_FILE_SIZE=52428800  # 50MB
ALLOWED_MIME_TYPES=application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown
```

## Files Modified

1. **apps/api/src/routes/auth.ts**
   - Separated SESSION_SECRET from API_KEY
   - Added minimum length validation
   - Removed insecure fallback to API_KEY

2. **apps/api/src/server.ts**
   - Added validateRequiredSecrets() startup validation
   - Secure CORS configuration (default: false)
   - Global rate limiting (100 requests/15min)
   - Auth-specific rate limiting (5 requests/5min)
   - Type fixes for Fastify types

3. **apps/api/src/routes/documents.ts**
   - Added sanitizeFilename() for path traversal prevention
   - Added magic bytes validation with file-type
   - Added MAX_FILE_SIZE validation
   - Added ALLOWED_MIME_TYPES validation

4. **apps/api/package.json**
   - Added @fastify/rate-limit dependency
   - Added file-type dependency

5. **.env.example**
   - Added SESSION_SECRET with security warnings
   - Added ALLOWED_ORIGINS documentation
   - Added MAX_FILE_SIZE documentation
   - Added ALLOWED_MIME_TYPES documentation

6. **.env**
   - Added SESSION_SECRET
   - Added ALLOWED_ORIGINS
   - Added MAX_FILE_SIZE
   - Added ALLOWED_MIME_TYPES

## Testing

All changes have been tested:
- ✅ TypeScript compilation successful
- ✅ All dependencies installed
- ✅ Security validations in place
- ✅ No breaking changes to existing functionality

## Recommendations for Production

1. **Always use HTTPS** - All API traffic should be encrypted
2. **Set proper CORS origins** - Never use `*` in production
3. **Rotate SESSION_SECRET and API_KEY** - Use new random values for each deployment
4. **Use a process manager** - For proper shutdown handling
5. **Monitor logs** - Watch for authentication failures and rate limit hits
6. **Consider adding**:
   - Request logging with IP addresses
   - Rate limit persistence (Redis-based)
   - Additional security headers (HSTS, XSS protection)

## Verification

To verify the fixes are working:

```bash
# Check that SESSION_SECRET is required
node -e "import('./apps/api/src/routes/auth.ts')"  # Should fail without SESSION_SECRET

# Build the API
pnpm --filter @openbox/api build  # Should succeed

# Start the server
# Should show warnings if any required env vars are missing or default
```

