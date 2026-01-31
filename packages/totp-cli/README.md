# @openclaw/totp

Standalone TOTP (Time-based One-Time Password) CLI tool. Generate secrets, validate codes, and create authenticator URIs.

## Installation

```bash
npm install -g @openclaw/totp
```

Or run directly with npx:
```bash
npx @openclaw/totp validate <secret> <code>
```

## Usage

### Generate a new TOTP secret

```bash
totp generate [account] [issuer]
```

Example:
```bash
totp generate user@example.com MyApp
```

Output:
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "account": "user@example.com",
  "issuer": "MyApp",
  "uri": "otpauth://totp/MyApp:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=MyApp"
}
```

### Validate a TOTP code

```bash
totp validate <secret> <code>
```

Example:
```bash
totp validate JBSWY3DPEHPK3PXP 123456
# Output: VALID (exit code 0) or INVALID (exit code 1)
```

Exit codes:
- `0` - Valid code
- `1` - Invalid code
- `2` - Error (invalid secret, etc.)

### Generate otpauth:// URI

```bash
totp uri <secret> <account> [issuer]
```

Example:
```bash
totp uri JBSWY3DPEHPK3PXP user@example.com MyApp
# Output: otpauth://totp/MyApp:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=MyApp
```

### Get current valid code

```bash
totp current <secret>
```

Example:
```bash
totp current JBSWY3DPEHPK3PXP
# Output: 123456
```

## Use in shell scripts

```bash
#!/bin/bash

# Generate a new secret
SECRET_JSON=$(totp generate admin@myapp.com MyApp)
SECRET=$(echo "$SECRET_JSON" | jq -r '.secret')

# Validate a code
if totp validate "$SECRET" "$USER_CODE"; then
  echo "Access granted"
else
  echo "Access denied"
  exit 1
fi

# Get current code for testing
CURRENT=$(totp current "$SECRET")
echo "Current code: $CURRENT"
```

## Spec compliance

- Implements [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238) (TOTP)
- Uses SHA1, 6 digits, 30-second period (standard)
- Compatible with Google Authenticator, Authy, 1Password, etc.

## Security notes

- Secrets are 160-bit (20 bytes) random values
- Base32-encoded for compatibility
- ±30s time window for validation (1 period tolerance)
- Never log or store secrets in plain text
- Use secure channels (HTTPS, SSH) when transmitting secrets

## License

MIT
