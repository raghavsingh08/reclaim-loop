import React from 'react';
import { 
  CheckCircle, 
  Clock, 
  Truck, 
  Package, 
  MapPin, 
  ClipboardList, 
  Wrench, 
  DollarSign, 
  XCircle 
} from 'lucide-react';
import './StatusBadge.css';

const STATUS_CONFIG = {
  CREATED: {
    label: 'Created',
    color: 'info',
    icon: Clock,
  },
  COURIER_ASSIGNED: {
    label: 'Courier Assigned',
    color: 'warning',
    icon: Truck,
  },
  PICKUP_ACCEPTED: {
    label: 'Pickup Accepted',
    color: 'warning',
    icon: Truck,
  },
  PICKED_UP: {
    label: 'Picked Up',
    color: 'warning',
    icon: Package,
  },
  DELIVERED_TO_FACILITY: {
    label: 'Delivered to Facility',
    color: 'purple',
    icon: MapPin,
  },
  RECEIVED_BY_INSPECTOR: {
    label: 'Received by Inspector',
    color: 'primary',
    icon: ClipboardList,
  },
  INSPECTION_IN_PROGRESS: {
    label: 'Inspection in Progress',
    color: 'primary',
    icon: Wrench,
  },
  INSPECTION_COMPLETED: {
    label: 'Inspection Completed',
    color: 'primary',
    icon: CheckCircle,
  },
  DECISION_PENDING: {
    label: 'Decision Pending',
    color: 'warning',
    icon: Clock,
  },
  REFUND_PENDING: {
    label: 'Refund Pending',
    color: 'warning',
    icon: DollarSign,
  },
  REFUND_APPROVED: {
    label: 'Refund Approved',
    color: 'success',
    icon: DollarSign,
  },
  REFUND_COMPLETED: {
    label: 'Refund Completed',
    color: 'success',
    icon: DollarSign,
  },
  CLOSED: {
    label: 'Closed',
    color: 'default',
    icon: CheckCircle,
  },
  REJECTED: {
    label: 'Rejected',
    color: 'danger',
    icon: XCircle,
  },
};

export function StatusBadge({ status, showIcon = true }) {
  const config = STATUS_CONFIG[status] || {
    label: status ? status.replace(/_/g, ' ') : 'Unknown',
    color: 'default',
    icon: null,
  };

  const Icon = config.icon;

  return (
    <span className={`status-badge color-${config.color}`} title={config.label}>
      {showIcon && Icon && <Icon size={12} className="badge-icon" />}
      {config.label}
    </span>
  );
}
