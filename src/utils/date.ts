export const formatDate = (date: Date): string => date.toISOString();

export const formatTime = (date?: Date): string => {
  if (!date) return '';
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMins = Math.floor(diffInSeconds / 60);
  if (diffInMins < 60) return `${diffInMins} mins`;
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return `${diffInHours} hours`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days`;

  // Format as short date if older than a week
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(date)
  );
};

export const formatPreviewDate = (dateInput?: Date | string | number, language = 'vi'): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isVi = language?.startsWith('vi');

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  // Check if today
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return isVi ? `Hôm nay lúc ${timeStr}` : `Today at ${timeStr}`;
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return isVi ? `Hôm qua lúc ${timeStr}` : `Yesterday at ${timeStr}`;
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  if (year === now.getFullYear()) {
    return isVi ? `${day}/${month} lúc ${timeStr}` : `${month}/${day} at ${timeStr}`;
  }

  return isVi ? `${day}/${month}/${year} lúc ${timeStr}` : `${month}/${day}/${year} at ${timeStr}`;
};
