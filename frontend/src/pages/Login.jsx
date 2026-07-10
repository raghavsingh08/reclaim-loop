import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { getDashboardRouteForRole } from '../utils/auth';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const user = await login({ email, password });
      const targetRoute = getDashboardRouteForRole(user.role);
      navigate(targetRoute, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)' }}>
        <ThemeToggle />
      </div>
      <Card style={{ width: '100%', maxWidth: '380px', margin: '0 auto' }}>
        <CardHeader 
          title="Welcome back" 
          subtitle="Sign in to ReclaimLoop to continue" 
        />
      <form onSubmit={handleLogin}>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {error && (
            <div style={{
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)'
            }}>
              {error}
            </div>
          )}
          
          <Input 
            label="Email" 
            type="email" 
            placeholder="name@company.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            disabled={isLoading}
          />
          <Input 
            label="Password" 
            type={showPassword ? "text" : "password"} 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            disabled={isLoading}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 'var(--space-1)',
                  cursor: 'pointer',
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
        </CardContent>
        <CardFooter style={{ flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Button type="submit" style={{ width: '100%' }} isLoading={isLoading}>
            Sign In
          </Button>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)' }}>Register here</Link>
          </div>
        </CardFooter>
      </form>
      </Card>
    </>
  );
}
