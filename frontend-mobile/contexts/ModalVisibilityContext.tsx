import React, { createContext, useCallback, useContext, useState } from 'react';

interface ModalVisibilityContextValue {
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
}

const ModalVisibilityContext = createContext<ModalVisibilityContextValue | undefined>(undefined);

export function ModalVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const setModalOpen = useCallback((open: boolean) => {
    setIsModalOpen(open);
  }, []);

  const value: ModalVisibilityContextValue = { isModalOpen, setModalOpen };

  return (
    <ModalVisibilityContext.Provider value={value}>
      {children}
    </ModalVisibilityContext.Provider>
  );
}

export function useModalVisibility() {
  const context = useContext(ModalVisibilityContext);
  return context ?? { isModalOpen: false, setModalOpen: () => {} };
}
