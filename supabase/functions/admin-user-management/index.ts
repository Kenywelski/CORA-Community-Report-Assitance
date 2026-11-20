const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAdminRole(value: unknown): value is { user_id: string } {
  return isRecord(value) && typeof value.user_id === 'string';
}

function isAuthUser(value: unknown): value is { id: string; email?: unknown } {
  return isRecord(value) && typeof value.id === 'string';
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

async function fetchUserEmails(projectUrl: string, serviceRoleKey: string) {
  const pageSize = 1000;
  const emails: Array<{ user_id: string; email: string | null }> = [];
  let page = 1;

  while (true) {
    const url = new URL(`${projectUrl}/auth/v1/admin/users`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(pageSize));

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Auth user listing failed with status ${response.status}`);
    }

    const result: unknown = await response.json();
    if (!isRecord(result) || !Array.isArray(result.users) || !result.users.every(isAuthUser)) {
      throw new Error('Auth user listing returned an invalid response');
    }

    emails.push(
      ...result.users.map((user) => ({
        user_id: user.id,
        email: typeof user.email === 'string' ? user.email : null,
      })),
    );
    if (result.users.length < pageSize) return emails;
    page += 1;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  const projectUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceRoleKey;
  if (!projectUrl || !serviceRoleKey || !apiKey) {
    console.error('Supabase server credentials are not configured.');
    return jsonResponse(500, { error: 'User deletion is not configured on the server.' });
  }

  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse(401, { error: 'Sign in with an administrator account.' });
  }

  const body: unknown = await request.json().catch(() => null);
  if (
    !isRecord(body) ||
    (body.action !== 'delete' && body.action !== 'list-emails')
  ) {
    return jsonResponse(400, { error: 'Invalid user management request.' });
  }
  const action = body.action;
  const targetUserId = body.userId;
  if (action === 'delete' && typeof targetUserId !== 'string') {
    return jsonResponse(400, { error: 'Invalid user deletion request.' });
  }
  if (action === 'delete' && !userIdPattern.test(targetUserId)) {
    return jsonResponse(400, { error: 'Invalid user ID.' });
  }

  try {
    const callerResponse = await fetch(`${projectUrl}/auth/v1/user`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!callerResponse.ok) {
      return jsonResponse(401, { error: 'Your session is invalid or has expired.' });
    }

    const caller: unknown = await callerResponse.json();
    if (!isRecord(caller) || typeof caller.id !== 'string') {
      return jsonResponse(401, { error: 'Could not verify your account.' });
    }
    if (action === 'delete' && caller.id === targetUserId) {
      return jsonResponse(400, { error: 'You cannot delete your current account.' });
    }

    const adminRolesResponse = await fetch(
      `${projectUrl}/rest/v1/user_roles?select=user_id&role=eq.admin`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (!adminRolesResponse.ok) {
      console.error('Admin role lookup failed with status', adminRolesResponse.status);
      return jsonResponse(500, { error: 'Could not verify administrator permissions.' });
    }

    const adminRoles: unknown = await adminRolesResponse.json();
    if (!Array.isArray(adminRoles) || !adminRoles.every(isAdminRole)) {
      console.error('Admin role lookup returned an invalid response.');
      return jsonResponse(500, { error: 'Could not verify administrator permissions.' });
    }

    const adminIds = new Set(adminRoles.map((role) => role.user_id));
    if (!adminIds.has(caller.id)) {
      return jsonResponse(403, { error: 'Only administrators can manage user accounts.' });
    }

    if (action === 'list-emails') {
      try {
        const emails = await fetchUserEmails(projectUrl, serviceRoleKey);
        return jsonResponse(200, { emails });
      } catch (error) {
        console.error(
          'Admin user email lookup failed:',
          error instanceof Error ? error.message : 'Unknown error',
        );
        return jsonResponse(502, { error: 'Could not load account email addresses.' });
      }
    }

    if (adminIds.has(targetUserId) && adminIds.size === 1) {
      return jsonResponse(409, { error: 'The last administrator account cannot be deleted.' });
    }

    const deleteResponse = await fetch(
      `${projectUrl}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (deleteResponse.status === 404) {
      return jsonResponse(404, { error: 'User account not found.' });
    }
    if (!deleteResponse.ok) {
      console.error('Supabase Auth account deletion failed with status', deleteResponse.status);
      return jsonResponse(502, { error: 'Supabase Auth could not delete this account.' });
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    console.error(
      'Admin user deletion failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return jsonResponse(500, { error: 'An unexpected error occurred while deleting the account.' });
  }
});
