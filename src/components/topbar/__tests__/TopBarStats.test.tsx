import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TopBarStats } from '../TopBarStats';

describe('TopBarStats', () => {
  it('renders CPU and RAM', () => {
    const { container } = render(<TopBarStats stats={{ cpu: 45, ram: 60, ramText: '4.2/8GB' }} aiStatus="ready" aiVariant="standard" aiEnabled={false} />);
    expect(container).toMatchSnapshot();
  });

  it('renders with AI enabled and ready', () => {
    const { container } = render(<TopBarStats stats={{ cpu: 30, ram: 50, ramText: '3/8GB' }} aiStatus="ready" aiVariant="sharp" aiEnabled={true} />);
    expect(container).toMatchSnapshot();
  });

  it('renders while model loading', () => {
    const { container } = render(<TopBarStats stats={{ cpu: 10, ram: 20, ramText: '1/8GB' }} aiStatus="loading" aiVariant="high" aiEnabled={true} />);
    expect(container).toMatchSnapshot();
  });

  it('renders with high CPU (red)', () => {
    const { container } = render(<TopBarStats stats={{ cpu: 92, ram: 70, ramText: '5/8GB' }} aiStatus="off" aiVariant={null} aiEnabled={false} />);
    expect(container).toMatchSnapshot();
  });

  it('renders with aesthetic enabled', () => {
    const { container } = render(<TopBarStats stats={{ cpu: 40, ram: 55, ramText: '4/8GB' }} aiStatus="ready" aiVariant="standard" aiEnabled={true} aestheticModel="laion" aestheticEnabled={true} />);
    expect(container).toMatchSnapshot();
  });
});