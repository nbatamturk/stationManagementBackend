let accessToken: string | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const registerUnauthorizedHandler = (
  handler: (() => void | Promise<void>) | null,
): void => {
  unauthorizedHandler = handler;
};

export const handleUnauthorized = (): void => {
  if (!unauthorizedHandler) {
    return;
  }

  void unauthorizedHandler();
};
