import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReadReceipt } from '../index';

describe('ReadReceipt Component', () => {
  it('should render ReadReceipt stub text', () => {
    render(<ReadReceipt />);
    expect(screen.getByText('ReadReceipt')).toBeInTheDocument();
  });
});
