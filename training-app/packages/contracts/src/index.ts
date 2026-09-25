export type HealthStatus = {
  status: 'ok' | 'degraded';
  service: 'training-api';
  requestId?: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
};
