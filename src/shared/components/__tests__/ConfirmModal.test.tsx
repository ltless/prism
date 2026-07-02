import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../ConfirmModal';

const MotionTag = ({ children, ...props }: Record<string, unknown>) => {
  const { initial, animate, transition, exit, ...rest } = props;
  return <div {...rest}>{children as ReactNode}</div>;
};

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => MotionTag }),
  AnimatePresence: ({ children }: Record<string, unknown>) => <>{children}</>,
}));

vi.mock('../../hooks/useFocusTrap', () => ({ default: vi.fn(), useFocusTrap: vi.fn() }));
vi.mock('../../hooks/useScrollLock', () => ({ default: vi.fn(), useScrollLock: vi.fn() }));
vi.mock('../../hooks/useReducedMotion', () => ({ default: vi.fn(() => false), useReducedMotion: vi.fn(() => false) }));

describe('ConfirmModal', () => {
  it('renders when open', () => {
    const { container } = render(<ConfirmModal isOpen={true} title="Delete item" message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(container).toMatchSnapshot();
  });

  it('does not render when closed', () => {
    const { container } = render(<ConfirmModal isOpen={false} title="Delete item" message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(container).toMatchSnapshot();
  });

  it('calls onConfirm when confirm clicked', () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(<ConfirmModal isOpen={true} title="Delete" message="Sure?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn();
    const { getByText } = render(<ConfirmModal isOpen={true} title="Delete" message="Sure?" cancelLabel="Keep" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(getByText('Keep'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});