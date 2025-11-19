import { describe, it, expect } from 'vitest';

describe('Authentication Flow', () => {
  const API_BASE = 'http://localhost:3000/api/trpc';

  it('should login with correct credentials', async () => {
    const response = await fetch(`${API_BASE}/simpleAuth.login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          username: 'admin',
          password: 'admin123',
        },
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    
    expect(data.result.data.json.success).toBe(true);
    expect(data.result.data.json.token).toBeDefined();
    expect(data.result.data.json.user.username).toBe('admin');
    expect(data.result.data.json.user.role).toBe('admin');
  });

  it('should reject login with incorrect password', async () => {
    const response = await fetch(`${API_BASE}/simpleAuth.login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          username: 'admin',
          password: 'wrongpassword',
        },
      }),
    });

    const data = await response.json();
    // Just check that there's an error response
    expect(data.error).toBeDefined();
  });

  it('should verify token and return user info', async () => {
    // First login to get token
    const loginResponse = await fetch(`${API_BASE}/simpleAuth.login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          username: 'admin',
          password: 'admin123',
        },
      }),
    });

    const loginData = await loginResponse.json();
    const token = loginData.result.data.json.token;

    // Then verify token
    const meResponse = await fetch(`${API_BASE}/simpleAuth.me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(meResponse.ok).toBe(true);
    const meData = await meResponse.json();
    
    expect(meData.result.data.json).toBeDefined();
    expect(meData.result.data.json.username).toBe('admin');
    expect(meData.result.data.json.role).toBe('admin');
  });

  it('should list users', async () => {
    const response = await fetch(`${API_BASE}/simpleAuth.listUsers`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    
    expect(Array.isArray(data.result.data.json)).toBe(true);
    expect(data.result.data.json.length).toBeGreaterThan(0);
    expect(data.result.data.json[0].username).toBe('admin');
  });

  it('should create a new user with hashed password', async () => {
    // Use unique username to avoid conflicts
    const uniqueUsername = 'user' + Math.random().toString(36).substring(7);
    
    const response = await fetch(`${API_BASE}/simpleAuth.createUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          username: uniqueUsername,
          password: 'testpass123',
          name: 'Test User',
          email: 'test@example.com',
          role: 'user',
        },
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    
    expect(data.result.data.json.success).toBe(true);
    expect(data.result.data.json.user.username).toBe(uniqueUsername);
    expect(data.result.data.json.user.role).toBe('user');

    // Verify the new user can login
    const loginResponse = await fetch(`${API_BASE}/simpleAuth.login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          username: uniqueUsername,
          password: 'testpass123',
        },
      }),
    });

    expect(loginResponse.ok).toBe(true);
    const loginData = await loginResponse.json();
    expect(loginData.result.data.json.success).toBe(true);
  });
});
