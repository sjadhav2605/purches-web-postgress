import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { requisitionService } from '@/services/requisition.service.js';

export const PipelineBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = useState({
    pr_raised: 0,
    rfq_sent: 0,
    bids_in: 0,
    shortlisted: 0,
    approved: 0,
    po_issued: 0,
    delivered_verified: 0
  });

  const fetchStats = async () => {
    try {
      const data = await requisitionService.getPipelineStats();
      if (data) setStats(data);
    } catch (e) {
      console.error('Error loading pipeline stats:', e);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll every 45 seconds for live pipeline updates if document is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchStats();
      }
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  const searchParams = new URLSearchParams(location.search);
  const currentStatus = searchParams.get('status') || '';
  const currentTab = searchParams.get('tab') || '';
  const pathname = location.pathname;

  const STAGES = [
    { 
      num: 1, 
      label: 'PR Raised', 
      count: stats.pr_raised, 
      path: '/requisitions?tab=pending',
      isActive: pathname.startsWith('/requisitions') && (currentTab === 'pending' || currentStatus === 'PR Raised' || currentStatus === 'Draft')
    },
    { 
      num: 2, 
      label: 'RFQ Sent', 
      count: stats.rfq_sent, 
      path: '/rfqs?status=RFQ Sent',
      isActive: pathname.startsWith('/rfqs') && (currentStatus === 'RFQ Sent' || currentStatus === 'Open')
    },
    { 
      num: 3, 
      label: 'Bids In', 
      count: stats.bids_in, 
      path: '/rfqs?status=Bids In',
      isActive: pathname.startsWith('/rfqs') && currentStatus === 'Bids In'
    },
    { 
      num: 4, 
      label: 'Shortlisted', 
      count: stats.shortlisted, 
      path: '/rfqs?status=Shortlisted',
      isActive: pathname.startsWith('/rfqs') && (currentStatus === 'Under_Review' || currentStatus === 'Shortlisted')
    },
    { 
      num: 5, 
      label: 'Approved', 
      count: stats.approved, 
      path: '/rfqs?status=Approved',
      isActive: (pathname.startsWith('/rfqs') && (currentStatus === 'Approved' || currentStatus === 'Awarded')) ||
                (pathname.startsWith('/requisitions') && (currentTab === 'approved' || currentStatus === 'Approved'))
    },
    { 
      num: 6, 
      label: 'PO Issued', 
      count: stats.po_issued, 
      path: '/orders?status=Issued',
      isActive: pathname.startsWith('/orders')
    },
    { 
      num: 7, 
      label: 'Delivered & verified', 
      count: stats.delivered_verified, 
      path: '/deliveries',
      isActive: pathname.startsWith('/deliveries')
    }
  ];

  return (
    <div className="pipeline-bar-wrapper">
      <div className="pipeline-container">
        {STAGES.map((s, index) => {
          const hasItems = s.count > 0;
          return (
            <React.Fragment key={s.num}>
              <div 
                className={`pipeline-step ${hasItems ? 'has-items' : ''} ${s.isActive ? 'active-stage-step' : ''}`}
                onClick={() => navigate(s.path)}
                title={`Stage ${s.num}: ${s.label} (${s.count} items) - Click to view`}
              >
                <div className="step-circle">
                  {s.num}
                </div>
                <div className="step-label">
                  {s.label}
                </div>
                <div className="step-count">
                  {s.count}
                </div>
              </div>

              {index < STAGES.length - 1 && (
                <div className="pipeline-connector"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
