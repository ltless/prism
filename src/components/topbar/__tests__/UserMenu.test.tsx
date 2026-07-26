import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { UserMenu } from '../UserMenu';

const MotionTag = ({ children, ...props }: Record<string, unknown>) => {
  const { initial, animate, transition, exit, ...rest } = props;
  return <div {...rest}>{children as ReactNode}</div>;
};

vi.mock('motion/react', () => ({
  motion: new Proxy({}, { get: () => MotionTag }),
  AnimatePresence: ({ children }: Record<string, unknown>) => <>{children}</>,
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt, ...props }: Record<string, unknown>) => <img src={src as string} alt={alt as string} {...props} />,
}));

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

const mockSession = {
  user: { id: 'u-1', name: 'Alice', role: 'admin', image: null, coverImage: null },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

describe('UserMenu', () => {
  it('renders avatar with initial letter when no image', () => {
    const { container } = render(<UserMenu session={mockSession} onOpenSettings={vi.fn()} />);
    expect(container).toMatchSnapshot();
  });

  it('renders avatar with user image when available', () => {
    const sessionWithImage = {
      ...mockSession,
      user: { ...mockSession.user, image: '/avatars/test.png' },
    };
    const { container } = render(<UserMenu session={sessionWithImage} onOpenSettings={vi.fn()} />);
    expect(container).toMatchSnapshot();
  });

  it('opens dropdown on click', () => {
    const { container, getByRole } = render(<UserMenu session={mockSession} onOpenSettings={vi.fn()} />);
    fireEvent.click(getByRole('button'));
    expect(container).toMatchSnapshot();
  });

  it('calls onOpenSettings when settings clicked', () => {
    const onOpenSettings = vi.fn();
    const { getByRole, getByText } = render(<UserMenu session={mockSession} onOpenSettings={onOpenSettings} />);
    fireEvent.click(getByRole('button'));
    fireEvent.click(getByText('Settings'));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});