'use client';

import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';

// ==========================================
// GET QUERIES
// ==========================================

export function useSubscription() {
  return useQuery({
    queryKey: QUERY_KEYS.SUBSCRIPTION,
    queryFn: async () => {
      const response = await subscriptionApi.getCurrent();
      return response;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSubscriptionPayments() {
  return useQuery({
    queryKey: QUERY_KEYS.SUBSCRIPTION_PAYMENTS,
    queryFn: () => subscriptionApi.getPayments(),
  });
}

export function useUsageMetrics(period?: 'current' | 'previous' | string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.SUBSCRIPTION_USAGE, period],
    queryFn: async () => {
      const response = await subscriptionApi.getUsage({ period });
      return response;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}

// ==========================================
// COMPUTED/HELPER HOOKS
// ==========================================

export function useSubscriptionStatus() {
  const { data: subscription } = useSubscription();
  
  return {
    isActive: subscription?.status === 'ACTIVE',
    isTrial: subscription?.status === 'TRIAL',
    isPastDue: subscription?.status === 'PAST_DUE',
    isSuspended: subscription?.status === 'SUSPENDED',
    isCanceled: subscription?.status === 'CANCELED',
    canCreateRecords: ['ACTIVE', 'TRIAL'].includes(subscription?.status || ''),
  };
}
