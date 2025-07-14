import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: (event: KeyboardEvent) => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const matchingShortcut = shortcuts.find((shortcut) => {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const metaMatch = !!shortcut.metaKey === event.metaKey;
      const ctrlMatch = !!shortcut.ctrlKey === event.ctrlKey;
      const shiftMatch = !!shortcut.shiftKey === event.shiftKey;
      const altMatch = !!shortcut.altKey === event.altKey;

      return keyMatch && metaMatch && ctrlMatch && shiftMatch && altMatch;
    });

    if (matchingShortcut) {
      event.preventDefault();
      matchingShortcut.handler(event);
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return shortcuts;
}

// Predefined shortcuts for the Players page
export const playerPageShortcuts = {
  SEARCH_FOCUS: {
    key: 'f',
    ctrlKey: true,
    description: 'Focus search input'
  },
  CLEAR_FILTERS: {
    key: 'r',
    ctrlKey: true,
    description: 'Clear all filters'
  },
  EXPORT_DATA: {
    key: 'e',
    ctrlKey: true,
    description: 'Export filtered data'
  },
  TOGGLE_SORT: {
    key: 's',
    ctrlKey: true,
    description: 'Toggle sort direction'
  },
  NEXT_PAGE: {
    key: 'ArrowRight',
    ctrlKey: true,
    description: 'Next page'
  },
  PREV_PAGE: {
    key: 'ArrowLeft',
    ctrlKey: true,
    description: 'Previous page'
  },
  FILTER_AVAILABLE: {
    key: 'a',
    ctrlKey: true,
    description: 'Filter available players'
  },
  FILTER_OWNED: {
    key: 'o',
    ctrlKey: true,
    description: 'Filter owned players'
  }
};