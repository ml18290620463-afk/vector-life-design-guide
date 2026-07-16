import type { FC } from 'react';
import { Suspense } from 'react';
import type { DashboardProps } from './dashboardProps';
import { Dashboard } from './appLazyComponents';
import { ScreenLoader } from './ScreenLoader';

type AppDashboardScreenProps = {
  active: boolean;
  dashboardProps: DashboardProps;
};

export const AppDashboardScreen: FC<AppDashboardScreenProps> = ({ active, dashboardProps }) => {
  if (!active) {
    return null;
  }

  return (
    <Suspense fallback={<ScreenLoader language={dashboardProps.language} />}>
      <Dashboard {...dashboardProps} />
    </Suspense>
  );
};
