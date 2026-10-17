import { useEffect, useState } from 'react';

/** True while the page is on screen; false when the app is backgrounded or the tab is hidden. */
export const useDocumentVisible = (): boolean => {
    const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
    useEffect(() => {
        const update = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', update);
        return () => document.removeEventListener('visibilitychange', update);
    }, []);
    return visible;
};
