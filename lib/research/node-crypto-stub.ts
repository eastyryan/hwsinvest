/**
 * Browser stand-in for `node:crypto`.
 *
 * The EDGAR cache fingerprint uses SHA-1 on the server. Client components
 * import that module for types and pure helpers, and Next 14's webpack cannot
 * read the `node:` scheme. This stub is only wired into the browser bundle.
 */

export function createHash(_algorithm: string) {
  const parts: string[] = [];
  return {
    update(data: string) {
      parts.push(String(data));
      return this;
    },
    digest(encoding?: string) {
      let hash = 2166136261;
      const text = parts.join("\0");
      for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const hex = (hash >>> 0).toString(16).padStart(8, "0");
      return encoding === "hex" || encoding == null ? hex : hex;
    },
  };
}
