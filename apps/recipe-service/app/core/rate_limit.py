"""Login rate limiting with slowapi (NFR-10, AD-33)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Failed and successful attempts both count. The counters live in memory, which is
# fine for the single container (AD-15) and means a restart clears them.
LOGIN_LIMIT = "5/minute"

# Keyed by the client IP. Behind a reverse proxy uvicorn must be told to trust its
# forwarded headers, or every user shares one bucket (see the service README).
limiter = Limiter(key_func=get_remote_address)
