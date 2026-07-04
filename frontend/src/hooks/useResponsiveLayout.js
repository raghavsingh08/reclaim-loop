import { useState, useEffect } from 'react';

export function useResponsiveLayout() {
  const [layout, setLayout] = useState({
    isMobile: false,
    isCompactTablet: false,
    isDesktop: true
  });

  useEffect(() => {
    // SSR safety
    if (typeof window === 'undefined') return;

    const mqlMobile = window.matchMedia('(max-width: 767px)');
    const mqlCompact = window.matchMedia('(min-width: 768px) and (max-width: 959px)');
    const mqlDesktop = window.matchMedia('(min-width: 960px)');

    const updateLayout = () => {
      setLayout({
        isMobile: mqlMobile.matches,
        isCompactTablet: mqlCompact.matches,
        isDesktop: mqlDesktop.matches
      });
    };

    // Initial check
    updateLayout();

    // Add listeners
    if (mqlMobile.addEventListener) {
      mqlMobile.addEventListener('change', updateLayout);
      mqlCompact.addEventListener('change', updateLayout);
      mqlDesktop.addEventListener('change', updateLayout);
    } else {
      // Fallback for older browsers
      mqlMobile.addListener(updateLayout);
      mqlCompact.addListener(updateLayout);
      mqlDesktop.addListener(updateLayout);
    }

    return () => {
      if (mqlMobile.removeEventListener) {
        mqlMobile.removeEventListener('change', updateLayout);
        mqlCompact.removeEventListener('change', updateLayout);
        mqlDesktop.removeEventListener('change', updateLayout);
      } else {
        mqlMobile.removeListener(updateLayout);
        mqlCompact.removeListener(updateLayout);
        mqlDesktop.removeListener(updateLayout);
      }
    };
  }, []);

  return layout;
}
