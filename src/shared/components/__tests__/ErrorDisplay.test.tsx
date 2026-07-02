import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ErrorDisplay from '../ErrorDisplay';

describe('ErrorDisplay', () => {
  it('renders title and message', () => {
    const { container } = render(<ErrorDisplay title="Something went wrong" message="Please try again" />);
    expect(container).toMatchSnapshot();
  });

  it('renders without message', () => {
    const { container } = render(<ErrorDisplay title="Not found" />);
    expect(container).toMatchSnapshot();
  });

  it('renders with action element', () => {
    const { container } = render(<ErrorDisplay title="Error" action={<button>Retry</button>} />);
    expect(container).toMatchSnapshot();
  });
});