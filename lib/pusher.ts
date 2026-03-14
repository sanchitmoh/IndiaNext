import Pusher from 'pusher';

// Server-side Pusher (lazy initializer)
let _pusherServer: Pusher | null = null;

export const getPusherServer = () => {
  if (!_pusherServer) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster) {
      console.warn('Pusher server variables are missing. Triggering events will fail.', {
        hasAppId: !!appId,
        hasKey: !!key,
        hasSecret: !!secret,
        hasCluster: !!cluster
      });
      return null;
    }

    console.log(`[Pusher] Initializing server for App ID: ${appId.substring(0, 4)}...`);

    _pusherServer = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }
  return _pusherServer;
};

// Browser-side Pusher Client
let pusherClient: any = null;

export const getPusherClient = () => {
  if (typeof window === 'undefined') return null;
  
  if (!pusherClient) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      console.warn('Pusher environment variables are missing. Real-time features will not work.');
      return null;
    }

    try {
      // Synchronous require but only on client
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PusherLib = require('pusher-js');
      
      console.log(`[Pusher] Initializing client for cluster: ${cluster}`);
      pusherClient = new PusherLib(key, {
        cluster: cluster,
        forceTLS: true,
        enabledTransports: ['ws', 'wss'],
      });
      console.log('[Pusher] Client instance created successfully');
    } catch (err) {
      console.error('[Pusher] Client initialization failed:', err);
      return null;
    }
  }
  return pusherClient;
};
