"""Login rate limiting with slowapi (NFR-10, AD-33)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# At most 5 login attempts per minute. Failed and successful attempts both count.
# The counters are kept in memory. That is fine because the app runs as one server
# process (AD-15). A restart resets them.
LOGIN_LIMIT = "5/minute"

# Counts attempts per client IP. Behind a reverse proxy, uvicorn must be told to
# trust the proxy's forwarded headers. Otherwise all users look like one IP and share
# one counter (see the service README).
limiter = Limiter(key_func=get_remote_address)
