export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function compress(data: any): string {
  const str = JSON.stringify(data);
  const encoded = new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...encoded));
}

export function decompress(data: string): any {
  const decoded = atob(data);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  const str = new TextDecoder().decode(bytes);
  return JSON.parse(str);
}
