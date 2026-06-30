import { handle, requireDb, ok, HttpError } from '@/common/api/http';
import { requireAuth } from '@/common/auth/session';
import * as service from '@/modules/connections/connection.service';
import { revokeGoogleToken } from '@/modules/email-ingestion/gmailOAuth';

export const dynamic = 'force-dynamic';

/**
 * Disconnect a connection: clear stored ciphertext + mark 'revoked', and (for
 * Gmail) best-effort revoke the refresh token at Google so access is killed on
 * their side too. Local revocation always succeeds even if Google is down.
 */
export const POST = handle(async (req, ctx) => {
  await requireDb();
  const user = await requireAuth();
  const { id } = await ctx.params;

  const result = await service.revokeConnection(user._id, id);
  if (!result) throw new HttpError(404, 'Connection not found');

  const { connection, priorTokens } = result;
  if (connection.kind === 'gmail' && priorTokens?.refresh_token) {
    // Fire-and-forget; never blocks the disconnect, never throws.
    await revokeGoogleToken(priorTokens.refresh_token);
  }

  return ok({ data: connection });
});
