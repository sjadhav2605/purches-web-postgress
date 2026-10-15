import React from 'react';
import { Truck, CheckCircle2, Receipt, AlertCircle } from 'lucide-react';

export const DeliveryStats = ({
  totalReceipts = 0,
  incomingCount = 0,
  billedChallansCount = 0,
  defectsCount = 0
}) => {
  const cards = [
    {
      title: 'Site Receipts',
      value: totalReceipts,
      label: 'Verified deliveries',
      icon: CheckCircle2,
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0'
    },
    {
      title: 'Incoming / In Transit',
      value: incomingCount,
      label: 'Awaiting site arrival',
      icon: Truck,
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd'
    },
    {
      title: 'Billed Challans',
      value: billedChallansCount,
      label: 'Commercial & tax bills',
      icon: Receipt,
      color: '#7c3aed',
      bg: '#f5f3ff',
      border: '#ddd6fe'
    },
    {
      title: 'Defects / Damages',
      value: defectsCount,
      label: 'Quality flags logged',
      icon: AlertCircle,
      color: defectsCount > 0 ? '#dc2626' : '#64748b',
      bg: defectsCount > 0 ? '#fef2f2' : '#f8fafc',
      border: defectsCount > 0 ? '#fecaca' : '#e2e8f0'
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            style={{
              background: '#ffffff',
              border: `1px solid ${card.border}`,
              borderRadius: '10px',
              padding: '0.9rem 1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                background: card.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: card.color,
                flexShrink: 0
              }}
            >
              <Icon size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                {card.value}
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginTop: '0.15rem' }}>
                {card.title}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {card.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DeliveryStats;
