declare module '@daily-co/react-native-daily-js' {
  import * as React from 'react';

  export type DailyEvent = string;

  export interface DailyTrackState {
    state?: string;
    persistentTrack?: any;
  }

  export interface DailyParticipant {
    session_id: string;
    user_name?: string;
    local: boolean;
    tracks?: {
      video?: DailyTrackState;
      audio?: DailyTrackState;
    };
  }

  export interface DailyEventObjectParticipant {
    participant?: DailyParticipant;
  }

  export interface DailyCall {
    join(args: { url: string; token?: string }): Promise<void>;
    leave(): Promise<void>;
    destroy(): Promise<void>;
    on(event: DailyEvent, cb: (event?: any) => void): void;
    participants(): Record<string, DailyParticipant>;
    setLocalAudio(enabled: boolean): Promise<void>;
    setLocalVideo(enabled: boolean): Promise<void>;
    cycleCamera(): Promise<void>;
    getNetworkStats?(): any;
  }

  export interface DailyModule {
    createCallObject(config?: Record<string, any>): DailyCall;
  }

  export interface DailyMediaViewProps {
    videoTrack: any;
    audioTrack?: any;
    mirror?: boolean;
    zOrder?: number;
    style?: any;
    objectFit?: 'cover' | 'contain' | 'fill';
  }

  export const DailyMediaView: React.ComponentType<DailyMediaViewProps>;

  const Daily: DailyModule;
  export default Daily;
}
