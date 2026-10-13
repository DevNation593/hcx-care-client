import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { site } from '@/content/site';
import { Logo, LogoMark } from './logo';

describe('LogoMark', () => {
  it('is decorative unless it is given a name', () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('is announced by its title when it stands alone', () => {
    render(<LogoMark title="HCX Care" />);
    expect(screen.getByRole('img', { name: 'HCX Care' })).toBeInTheDocument();
  });
});

describe('Logo', () => {
  it('shows the mark next to the brand name without naming it twice', () => {
    render(<Logo />);
    expect(screen.getByText(site.brand.name)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
