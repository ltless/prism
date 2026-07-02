import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EmptyLibrary } from '../EmptyLibrary';

const MotionTag = ({ children, ...props }: Record<string, unknown>) => {
  const { initial, animate, transition, exit, ...rest } = props;
  return <div {...rest}>{children as ReactNode}</div>;
};

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => MotionTag }),
  AnimatePresence: ({ children }: Record<string, unknown>) => <>{children}</>,
}));

describe('EmptyLibrary', () => {
  it('renders empty state for folder', () => {
    const { container } = render(<EmptyLibrary isFolder={true} />);
    expect(container).toMatchSnapshot();
  });

  it('renders empty state for non-folder', () => {
    const { container } = render(<EmptyLibrary isFolder={false} />);
    expect(container).toMatchSnapshot();
  });
});