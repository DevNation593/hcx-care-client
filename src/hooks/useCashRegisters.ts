'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cashRegistersApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import type { ApiError } from '@/types';
import type {
  CashRegisterDetail,
  CashRegisterFilters,
  CloseCashRegisterInput,
  OpenCashRegisterInput,
} from '@/types/cash';

export function useCashRegisters(filters?: CashRegisterFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CASH_REGISTERS, 'list', filters ?? null],
    queryFn: () => cashRegistersApi.list(filters),
  });
}

/** The register detail: the cash count by payment method comes with it. */
export function useCashRegister(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CASH_REGISTERS, id],
    queryFn: () => cashRegistersApi.get(id),
    enabled: Boolean(id),
  });
}

/** The open register of a branch, or null when the branch has none. */
export function useCurrentCashRegister(branchId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CASH_REGISTERS, 'current', branchId ?? null],
    queryFn: async () => {
      const { items } = await cashRegistersApi.list({ branchId, status: 'OPEN' });
      return items[0] ?? null;
    },
    enabled: Boolean(branchId),
  });
}

function useRegisterMutation<TInput>(
  mutationFn: (input: TInput) => Promise<CashRegisterDetail>,
  success: string,
) {
  const queryClient = useQueryClient();
  return useMutation<CashRegisterDetail, ApiError, TInput>({
    mutationFn,
    onSuccess: () => {
      // Opening or closing changes whether orders can be paid.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CASH_REGISTERS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORDERS });
      toast.success(success);
    },
    onError: (error) => {
      // The count moved since the dialog read it: read the register again so the note field shows up.
      if (error.code === 'CASH_CLOSING_NOTE_REQUIRED') {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CASH_REGISTERS });
      }
      toast.error(error.message);
    },
  });
}

export function useOpenCashRegister() {
  return useRegisterMutation(
    (data: OpenCashRegisterInput) => cashRegistersApi.open(data),
    'Caja abierta',
  );
}

export function useCloseCashRegister() {
  return useRegisterMutation(
    ({ id, data }: { id: string; data: CloseCashRegisterInput }) => cashRegistersApi.close(id, data),
    'Caja cerrada',
  );
}
