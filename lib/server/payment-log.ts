import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

function isMissingPaymentLogTableError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /payment_logs/i.test(message)
}

export async function insertPendingPaymentLog({
  tranId,
  userId,
  amount,
}: {
  tranId: string
  userId: string
  amount: number
}) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin.from('payment_logs').upsert(
      {
        tran_id: tranId,
        user_id: userId,
        amount,
        status: 'pending',
      },
      { onConflict: 'tran_id' }
    )
  } catch (error) {
    if (isMissingPaymentLogTableError(error)) {
      return
    }
    throw error
  }
}

export async function getPaymentLogStatus(tranId: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('payment_logs')
      .select('status')
      .eq('tran_id', tranId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return (data as { status?: string } | null)?.status ?? null
  } catch (error) {
    if (isMissingPaymentLogTableError(error)) {
      return null
    }
    throw error
  }
}

export async function updatePaymentLog(
  tranId: string,
  patch: {
    status: string
    valId?: string | null
  }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin
      .from('payment_logs')
      .update({
        status: patch.status,
        val_id: patch.valId ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq('tran_id', tranId)
  } catch (error) {
    if (isMissingPaymentLogTableError(error)) {
      return
    }
    throw error
  }
}

export async function getPaymentLog(tranId: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('payment_logs')
      .select('tran_id, user_id, amount, status, val_id')
      .eq('tran_id', tranId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return (data as {
      tran_id?: string
      user_id?: string
      amount?: number | string
      status?: string | null
      val_id?: string | null
    } | null) ?? null
  } catch (error) {
    if (isMissingPaymentLogTableError(error)) {
      return null
    }
    throw error
  }
}
