import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EmptyLibrary } from '../EmptyLibrary';

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