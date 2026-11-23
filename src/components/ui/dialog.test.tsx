import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogFooter } from './dialog';

// jsdom does no layout, so these only pin the classes that keep a modal's boxes inside it: a
// one-column grid that cannot grow with its widest child, a height capped to the screen that
// scrolls, and a footer that wraps. The layout itself was measured in a real browser (Edge) on
// the "Completar tratamiento" modal at 375 and 1280 px.
describe('Dialog', () => {
  it('keeps its content in one shrinkable column and scrolls vertically when it is tall', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent role="dialog">contenido</DialogContent>
      </Dialog>,
    );

    const classes = screen.getByRole('dialog').className.split(' ');
    expect(classes).toEqual(
      expect.arrayContaining(['grid-cols-1', 'overflow-y-auto', 'max-h-[calc(100dvh-2rem)]']),
    );
    // Hiding the horizontal overflow would cut buttons off instead of fixing what sticks out.
    expect(classes).not.toContain('overflow-x-hidden');
  });

  it('lets a caller choose its own height and width', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent role="dialog" className="max-h-[90vh] max-w-2xl">
          contenido
        </DialogContent>
      </Dialog>,
    );

    const classes = screen.getByRole('dialog').className.split(' ');
    expect(classes).toContain('max-h-[90vh]');
    expect(classes).toContain('max-w-2xl');
    expect(classes).not.toContain('max-h-[calc(100dvh-2rem)]');
    expect(classes).not.toContain('max-w-lg');
  });
});

describe('DialogFooter', () => {
  it('wraps its buttons in a row instead of pushing the last one out of the modal', () => {
    render(<DialogFooter data-testid="footer">botones</DialogFooter>);

    const classes = screen.getByTestId('footer').className.split(' ');
    expect(classes).toEqual(expect.arrayContaining(['flex', 'sm:flex-row', 'sm:flex-wrap']));
  });
});
