'use client';

import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WIDTH = 600;
const HEIGHT = 200;

/** Whether a stored value is a signature this component can show. */
export const isSignatureImage = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('data:image/png;base64,');

export interface SignaturePadProps {
  id: string;
  /** The signature as a PNG data URL, or an empty string. */
  value: string;
  onChange: (value: string) => void;
  /** Names the drawing area for assistive technology. */
  label: string;
  disabled?: boolean;
  invalid?: boolean;
  /**
   * Spans the width of its container, keeping the 3:1 ratio of the drawing surface so the
   * stored image is not distorted (a tablet signing a consent).
   */
  fullWidth?: boolean;
}

/**
 * A handwritten signature drawn with the finger, a stylus or the mouse. It has no keyboard
 * equivalent: whoever cannot draw signs on paper and the scanned document is attached instead.
 */
export function SignaturePad({
  id,
  value,
  onChange,
  label,
  disabled,
  invalid,
  fullWidth,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  // A signature that was stored before is shown as an image until the person signs again.
  const [drawn, setDrawn] = useState(false);
  const stored = !drawn && isSignatureImage(value) ? value : null;

  // When the form is emptied (after saving, or by choosing another record) the ink goes too:
  // a pad that still showed the last signature would look signed while holding nothing.
  useEffect(() => {
    if (value) return;
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, [value]);

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) * canvas.width) / (box.width || canvas.width),
      y: ((event.clientY - box.top) * canvas.height) / (box.height || canvas.height),
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext('2d');
    if (disabled || !context) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawing.current = true;
    const { x, y } = position(event);
    // Dark ink whatever the theme: the image ends up on a white document.
    context.strokeStyle = '#111827';
    context.fillStyle = '#111827';
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    // A tap leaves a dot.
    context.arc(x, y, 1.2, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext('2d');
    if (!drawing.current || !context) return;
    const { x, y } = position(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    setDrawn(true);
    onChange(event.currentTarget.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setDrawn(true);
    onChange('');
  };

  return (
    <div className="space-y-2">
      {stored ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL kept in the record
        <img
          src={stored}
          alt={`${label}: firma registrada`}
          className={cn(
            'w-full rounded-md border border-input bg-white object-contain',
            fullWidth ? 'aspect-[3/1] h-auto' : 'h-[120px] max-w-[480px]',
          )}
        />
      ) : (
        <canvas
          ref={canvasRef}
          id={id}
          width={WIDTH}
          height={HEIGHT}
          role="img"
          aria-label={`${label}: área para firmar`}
          // An image cannot be "invalid" to assistive technology: the problem is announced
          // through the message it is described by.
          data-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className={cn(
            'block w-full touch-none rounded-md border bg-white',
            fullWidth ? 'aspect-[3/1] h-auto' : 'h-[160px] max-w-[480px]',
            invalid ? 'border-destructive' : 'border-input',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair',
          )}
        />
      )}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !value}
          onClick={clear}
        >
          <Eraser className="mr-1 h-4 w-4" />
          {stored ? 'Firmar de nuevo' : 'Borrar firma'}
        </Button>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {value ? 'Firma registrada.' : 'Firma con el dedo, un lápiz o el ratón dentro del recuadro.'}
        </p>
      </div>
    </div>
  );
}
