import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSignatureImage, SignaturePad } from './signature-pad';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const context = {
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  clearRect: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no canvas: the drawing calls are observed, the image is a fixed one.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(PNG);
});
afterEach(() => vi.restoreAllMocks());

const renderPad = (props: Partial<Parameters<typeof SignaturePad>[0]> = {}) => {
  const onChange = vi.fn();
  render(
    <SignaturePad id="signature" label="Firma de quien acepta" value="" onChange={onChange} {...props} />,
  );
  return onChange;
};
const pad = () => screen.getByRole('img', { name: 'Firma de quien acepta: área para firmar' });

describe('SignaturePad', () => {
  it('reports the drawing as a PNG when the stroke ends', () => {
    const onChange = renderPad();

    fireEvent.pointerDown(pad(), { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(pad(), { clientX: 40, clientY: 30, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(pad(), { pointerId: 1 });

    expect(context.lineTo).toHaveBeenCalledTimes(1);
    expect(context.stroke).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(PNG);
  });

  it('ignores movement without a stroke in course, and everything while disabled', () => {
    const onChange = renderPad({ disabled: true });

    fireEvent.pointerMove(pad(), { clientX: 40, clientY: 30 });
    fireEvent.pointerDown(pad(), { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(pad());

    expect(context.lineTo).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears the signature', () => {
    const onChange = renderPad({ value: PNG });
    // A stored signature is shown as an image until the person signs again.
    expect(screen.getByRole('img', { name: 'Firma de quien acepta: firma registrada' })).toHaveAttribute(
      'src',
      PNG,
    );
    expect(screen.getByText('Firma registrada.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Firmar de nuevo' }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(pad()).toBeInTheDocument();
  });

  it('wipes the ink when the form empties the value, as it does after saving', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SignaturePad id="signature" label="Firma de quien acepta" value="" onChange={onChange} />,
    );
    fireEvent.pointerDown(pad(), { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(pad(), { pointerId: 1 });
    rerender(<SignaturePad id="signature" label="Firma de quien acepta" value={PNG} onChange={onChange} />);
    context.clearRect.mockClear();

    rerender(<SignaturePad id="signature" label="Firma de quien acepta" value="" onChange={onChange} />);

    expect(context.clearRect).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Firma con el dedo/)).toBeInTheDocument();
  });

  it('cannot clear what was not signed', () => {
    renderPad();

    expect(screen.getByRole('button', { name: 'Borrar firma' })).toBeDisabled();
  });

  it('ties the area to the message of the API when it refused the signature', () => {
    renderPad({ invalid: true });

    expect(pad()).toHaveAttribute('aria-describedby', 'signature-error');
    expect(pad()).toHaveClass('border-destructive');
  });

  it('spans the width at full width without changing the 3:1 drawing surface', () => {
    renderPad({ fullWidth: true });

    expect(pad()).toHaveAttribute('width', '600');
    expect(pad()).toHaveAttribute('height', '200');
    expect(pad()).toHaveClass('w-full', 'aspect-[3/1]', 'h-auto');
    // No fixed height or width cap that would stretch the stored image.
    expect(pad().className).not.toMatch(/\bh-\[|max-w-/);
  });
});

describe('isSignatureImage', () => {
  it('accepts only PNG data URLs', () => {
    expect(isSignatureImage(PNG)).toBe(true);
    expect(isSignatureImage('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isSignatureImage('https://example.com/firma.png')).toBe(false);
    expect(isSignatureImage(undefined)).toBe(false);
  });
});
