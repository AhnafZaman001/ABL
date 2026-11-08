const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

export function formatPKR(amount: number): string {
  return `Rs ${pkr.format(amount)}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days} days ago`;
  const years = Math.floor(days / 365);
  return years >= 1 ? `${years} yr ago` : `${Math.floor(days / 30)} months ago`;
}

export function accountAge(openedAt: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(openedAt).getTime()) / 86_400_000);
  if (days < 1) return "opened today";
  if (days < 60) return `opened ${days} days ago`;
  const years = Math.floor(days / 365);
  return years >= 1 ? `open ${years} yr` : `open ${Math.floor(days / 30)} months`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
