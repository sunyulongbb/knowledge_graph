import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254",
  "metadata.google.internal",
]);

const BLOCKED_HEADER_NAMES = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
]);

function isPrivateIPv4(ip: string) {
  return (
    /^10\./.test(ip) ||
    /^127\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    /^192\.168\./.test(ip)
  );
}

function isPrivateIPv6(ip: string) {
  const value = ip.toLowerCase();
  return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

export async function validateEndpointUrl(endpoint: string) {
  let url: URL;
  try {
    url = new URL(String(endpoint || "").trim());
  } catch {
    throw new Error("Endpoint 地址无效");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("仅支持 HTTP 或 HTTPS Endpoint");
  }

  const host = (url.hostname || "").toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host)) {
    throw new Error("禁止访问本地或保留地址");
  }

  const allowPrivate = String(process.env.ALLOW_PRIVATE_SPARQL_ENDPOINTS || "false").toLowerCase() === "true";
  if (!allowPrivate) {
    if (net.isIP(host)) {
      if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
        throw new Error("默认禁止访问内网 SPARQL Endpoint");
      }
    } else {
      try {
        const resolved = await lookup(host, { all: true });
        for (const item of resolved) {
          if (isPrivateIPv4(item.address) || isPrivateIPv6(item.address)) {
            throw new Error("默认禁止访问内网 SPARQL Endpoint");
          }
        }
      } catch (error) {
        if (String((error as Error)?.message || "").includes("内网")) throw error;
      }
    }
  }

  return url;
}

export function sanitizeHeaders(input: any) {
  const headers = input && typeof input === "object" ? input : {};
  const next: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = String(rawKey || "").trim();
    if (!key) continue;
    if (BLOCKED_HEADER_NAMES.has(key.toLowerCase())) continue;
    next[key] = String(rawValue ?? "").trim();
  }
  return next;
}

export function mapNetworkError(error: unknown) {
  const message = String((error as Error)?.message || error || "");
  const upper = message.toUpperCase();

  if (upper.includes("TIMEOUT") || upper.includes("ABORT")) {
    return "请求超时，请稍后重试或缩小查询范围";
  }
  if (upper.includes("ENOTFOUND")) {
    return "Endpoint 无法访问，请检查网络或域名是否正确";
  }
  if (upper.includes("ECONNREFUSED")) {
    return "目标服务拒绝连接";
  }
  if (upper.includes("CERT")) {
    return "HTTPS 证书错误";
  }
  if (upper.includes("SOCKET CONNECTION WAS CLOSED UNEXPECTEDLY") || upper.includes("ECONNRESET")) {
    return "远程 SPARQL 服务提前断开连接，请重试，或改用 POST 请求并减少返回条数";
  }

  return message || "SPARQL 请求失败";
}
