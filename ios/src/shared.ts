export interface Service {
  type: string
  channels: string[]
}

export interface ApiResponse {
  services: Service[]
  devices: string[]
  epg: EpgChannel[]
}

export interface EpgChannel {
  channel: string;
  now: {
      name: string;
      from: string;
      to: string;
  };
}