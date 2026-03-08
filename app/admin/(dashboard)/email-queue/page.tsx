'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Send, Trash2, Clock, CheckCircle, XCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface QueueStats {
  pending: number;
  oldestPending: string | null;
  failedLast24h: number;
  sentLast24h: number;
}

export default function EmailQueuePage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/email-queue');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      } else {
        toast.error('Failed to fetch queue stats');
      }
    } catch (error) {
      toast.error('Error fetching queue stats');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    try {
      setProcessing(true);
      const response = await fetch('/api/admin/email-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', batchSize: 50 }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          `Processed ${data.result.processed} emails: ${data.result.sent} sent, ${data.result.failed} failed`
        );
        fetchStats(); // Refresh stats
      } else {
        toast.error('Failed to process queue');
      }
    } catch (error) {
      toast.error('Error processing queue');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const cleanupQueue = async () => {
    if (!confirm('Clean up emails older than 72 hours?')) return;

    try {
      const response = await fetch('/api/admin/email-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup', olderThanHours: 72 }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Cleaned up ${data.deletedCount} old emails`);
        fetchStats(); // Refresh stats
      } else {
        toast.error('Failed to cleanup queue');
      }
    } catch (error) {
      toast.error('Error cleaning up queue');
      console.error(error);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Queue</h1>
          <p className="text-muted-foreground">
            Monitor and manage queued emails that failed due to quota limits
          </p>
        </div>
        <Button onClick={fetchStats} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Emails</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending ?? '-'}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.oldestPending
                ? `Oldest: ${new Date(stats.oldestPending).toLocaleString()}`
                : 'No pending emails'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent (24h)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sentLast24h ?? '-'}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed (24h)</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failedLast24h ?? '-'}</div>
            <p className="text-xs text-muted-foreground">Permanent failures</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.pending === 0 ? (
                <Badge variant="outline" className="text-green-600">
                  Empty
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-600">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Current queue state</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Actions</CardTitle>
          <CardDescription>
            Manually process queued emails or clean up old entries. The queue is automatically
            processed every hour by a cron job.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={processQueue} disabled={processing || stats?.pending === 0}>
              <Send className="h-4 w-4 mr-2" />
              {processing ? 'Processing...' : 'Process Queue Now'}
            </Button>

            <Button onClick={cleanupQueue} variant="outline" disabled={stats?.pending === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Cleanup Old Emails
            </Button>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">How it works:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Emails that fail due to quota limits are automatically queued</li>
              <li>A cron job runs every hour to retry queued emails</li>
              <li>You can manually trigger processing using the button above</li>
              <li>Old emails (72+ hours) can be cleaned up to keep the queue tidy</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
