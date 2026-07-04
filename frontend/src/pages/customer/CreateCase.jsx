import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCase } from '../../services/customer';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ArrowLeft } from 'lucide-react';
import './CreateCase.css';

const initialForm = {
  requestType: 'REFUND',
  product: {
    name: '',
    sku: '',
    serialNumber: '',
    category: '',
    purchaseDate: '',
    orderId: ''
  },
  pickupAddress: {
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: ''
  },
  reason: '',
  description: ''
};

export function CreateCase() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState(initialForm);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const safeValue = value ?? '';
    
    if (name.startsWith('product.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        product: { ...prev.product, [field]: safeValue }
      }));
    } else if (name.startsWith('pickupAddress.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        pickupAddress: { ...prev.pickupAddress, [field]: safeValue }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: safeValue }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Clean up empty strings in product to undefined/null or leave as is if optional
      const dataToSubmit = { ...formData };
      if (!dataToSubmit.product.purchaseDate) delete dataToSubmit.product.purchaseDate;
      
      const payload = await createCase(dataToSubmit);
      
      // Backend may return it wrapped in 'case' or 'recoveryCase'
      const newCase = payload?.case || payload?.recoveryCase || payload;
      const caseId = newCase?._id;
      
      if (caseId) {
        navigate(`/customer/cases/${caseId}`, { replace: true });
      } else {
        // Fallback if we can't find ID
        navigate('/customer/cases', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create case');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-case-wrapper">
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Button variant="ghost" onClick={() => navigate('/customer/cases')} style={{ padding: 'var(--space-2)' }}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>Create New Case</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Submit a new request for refund, repair, exchange, or recycling.
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'var(--color-danger-bg)',
          color: 'var(--color-danger)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="create-case-section">
          <CardHeader title="Request Information" />
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>What kind of support do you need?</label>
              <div className="desktop-request-select">
                <select 
                  name="requestType" 
                  value={formData.requestType ?? 'REFUND'} 
                  onChange={handleChange}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-app)',
                    fontSize: 'var(--font-size-md)',
                    color: 'var(--color-text)',
                    width: '100%'
                  }}
                >
                  <option value="REFUND">Refund</option>
                  <option value="REPAIR">Repair</option>
                  <option value="EXCHANGE">Exchange</option>
                  <option value="RECYCLE">Recycle</option>
                </select>
              </div>

              <div className="mobile-request-cards">
                {[
                  { value: 'REFUND', title: 'Refund', desc: 'Request money back after inspection' },
                  { value: 'REPAIR', title: 'Repair', desc: 'Send item for repair assessment' },
                  { value: 'EXCHANGE', title: 'Exchange', desc: 'Request a replacement item' },
                  { value: 'RECYCLE', title: 'Recycle', desc: 'Send item for responsible disposal' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`request-card ${(formData.requestType ?? 'REFUND') === opt.value ? 'selected' : ''}`}
                    onClick={() => handleChange({ target: { name: 'requestType', value: opt.value } })}
                  >
                    <span className="request-card-title">{opt.title}</span>
                    <span className="request-card-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="create-case-section">
          <CardHeader title="Product Information" />
          <CardContent className="product-details-grid">
            <Input 
              label="Product Name" 
              name="product.name" 
              value={formData.product.name ?? ''} 
              onChange={handleChange} 
              required 
            />
            <Input 
              label="Category" 
              name="product.category" 
              value={formData.product.category ?? ''} 
              onChange={handleChange} 
            />
            <Input 
              label="SKU (Optional)" 
              name="product.sku" 
              value={formData.product.sku ?? ''} 
              onChange={handleChange} 
            />
            <Input 
              label="Serial Number (Optional)" 
              name="product.serialNumber" 
              value={formData.product.serialNumber ?? ''} 
              onChange={handleChange} 
            />
          </CardContent>
        </Card>

        <Card className="create-case-section">
          <CardHeader title="Purchase Information" />
          <CardContent className="product-details-grid">
            <Input 
              label="Order ID (Optional)" 
              name="product.orderId" 
              value={formData.product.orderId ?? ''} 
              onChange={handleChange} 
            />
            <Input 
              type="date"
              label="Purchase Date (Optional)" 
              name="product.purchaseDate" 
              value={formData.product.purchaseDate ?? ''} 
              onChange={handleChange} 
            />
          </CardContent>
        </Card>

        <Card className="create-case-section">
          <CardHeader title="Pickup Address" />
          <CardContent className="single-column-grid">
            <Input 
              label="Address Line 1" 
              name="pickupAddress.line1" 
              value={formData.pickupAddress.line1 ?? ''} 
              onChange={handleChange} 
              placeholder="House, Flat, Building, Street"
              required 
            />
            <Input 
              label="Address Line 2 (Optional)" 
              name="pickupAddress.line2" 
              value={formData.pickupAddress.line2 ?? ''} 
              onChange={handleChange} 
              placeholder="Locality, Area, Landmark"
            />
            <div className="address-details-grid">
              <Input 
                label="City" 
                name="pickupAddress.city" 
                value={formData.pickupAddress.city ?? ''} 
                onChange={handleChange} 
                required 
              />
              <Input 
                label="State" 
                name="pickupAddress.state" 
                value={formData.pickupAddress.state ?? ''} 
                onChange={handleChange} 
                required 
              />
              <Input 
                label="Pincode" 
                name="pickupAddress.pincode" 
                value={formData.pickupAddress.pincode ?? ''} 
                onChange={handleChange} 
                required 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="create-case-section">
          <CardHeader title="Issue Details" />
          <CardContent className="mobile-spaced-flex">
            <Input 
              label="Reason for Request" 
              name="reason" 
              value={formData.reason ?? ''} 
              onChange={handleChange} 
              placeholder="e.g. Defective item, changed my mind..."
              required 
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Additional Description</label>
              <textarea 
                name="description" 
                value={formData.description ?? ''} 
                onChange={handleChange}
                rows={4}
                placeholder="Please provide any additional details that might help us process your request."
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-app)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text)',
                  resize: 'vertical'
                }}
              />
            </div>
          </CardContent>
          <CardFooter style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <Button type="button" variant="ghost" onClick={() => navigate('/customer/cases')} style={{ marginRight: 'var(--space-2)' }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Submit Case
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
