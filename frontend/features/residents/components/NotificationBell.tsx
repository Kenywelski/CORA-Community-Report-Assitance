import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/features/auth/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { normalizeInternalRoute, ROUTES } from '@/app/routePaths';
import { useAppPreferences } from '@/lib/preferences';
import { formatResidentRelativeTime } from '@/lib/residentTranslations';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  report_id: string | null;
  read_at: string | null;
  created_at: string;
}

const statusNotificationMessages: Record<string, string> = {
  pending: 'The admin has already checked this report, and it is now pending further review.',
  under_review: 'The admin has already checked this report, and it is now under review.',
  assigned: 'The admin has already checked this report, and it is now assigned for action.',
  in_progress: 'The admin has already checked this report, and it is now in progress.',
  completed: 'The admin has already checked this report, and it is now resolved.',
  closed: 'The admin has already checked this report, and it is now closed.',
  rejected: 'The admin has already checked this report, and it was rejected.',
};

const getNotificationBody = (
  notification: Notification,
  translate: (text: string, values?: Record<string, string | number>) => string,
) => {
  const body = notification.body?.trim();
  if (!body || notification.type !== 'report_status') return body;

  const match = body.match(/^Status changed to ([^:]+?)(?::\s*(.*))?$/i);
  if (!match) return body;

  const status = match[1].trim().toLowerCase().replace(/[\s-]+/g, '_');
  const message = statusNotificationMessages[status]
    ? translate(statusNotificationMessages[status])
    : translate('The report status is now {status}.', {
        status: translate(status.replace(/_/g, ' ')),
      });
  const detail = match[2]?.trim();

  return detail ? `${message} ${translate('Additional details: {detail}', { detail })}` : message;
};

interface Props {
  iconClassName?: string;
  buttonClassName?: string;
}

export const NotificationBell = ({ iconClassName, buttonClassName }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notificationsEnabled, language, translate } = useAppPreferences();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async (): Promise<Notification[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('report_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user && notificationsEnabled,
  });

  useEffect(() => {
    if (!user || !notificationsEnabled) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'report_notifications', filter: `user_id=eq.${user.id}`,
      }, () => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, queryClient, notificationsEnabled]);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('report_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
  };

  const handleClick = async (n: Notification) => {
    if (!n.read_at) {
      await supabase.from('report_notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }
    setOpen(false);

    const hasOwnerLink = n.link === ROUTES.myRequests;
    const mayReferenceOwnedReport = hasOwnerLink
      || n.type === 'report_status'
      || n.type === 'report_update'
      || (n.type === 'report_comment' && n.body?.toLowerCase().includes('your report'));

    if (mayReferenceOwnedReport && user) {
      let reportId: string | null = null;

      // Confirm ownership before opening My Reports. This keeps notifications
      // for followed public reports on the Community page.
      let ownerReportQuery = supabase
        .from('community_reports')
        .select('id')
        .eq('user_id', user.id);
      ownerReportQuery = n.report_id
        ? ownerReportQuery.eq('id', n.report_id)
        : ownerReportQuery.eq('title', n.title).order('created_at', { ascending: false });
      const { data } = await ownerReportQuery.limit(1).maybeSingle();
      reportId = data?.id ?? null;

      if (reportId || hasOwnerLink) {
        navigate(reportId
          ? `${ROUTES.myRequests}?report=${encodeURIComponent(reportId)}`
          : ROUTES.myRequests);
        return;
      }
    }
    if (n.link) navigate(normalizeInternalRoute(n.link));
  };

  if (!user || !notificationsEnabled) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', buttonClassName)}
          aria-label={translate('Notifications')}
        >
          <Bell className={cn('h-5 w-5', iconClassName)} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="w-[calc(100vw-2rem)] max-w-80 p-0"
      >
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">{translate('Notifications')}</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs gap-1">
              <CheckCheck className="h-3.5 w-3.5" /> {translate('Mark all read')}
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {translate('No notifications yet')}
            </div>
          ) : (
            notifications.map((n) => {
              const body = getNotificationBody(n, translate);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors',
                    !n.read_at && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{translate(n.title)}</p>
                      {body && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatResidentRelativeTime(new Date(n.created_at), language)}
                      </p>
                    </div>
                    {n.read_at && <Check className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />}
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
