/**
 * AdminPage — Route entry point for /admin.
 * Renders the AdminLayout shell with panel switching via URL search params.
 *
 * On mount, checks for ?access_token= (GitHub OAuth callback redirect) and
 * stores it in sessionStorage so the AdminLayout auth gate passes.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../components/admin/AdminLayout';
import { OverviewPanel } from '../components/admin/OverviewPanel';
import { BountyManagement } from '../components/admin/BountyManagement';
import { ContributorManagement } from '../components/admin/ContributorManagement';
import { ReviewPipeline } from '../components/admin/ReviewPipeline';
import { FinancialPanel } from '../components/admin/FinancialPanel';
import { SystemHealth } from '../components/admin/SystemHealth';
import { AuditLogPanel } from '../components/admin/AuditLogPanel';
import { TreasuryDashboardPanel } from '../components/admin/TreasuryDashboardPanel';
import { setAdminToken } from '../hooks/useAdminData';
import type { AdminSection } from '../types/admin';

const DEFAULT_SECTION: AdminSection = 'overview';

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Capture GitHub OAuth token from redirect callback (?access_token=&state=...)
  useEffect(() => {
    const token = searchParams.get('access_token');
    const returnedState = searchParams.get('state');
    if (token) {
      const expectedState = sessionStorage.getItem('sf_admin_oauth_state');
      sessionStorage.removeItem('sf_admin_oauth_state');

      if (!expectedState || returnedState !== expectedState) {
        // State mismatch — possible CSRF; reject the token
        console.error('[AdminPage] OAuth state mismatch — login rejected');
      } else {
        setAdminToken(token);
      }

      // Strip token and state from URL regardless of outcome
      setSearchParams(
        prev => {
          prev.delete('access_token');
          prev.delete('state');
          return prev;
        },
        { replace: true },
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const section = (searchParams.get('section') ?? DEFAULT_SECTION) as AdminSection;

  const navigate = (s: AdminSection) => {
    setSearchParams({ section: s }, { replace: true });
  };

  const panel = () => {
    switch (section) {
      case 'bounties':     return <BountyManagement />;
      case 'contributors': return <ContributorManagement />;
      case 'reviews':      return <ReviewPipeline />;
      case 'financial':    return <FinancialPanel />;
      case 'treasury':     return <TreasuryDashboardPanel />;
      case 'health':       return <SystemHealth />;
      case 'audit-log':    return <AuditLogPanel />;
      default:             return <OverviewPanel />;
    }
  };

  return (
    <AdminLayout active={section} onNavigate={navigate}>
      {panel()}
    </AdminLayout>
  );
}
