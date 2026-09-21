import { useCallback, useEffect, useRef, useState } from 'react';
import type { Identity, Room } from '@/lib/game';
import { loadIdentity, request, saveIdentity, viewLink, type Mode, type RoomResult } from '@/lib/client';

function useSnapshots() {
  const [room, setRoom] = useState<Room | null>(null);
  const latest = useRef<Room | null>(null);
  const offset = useRef(0);
  const accept = useCallback((value: Room, replace = false) => {
    const previous = latest.current;
    if (previous && !replace && (previous.code !== value.code || previous.serverNow > value.serverNow)) return;
    latest.current = value;
    offset.current = value.serverNow - Date.now();
    setRoom(value);
  }, []);
  return { room, offset, accept };
}

function useSession(mode: Mode) {
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() || '');
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity(mode, code));
  const update = useCallback(
    (result: RoomResult) => {
      if (result.token) {
        saveIdentity(mode, result.room.code, result.token);
        setIdentity(loadIdentity(mode, result.room.code));
      }
      setCode(result.room.code);
      history.replaceState(null, '', viewLink(mode, result.room.code));
    },
    [mode],
  );
  return { code, identity, update };
}

export function useGame(mode: Mode) {
  const session = useSession(mode);
  const snapshot = useSnapshots();
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [connected, setConnected] = useState(false);
  const token = session.identity?.token || '';
  useRoomPolling(session.code, token, snapshot.accept, setConnected, setConnectionError);
  const { action, busy } = useHostAction(session, snapshot.accept, setError);
  return {
    ...session,
    ...snapshot,
    error: error || connectionError,
    setError,
    busy,
    connected,
    action,
    setConnectionError,
  };
}

type Session = ReturnType<typeof useSession>;
type Accept = ReturnType<typeof useSnapshots>['accept'];
type SetError = (message: string) => void;

function useHostAction(session: Session, accept: Accept, setError: SetError) {
  const { code, identity, update } = session;
  const [busy, setBusy] = useState(false);
  const token = identity?.token || '';
  const action = useCallback(
    async (body: object, create = false) => {
      setBusy(true);
      setError('');
      try {
        const result = await request<RoomResult>(create ? '' : `/${code}`, token, body);
        update(result);
        accept(result.room, create);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Не удалось выполнить действие.');
      } finally {
        setBusy(false);
      }
    },
    [accept, code, token, update, setError],
  );
  return { action, busy };
}

async function pollRoom(code: string, token: string, onSuccess: Accept, onError: SetError) {
  try {
    const room = await request<Room>(`/${code}`, token);
    onSuccess(room);
    return room.status === 'racing' || room.status === 'countdown' ? 350 : 1200;
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Связь потеряна. Переподключаемся…');
    return 1000;
  }
}

function useRoomPolling(code: string, token: string, accept: Accept, connected: (v: boolean) => void, error: SetError) {
  useEffect(() => {
    if (!code) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const success = (room: Room) => {
      if (stopped) return;
      accept(room);
      connected(true);
      error('');
    };
    const failure = (message: string) => {
      if (stopped) return;
      connected(false);
      error(message);
    };
    const poll = async () => {
      const delay = await pollRoom(code, token, success, failure);
      if (!stopped) timer = setTimeout(poll, delay);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [code, token, accept, connected, error]);
}

export type Game = ReturnType<typeof useGame>;

export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  return now;
}
