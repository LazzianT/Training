import type { ReactNode } from 'react';

/**
  A compact action row: a filled primary control plus outlined siblings. Used
  where a page has several valid actions but only one of them is the next step.
*/
export const ActionBar = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">{children}</div>
);
