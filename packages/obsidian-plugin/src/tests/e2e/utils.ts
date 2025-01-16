declare global {
  interface RequestInit {
    /** This is a Bun-specific feature and not available in the NodeJS runtime */
    tls?: {
      /** Allow self-signed certificates if false */
      rejectUnauthorized: boolean;
    };
  }
}

export const fetchLocalApi = (path: string, init?: RequestInit) =>
  fetch(`https://localhost:27124${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.OBSIDIAN_API_KEY}`,
      ...init?.headers,
    },
    tls: {
      rejectUnauthorized: false,
      ...init?.tls,
    },
  });
