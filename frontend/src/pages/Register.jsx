import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { getDashboardRouteForRole } from '../utils/auth';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('CUSTOMER'); // Default role
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const user = await register({ name, email, password, role });
      const targetRoute = getDashboardRouteForRole(user.role);
      navigate(targetRoute, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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
          title="Create an account" 
          subtitle="Join ReclaimLoop to manage your operations" 
        />
      <form onSubmit={handleRegister}>
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
            label="Full Name" 
            type="text" 
            placeholder="Jane Doe" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required 
            disabled={isLoading}
          />
          
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
            minLength={6}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
              Account Type
            </label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 var(--space-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)'
              }}
            >
              <option value="CUSTOMER">Customer</option>
              <option value="COURIER">Courier / Logistics Provider</option>
              <option value="INSPECTOR">Inspector / Facility Staff</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

        </CardContent>
        <CardFooter style={{ flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Button type="submit" style={{ width: '100%' }} isLoading={isLoading}>
            Create Account
          </Button>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)' }}>Sign in here</Link>
          </div>
        </CardFooter>
      </form>
      </Card>
    </>
  );
}
