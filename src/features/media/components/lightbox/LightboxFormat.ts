const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

export function formatDate(date: Date | string | number | null | undefined) {
  if (!date) return null;
  let d: Date;
  if (date instanceof Date) d = date;
  else if (typeof date === "number") d = new Date(date < 1e12 ? date * 1000 : date);
  else d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return dateFormatter.format(d);
}

export function transcodeLabel(status: string | null | undefined) {
  switch (status) {
    case "done": return "Complete";
    case "processing": return "Encoding";
    case "failed": return "Failed";
    default: return "Pending";
  }
}