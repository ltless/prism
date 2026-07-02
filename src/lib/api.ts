// Auth token is kept in-memory by AuthProvider (see AuthContext.tsx) and is
// NOT persisted to localStorage. The HttpOnly `auth_token` cookie set by the
// Go backend is the source of truth and is sent automatically with every
// same-origin request via `credentials: "include"`.

let _inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  _inMemoryToken = token;
}
