import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { soundManager } from '../sound/SoundManager';

export interface WSMessage<T = unknown> {
  type: string;
  timestamp: string;
  payload: T;
}

export function useNocWebSocket(onMessage?: (msg: WSMessage) => void) {
  const [status, setStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${proto}//${host}/api/ws`;

    setStatus('CONNECTING');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('CONNECTED');
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        // Play sound alerts directly through Web Audio SoundManager
        if (msg.type === 'SOUND_ALERT') {
          const p = msg.payload as { channel: string; action: string; volume?: number };
          soundManager.playAlert(p.channel, p.action, p.volume || 80);
        }

        // Invalidate appropriate React Query caches on delta changes
        const qc = queryClientRef.current;
        if (msg.type === 'DEVICE_STATUS_CHANGED' || msg.type === 'DEVICE_RECOVERED') {
          qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
          qc.invalidateQueries({ queryKey: ['devices'] });
          qc.invalidateQueries({ queryKey: ['network-devices'] });
          qc.invalidateQueries({ queryKey: ['biometrics'] });
          qc.invalidateQueries({ queryKey: ['servers'] });
        } else if (msg.type === 'ALARM_CREATED' || msg.type === 'ALARM_UPDATED' || msg.type === 'ALARM_CLEARED') {
          qc.invalidateQueries({ queryKey: ['alarms'] });
          qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
        } else if (msg.type === 'INCIDENT_CREATED' || msg.type === 'INCIDENT_UPDATED') {
          qc.invalidateQueries({ queryKey: ['incidents'] });
        } else if (msg.type === 'VLAN_UPDATED' || msg.type === 'ACTION_COMPLETED') {
          qc.invalidateQueries({ queryKey: ['vlans'] });
          qc.invalidateQueries({ queryKey: ['actions'] });
        }

        if (onMessageRef.current) {
          onMessageRef.current(msg);
        }
      } catch (err) {
        console.error('Failed parsing websocket payload:', err);
      }
    };

    ws.onclose = () => {
      setStatus('DISCONNECTED');
      wsRef.current = null;
      // Reconnect after 3 seconds
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => {
      console.warn('WebSocket error, will reconnect:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { status };
}
