// Brief notification shown in the #toast element from index.html.
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const showToast = (message: string, durationMs = 2000) => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toast.classList.remove('show'), durationMs);
};
