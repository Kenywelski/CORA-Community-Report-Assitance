import { useEffect } from 'react';

export const useViewportZoomLock = () => {
  useEffect(() => {
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!viewport) return;

    const originalContent = viewport.content;
    const lockedContent = originalContent
      .split(',')
      .filter((directive) => !/^(maximum-scale|user-scalable)\s*=/i.test(directive.trim()))
      .concat(['maximum-scale=1', 'user-scalable=no'])
      .join(', ');

    viewport.content = lockedContent;
    return () => {
      viewport.content = originalContent;
    };
  }, []);
};
