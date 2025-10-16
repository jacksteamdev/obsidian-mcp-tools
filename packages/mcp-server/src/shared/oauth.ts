import { logger } from "./logger";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * OAuth token manager for client credentials flow
 */
export class OAuthTokenManager {
  private config: OAuthConfig;
  private cachedToken: CachedToken | null = null;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Get a valid OAuth token, fetching a new one if needed
   */
  async getToken(): Promise<string> {
    // Return cached token if still valid (with 60 second buffer)
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.token;
    }

    // Fetch new token
    try {
      const token = await this.fetchToken();
      return token;
    } catch (error) {
      logger.error("Failed to fetch OAuth token", { error });
      throw new Error(
        `Failed to fetch OAuth token: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Fetch a new OAuth token using client credentials flow
   */
  private async fetchToken(): Promise<string> {
    const { clientId, clientSecret, tokenEndpoint } = this.config;

    // Prepare request body for client credentials flow
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });

    logger.debug("Fetching OAuth token", { tokenEndpoint });

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token request failed (${response.status}): ${error}`);
    }

    const data: TokenResponse = await response.json();

    // Cache the token
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    logger.debug("OAuth token fetched successfully", {
      expiresIn: data.expires_in,
    });

    return data.access_token;
  }

  /**
   * Clear cached token (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.cachedToken = null;
  }
}

/**
 * Create OAuth token manager from environment variables
 */
export function createOAuthManagerFromEnv(): OAuthTokenManager | null {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  const tokenEndpoint = process.env.OAUTH_TOKEN_ENDPOINT;

  if (!clientId || !clientSecret || !tokenEndpoint) {
    return null;
  }

  return new OAuthTokenManager({
    clientId,
    clientSecret,
    tokenEndpoint,
  });
}
